# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Api::V1::TimeEntries", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee, first_name: "Alice", last_name: "Smith") }
  let(:other_employee) { create(:user, :employee, first_name: "Bob", last_name: "Jones") }

  let(:auth_headers_for) do
    ->(user) { { "Authorization" => "Bearer test_token_#{user.id}" } }
  end

  # ── helpers ──────────────────────────────────────────────────────────
  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def create_protecting_export(entry)
    ReportExport.create!(
      public_id: "CST-PAYROLL-#{SecureRandom.hex(6).upcase}",
      export_type: "payroll_time_summary",
      readiness_status: "complete",
      state: "active",
      start_date: entry.work_date,
      end_date: entry.work_date,
      employee_ids: [ entry.user_id ],
      entry_ids: [ entry.id ],
      filters: {},
      summary: {},
      issues: {},
      report_context: {},
      entry_snapshot: [ { id: entry.id, hours: entry.hours.to_f } ],
      checksum: SecureRandom.hex(16),
      protects_entries: true,
      generated_at: Time.current,
      last_downloaded_at: Time.current
    )
  end

  # ── CREATE ───────────────────────────────────────────────────────────
  describe "POST /api/v1/time_entries" do
    let(:valid_params) do
      {
        time_entry: {
          work_date: Date.current.iso8601,
          start_time: "09:00",
          end_time: "17:00",
          description: "Created from spec"
        }
      }
    end

    it "allows employee to create own entry" do
      post "/api/v1/time_entries", params: valid_params, headers: auth_headers_for[employee]

      expect(response).to have_http_status(:created)
      expect(json.dig(:time_entry, :user, :id)).to eq(employee.id)
    end

    it "allows admin to create entry for another staff user" do
      post "/api/v1/time_entries",
           params: valid_params.deep_merge(time_entry: { user_id: other_employee.id }),
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:created)
      expect(json.dig(:time_entry, :user, :id)).to eq(other_employee.id)
    end

    it "blocks non-admin from creating for another user" do
      post "/api/v1/time_entries",
           params: valid_params.deep_merge(time_entry: { user_id: other_employee.id }),
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:forbidden)
      expect(json[:error]).to eq("Only admins can create entries for other users")
    end
  end

  # ── UPDATE ───────────────────────────────────────────────────────────
  describe "PATCH /api/v1/time_entries/:id" do
    let!(:entry) { create(:time_entry, user: employee) }

    context "owner (employee) edits own entry" do
      it "succeeds" do
        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "updated" } },
              headers: auth_headers_for[employee]

        expect(response).to have_http_status(:ok)
        expect(json.dig(:time_entry, :description)).to eq("updated")
      end

      it "resets stale approval metadata and queues the edit for review" do
        entry.update!(approval_status: "approved", approved_by: admin, approved_at: 1.day.ago, approval_note: "Looks good")

        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "employee correction" } },
              headers: auth_headers_for[employee]

        expect(response).to have_http_status(:ok)
        expect(entry.reload.approval_status).to eq("pending")
        expect(entry.approved_by).to be_nil
        expect(entry.approved_at).to be_nil
        expect(entry.approval_note).to include("Employee edited time entry")
      end
    end

    it "syncs corrected clock times back to clock timestamps" do
      work_date = Date.yesterday
      tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
      clock_in = tz.parse("#{work_date.iso8601} 08:00")
      clock_out = tz.parse("#{work_date.iso8601} 17:00")
      entry.update!(work_date: work_date, entry_method: "clock", clock_in_at: clock_in, clock_out_at: clock_out, start_time: clock_in, end_time: clock_out, approval_status: nil)

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { start_time: "08:30", end_time: "17:30" } },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(entry.reload.clock_in_at.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("08:30")
      expect(entry.clock_out_at.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("17:30")
      expect(entry.start_time.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("08:30")
      expect(entry.end_time.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("17:30")
    end

    it "allows clock-in and break corrections in the same request" do
      work_date = Date.yesterday
      tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
      clock_in = tz.parse("#{work_date.iso8601} 08:00")
      clock_out = tz.parse("#{work_date.iso8601} 17:00")
      entry.update!(work_date: work_date, entry_method: "clock", clock_in_at: clock_in, clock_out_at: clock_out, start_time: clock_in, end_time: clock_out, approval_status: nil)
      entry.time_entry_breaks.create!(start_time: tz.parse("#{work_date.iso8601} 09:00"), end_time: tz.parse("#{work_date.iso8601} 09:15"))

      patch "/api/v1/time_entries/#{entry.id}",
            params: {
              time_entry: {
                start_time: "09:30",
                end_time: "17:30",
                breaks: [ { start_time: "10:00", end_time: "10:15" } ]
              }
            },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(entry.reload.clock_in_at.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("09:30")
      expect(entry.time_entry_breaks.count).to eq(1)
      expect(entry.time_entry_breaks.first.start_time.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).strftime("%H:%M")).to eq("10:00")
    end

    it "does not send active employee clock entries to pending approvals" do
      tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
      clock_in = tz.parse("#{Date.current.iso8601} 08:00")
      active_entry = create(:time_entry,
                            user: employee,
                            work_date: Date.current,
                            entry_method: "clock",
                            status: "clocked_in",
                            clock_in_at: clock_in,
                            start_time: clock_in,
                            end_time: nil,
                            hours: 0,
                            approval_status: nil)

      patch "/api/v1/time_entries/#{active_entry.id}",
            params: { time_entry: { description: "updated while clocked in" } },
            headers: auth_headers_for[employee]

      expect(response).to have_http_status(:ok)
      expect(active_entry.reload.approval_status).to be_nil
      expect(active_entry.approved_by).to be_nil
      expect(active_entry.approved_at).to be_nil
    end

    context "admin edits another user's entry" do
      it "succeeds" do
        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "admin edit" } },
              headers: auth_headers_for[admin]

        expect(response).to have_http_status(:ok)
        expect(json.dig(:time_entry, :description)).to eq("admin edit")
      end
    end

    context "employee tries to edit another user's entry" do
      it "returns 403 with ownership error" do
        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "nope" } },
              headers: auth_headers_for[other_employee]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("You can only edit your own time entries")
      end
    end

    context "locked entry" do
      let!(:locked_entry) { create(:time_entry, :locked, user: employee) }

      it "blocks owner from editing" do
        patch "/api/v1/time_entries/#{locked_entry.id}",
              params: { time_entry: { description: "nope" } },
              headers: auth_headers_for[employee]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("This time entry is locked and cannot be edited")
      end

      it "blocks admin from editing" do
        patch "/api/v1/time_entries/#{locked_entry.id}",
              params: { time_entry: { description: "nope" } },
              headers: auth_headers_for[admin]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("This time entry is locked and cannot be edited")
      end
    end
  end

  # ── DESTROY ──────────────────────────────────────────────────────────
  describe "DELETE /api/v1/time_entries/:id" do
    let!(:entry) { create(:time_entry, user: employee) }

    context "owner deletes own entry" do
      it "succeeds" do
        delete "/api/v1/time_entries/#{entry.id}",
               headers: auth_headers_for[employee]

        expect(response).to have_http_status(:no_content)
      end
    end

    context "admin deletes another user's entry" do
      it "succeeds" do
        delete "/api/v1/time_entries/#{entry.id}",
               headers: auth_headers_for[admin]

        expect(response).to have_http_status(:no_content)
      end
    end

    context "employee tries to delete another user's entry" do
      it "returns 403 with ownership error" do
        delete "/api/v1/time_entries/#{entry.id}",
               headers: auth_headers_for[other_employee]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("You can only delete your own time entries")
      end
    end

    context "locked entry" do
      let!(:locked_entry) { create(:time_entry, :locked, user: employee) }

      it "blocks owner from deleting" do
        delete "/api/v1/time_entries/#{locked_entry.id}",
               headers: auth_headers_for[employee]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("This time entry is locked and cannot be deleted")
      end

      it "blocks admin from deleting" do
        delete "/api/v1/time_entries/#{locked_entry.id}",
               headers: auth_headers_for[admin]

        expect(response).to have_http_status(:forbidden)
        expect(json[:error]).to eq("This time entry is locked and cannot be deleted")
      end
    end
  end

  describe "GET /api/v1/time_entries/pending_approvals" do
    let!(:category) { TimeCategory.create!(name: "Tax Prep") }
    let!(:older_entry) do
      create(:time_entry,
             user: employee,
             work_date: Date.current - 2.days,
             time_category: category,
             approval_status: "pending",
             entry_method: "manual")
    end
    let!(:newer_overtime_entry) do
      create(:time_entry,
             user: other_employee,
             work_date: Date.current,
             approval_status: "approved",
             overtime_status: "pending")
    end

    it "returns filtered pending entries with summary metadata oldest first" do
      get "/api/v1/time_entries/pending_approvals",
          params: { time_category_id: category.id, sort: "work_date", direction: "asc" },
          headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:count]).to eq(1)
      expect(json[:pending_entries].map { |entry| entry[:id] }).to eq([ older_entry.id ])
      expect(json.dig(:summary, :entry_count)).to eq(1)
      expect(json.dig(:summary, :pending_time_entry_count)).to eq(1)
      expect(json.dig(:summary, :oldest_work_date)).to eq(older_entry.work_date.iso8601)
      expect(json.dig(:pending_entries, 0, :approval_reasons).map { |reason| reason[:key] }).to include("manual_entry")
    end

    it "blocks non-admin users" do
      get "/api/v1/time_entries/pending_approvals", headers: auth_headers_for[employee]

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "GET /api/v1/time_entries/whos_working" do
    it "includes countable manual entries in today's completed hours and day entries" do
      manual_entry = create(:time_entry, user: employee, work_date: Date.current, approval_status: "approved")

      get "/api/v1/time_entries/whos_working", headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      worker = json[:workers].find { |row| row.dig(:user, :id) == employee.id }
      expect(worker[:completed_hours]).to eq(manual_entry.hours.to_f)
      expect(worker[:day_entries].map { |entry| entry[:id] }).to include(manual_entry.id)
      expect(worker[:day_entries].find { |entry| entry[:id] == manual_entry.id }[:entry_method]).to eq("manual")
    end
  end

  describe "POST /api/v1/time_entries/bulk_approve" do
    let!(:pending_entry) { create(:time_entry, user: employee, approval_status: "pending") }
    let!(:pending_overtime_entry) { create(:time_entry, user: other_employee, approval_status: "approved", overtime_status: "pending") }

    it "approves selected pending time and overtime entries" do
      post "/api/v1/time_entries/bulk_approve",
           params: { entry_ids: [ pending_entry.id, pending_overtime_entry.id ], note: "Reviewed in batch" },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:count]).to eq(2)
      expect(pending_entry.reload.approval_status).to eq("approved")
      expect(pending_entry.approved_by).to eq(admin)
      expect(pending_overtime_entry.reload.overtime_status).to eq("approved")
      expect(pending_overtime_entry.overtime_approved_by).to eq(admin)
    end

    it "calculates overtime cumulatively for pending entries in the batch" do
      work_date = Date.yesterday
      tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
      first_entry = create(:time_entry,
                           user: employee,
                           work_date: work_date,
                           start_time: tz.parse("#{work_date.iso8601} 08:00"),
                           end_time: tz.parse("#{work_date.iso8601} 13:00"),
                           approval_status: "pending",
                           overtime_status: "none")
      second_entry = create(:time_entry,
                            user: employee,
                            work_date: work_date,
                            start_time: tz.parse("#{work_date.iso8601} 13:00"),
                            end_time: tz.parse("#{work_date.iso8601} 18:00"),
                            approval_status: "pending",
                            overtime_status: "none")

      post "/api/v1/time_entries/bulk_approve",
           params: { entry_ids: [ first_entry.id, second_entry.id ] },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(first_entry.reload.overtime_status).to eq("none")
      expect(second_entry.reload.overtime_status).to eq("approved")
      expect(second_entry.overtime_approved_by).to eq(admin)
    end

    it "treats zero overtime thresholds as disabled during projection" do
      Setting.set("overtime_daily_threshold_hours", "0")
      Setting.set("overtime_weekly_threshold_hours", "0")

      entry = create(:time_entry, user: employee, approval_status: "pending", overtime_status: "none")

      post "/api/v1/time_entries/bulk_approve",
           params: { entry_ids: [ entry.id ] },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(entry.reload.approval_status).to eq("approved")
      expect(entry.overtime_status).to eq("none")
    end

    it "returns validation errors without leaking a 500" do
      pending_entry.update_column(:end_time, nil)

      post "/api/v1/time_entries/bulk_approve",
           params: { entry_ids: [ pending_entry.id ] },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("End time")
      expect(pending_entry.reload.approval_status).to eq("pending")
    end

    it "rejects non-pending selections" do
      approved_entry = create(:time_entry, user: employee, approval_status: "approved", overtime_status: "none")

      post "/api/v1/time_entries/bulk_approve",
           params: { entry_ids: [ approved_entry.id ] },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("no longer pending")
    end
  end

  # ── INDEX ────────────────────────────────────────────────────────────
  describe "GET /api/v1/time_entries" do
    let!(:emp_entry) { create(:time_entry, user: employee) }
    let!(:other_entry) { create(:time_entry, user: other_employee) }

    context "admin" do
      it "sees all entries" do
        get "/api/v1/time_entries", headers: auth_headers_for[admin]

        expect(response).to have_http_status(:ok)
        ids = json[:time_entries].map { |e| e[:id] }
        expect(ids).to include(emp_entry.id, other_entry.id)
      end
    end

    context "employee" do
      it "sees only own entries" do
        get "/api/v1/time_entries", headers: auth_headers_for[employee]

        expect(response).to have_http_status(:ok)
        ids = json[:time_entries].map { |e| e[:id] }
        expect(ids).to include(emp_entry.id)
        expect(ids).not_to include(other_entry.id)
      end
    end
  end

  # ── EXPORTED REPORT CORRECTIONS ──────────────────────────────────────
  describe "corrections after an export" do
    let!(:entry) { create(:time_entry, user: employee, approval_status: "approved") }

    it "requires a reason and atomically invalidates prior reports when an entry is corrected" do
      export = create_protecting_export(entry)

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { description: "corrected" } },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:code]).to eq("correction_reason_required")
      expect(json[:export_references]).to eq([ export.public_id ])
      expect(entry.reload.description).not_to eq("corrected")

      patch "/api/v1/time_entries/#{entry.id}",
            params: {
              time_entry: { description: "corrected" },
              correction_reason: "Employee confirmed the corrected client allocation."
            },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(export.reload.state).to eq("stale")
      expect(export.stale_reason).to include("Employee confirmed the corrected client allocation")
      expect(AuditLog.where(auditable: entry, action: "updated").order(:id).last.metadata).to include("correction reason")
    end

    it "rolls back the entry and audit record when report invalidation fails" do
      create_protecting_export(entry)
      original_description = entry.description
      allow(ReportExport).to receive(:invalidate_for_entry!).and_raise("invalidation failed")

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { description: "corrected" }, correction_reason: "Verified correction" },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:internal_server_error)
      expect(entry.reload.description).to eq(original_description)
      expect(AuditLog.where(auditable: entry, action: "updated")).to be_empty
    end

    it "requires a correction reason before deletion and preserves a deletion audit trail" do
      export = create_protecting_export(entry)

      delete "/api/v1/time_entries/#{entry.id}", headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload).to be_present

      delete "/api/v1/time_entries/#{entry.id}",
             params: { correction_reason: "Duplicate entry confirmed by payroll." },
             headers: auth_headers_for[admin]

      expect(response).to have_http_status(:no_content)
      expect(TimeEntry.find_by(id: entry.id)).to be_nil
      expect(export.reload.state).to eq("stale")
      audit = AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry.id, action: "deleted").last
      expect(audit.metadata).to include("Duplicate entry confirmed by payroll")
    end

    it "marks an earlier export stale when approval status changes" do
      entry.update!(approval_status: "pending")
      export = create_protecting_export(entry)

      post "/api/v1/time_entries/#{entry.id}/approve",
           params: { note: "Reviewed against schedule" },
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(export.reload.state).to eq("stale")
      expect(export.stale_reason).to include("Time entry approved")
    end
  end

  # ── PERIOD LOCK BEHAVIOR ─────────────────────────────────────────────
  describe "period locks" do
    let(:week_start) { Date.current.beginning_of_week(:sunday) }
    let!(:period_lock) do
      create(:time_period_lock, start_date: week_start, end_date: week_start + 6.days, locked_by: admin)
    end

    it "blocks create inside locked week" do
      post "/api/v1/time_entries",
           params: {
             time_entry: {
               work_date: week_start.iso8601,
               start_time: "09:00",
               end_time: "17:00",
               description: "locked period create"
             }
           },
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:forbidden)
      expect(json[:error]).to eq("This time period is locked and cannot be modified")
    end

    it "blocks update inside locked week" do
      entry = create(:time_entry, user: employee, work_date: week_start)

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { description: "nope" } },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:forbidden)
      expect(json[:error]).to eq("This time period is locked and cannot be modified")
    end

    it "blocks destroy inside locked week" do
      entry = create(:time_entry, user: employee, work_date: week_start)

      delete "/api/v1/time_entries/#{entry.id}",
             headers: auth_headers_for[admin]

      expect(response).to have_http_status(:forbidden)
      expect(json[:error]).to eq("This time period is locked and cannot be modified")
    end
  end

  # ── SHOW ─────────────────────────────────────────────────────────────
  describe "GET /api/v1/time_entries/:id" do
    let!(:entry) { create(:time_entry, user: employee) }

    it "includes locked_at in the response" do
      get "/api/v1/time_entries/#{entry.id}",
          headers: auth_headers_for[employee]

      expect(response).to have_http_status(:ok)
      expect(json[:time_entry]).to have_key(:locked_at)
      expect(json[:time_entry][:locked_at]).to be_nil
    end

    context "locked entry" do
      let!(:locked_entry) { create(:time_entry, :locked, user: employee) }

      it "returns locked_at timestamp" do
        get "/api/v1/time_entries/#{locked_entry.id}",
            headers: auth_headers_for[employee]

        expect(json[:time_entry][:locked_at]).to be_present
      end
    end

    it "includes user info with display_name" do
      get "/api/v1/time_entries/#{entry.id}",
          headers: auth_headers_for[employee]

      user_data = json[:time_entry][:user]
      expect(user_data[:id]).to eq(employee.id)
      expect(user_data[:display_name]).to eq(employee.display_name)
      expect(user_data[:full_name]).to eq(employee.full_name)
    end
  end
end
