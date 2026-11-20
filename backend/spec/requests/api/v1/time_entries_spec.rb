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

    it "does not allow new entries for a terminated employee" do
      other_employee.terminate!(by: admin)

      post "/api/v1/time_entries",
           params: valid_params.deep_merge(time_entry: { user_id: other_employee.id }),
           headers: auth_headers_for[admin]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to eq("Selected user is invalid")
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

      it "keeps the approval when only the work details change" do
        entry.update!(approval_status: "approved", approved_by: admin, approved_at: 1.day.ago, approval_note: "Looks good")

        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "employee correction" } },
              headers: auth_headers_for[employee]

        expect(response).to have_http_status(:ok)
        expect(entry.reload).to have_attributes(approval_status: "approved", approved_by_id: admin.id, description: "employee correction")
      end

      it "resets stale approval metadata and queues the edit for review when the hours change" do
        entry.update!(approval_status: "approved", approved_by: admin, approved_at: 1.day.ago, approval_note: "Looks good")

        patch "/api/v1/time_entries/#{entry.id}",
              params: { time_entry: { description: "employee correction", end_time: "16:00" } },
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
      # "Today" is the Guam business date, which runs ahead of UTC from
      # 00:00 to 10:00 Guam time; Date.current made this spec fail then.
      guam_today = Time.current.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).to_date
      manual_entry = create(:time_entry, user: employee, work_date: guam_today, approval_status: "approved")

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

  # ── CLIENT / CATEGORY / TASK / PERIOD ────────────────────────────────
  describe "work details (client, category, task, period)" do
    let!(:bookkeeping) { ServiceType.create!(name: "Bookkeeping", position: 1) }
    let!(:payroll) { ServiceType.create!(name: "Payroll", position: 2) }
    let!(:bank_rec) { ServiceTask.create!(service_type: bookkeeping, name: "Bank Reconciliation", position: 1) }
    let!(:payroll_processing) { ServiceTask.create!(service_type: payroll, name: "Payroll Processing", position: 1) }
    let!(:business_client) do
      Client.create!(first_name: "Maria", last_name: "Santos", client_type: "business", business_name: "MoSa's Joint")
    end
    let!(:individual_client) { Client.create!(first_name: "Jose", last_name: "Cruz") }

    def manual_entry_params(**overrides)
      {
        time_entry: {
          work_date: Date.current.iso8601,
          start_time: "09:00",
          end_time: "11:00",
          client_id: business_client.id,
          service_type_id: bookkeeping.id,
          service_task_id: bank_rec.id,
          period_type: "month",
          period_start: "2026-07-01",
          description: ""
        }.merge(overrides)
      }
    end

    it "creates an entry with client, category, task and period" do
      post "/api/v1/time_entries", params: manual_entry_params, headers: auth_headers_for[employee]

      expect(response).to have_http_status(:created)
      entry = json[:time_entry]
      expect(entry.dig(:client, :name)).to eq("MoSa's Joint")
      expect(entry.dig(:service_type, :name)).to eq("Bookkeeping")
      expect(entry.dig(:service_task, :name)).to eq("Bank Reconciliation")
      expect(entry[:period_type]).to eq("month")
      expect(entry[:period_start]).to eq("2026-07-01")
      expect(entry[:period_label]).to eq("July 2026")
      expect(entry[:time_category]).to be_nil
    end

    it "labels an individual client by first and last name" do
      post "/api/v1/time_entries",
           params: manual_entry_params(client_id: individual_client.id, period_type: "quarter", period_start: "2026-07-01"),
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:created)
      expect(json.dig(:time_entry, :client, :name)).to eq("Jose Cruz")
      expect(json.dig(:time_entry, :period_label)).to eq("3rd Quarter 2026")
    end

    it "rejects a misaligned period" do
      post "/api/v1/time_entries",
           params: manual_entry_params(period_type: "quarter", period_start: "2026-08-01"),
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("first day of the selected quarter")
    end

    it "rejects a task from a different category" do
      post "/api/v1/time_entries",
           params: manual_entry_params(service_task_id: payroll_processing.id),
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("must belong to the selected service type")
    end

    it "updates the period and clears it again" do
      entry = create(:time_entry, user: employee, service_type: bookkeeping, service_task: bank_rec)

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { period_type: "year", period_start: "2026-01-01" } },
            headers: auth_headers_for[admin]
      expect(response).to have_http_status(:ok)
      expect(json.dig(:time_entry, :period_label)).to eq("2026")

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { period_type: "", period_start: "" } },
            headers: auth_headers_for[admin]
      expect(response).to have_http_status(:ok)
      expect(json.dig(:time_entry, :period_type)).to be_nil
      expect(json.dig(:time_entry, :period_label)).to be_nil
      expect(AuditLog.where(auditable: entry, action: "updated").last.changes_made).to include("period_type")
    end

    it "keeps a legacy time category when an older entry is edited" do
      legacy = TimeCategory.create!(name: "Tax Prep")
      entry = create(:time_entry, user: employee, time_category: legacy)

      patch "/api/v1/time_entries/#{entry.id}",
            params: { time_entry: { description: "Updated comment", client_id: individual_client.id } },
            headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json.dig(:time_entry, :time_category, :name)).to eq("Tax Prep")
      expect(entry.reload.time_category_id).to eq(legacy.id)
    end

    describe "filters" do
      let!(:july_rec) do
        create(:time_entry, user: employee, client: business_client, service_type: bookkeeping, service_task: bank_rec,
                            period_type: "month", period_start: Date.new(2026, 7, 1))
      end
      let!(:q3_payroll) do
        create(:time_entry, user: employee, client: individual_client, service_type: payroll, service_task: payroll_processing,
                            period_type: "quarter", period_start: Date.new(2026, 7, 1))
      end
      let!(:legacy_entry) { create(:time_entry, user: employee, time_category: TimeCategory.create!(name: "Admin")) }

      def ids_for(params)
        get "/api/v1/time_entries", params: params, headers: auth_headers_for[admin]
        expect(response).to have_http_status(:ok)
        json[:time_entries].map { |row| row[:id] }
      end

      it "filters by category and task" do
        expect(ids_for(service_type_id: payroll.id)).to eq([ q3_payroll.id ])
        expect(ids_for(service_task_id: bank_rec.id)).to eq([ july_rec.id ])
      end

      it "filters by period type and start" do
        expect(ids_for(period_type: "month", period_start: "2026-07-01")).to eq([ july_rec.id ])
        expect(ids_for(period_type: "quarter")).to eq([ q3_payroll.id ])
        expect(ids_for(period_start: "2026-07-01")).to contain_exactly(july_rec.id, q3_payroll.id)
      end

      it "rejects invalid period filters" do
        get "/api/v1/time_entries", params: { period_type: "week" }, headers: auth_headers_for[admin]
        expect(response).to have_http_status(:unprocessable_entity)

        get "/api/v1/time_entries", params: { period_start: "not-a-date" }, headers: auth_headers_for[admin]
        expect(response).to have_http_status(:unprocessable_entity)
      end

      it "still returns and filters legacy time-category entries" do
        all_ids = ids_for({})
        expect(all_ids).to include(legacy_entry.id)
        legacy_row = json[:time_entries].find { |row| row[:id] == legacy_entry.id }
        expect(legacy_row.dig(:time_category, :name)).to eq("Admin")
        expect(legacy_row[:service_type]).to be_nil

        expect(ids_for(time_category_id: legacy_entry.time_category_id)).to eq([ legacy_entry.id ])
      end
    end

    it "records work details when clocking out" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      expect(response).to have_http_status(:created)

      post "/api/v1/time_entries/clock_out",
           params: {
             description: "Reconciled July",
             client_id: business_client.id,
             service_type_id: bookkeeping.id,
             service_task_id: bank_rec.id,
             period_type: "month",
             period_start: "2026-07-01"
           },
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:ok)
      entry = json[:time_entry]
      expect(entry[:status]).to eq("completed")
      expect(entry[:description]).to eq("Reconciled July")
      expect(entry.dig(:client, :name)).to eq("MoSa's Joint")
      expect(entry.dig(:service_task, :name)).to eq("Bank Reconciliation")
      expect(entry[:period_label]).to eq("July 2026")
    end

    it "keeps the clock and its open break when clock-out work details are invalid, then allows a retry" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      post "/api/v1/time_entries/start_break", headers: auth_headers_for[employee]
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      expect(entry.active_break).to be_present

      post "/api/v1/time_entries/clock_out",
           params: { service_type_id: bookkeeping.id, service_task_id: payroll_processing.id },
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.status).to eq("on_break")
      expect(entry.active_break).to be_present

      post "/api/v1/time_entries/clock_out",
           params: { service_type_id: payroll.id, service_task_id: payroll_processing.id },
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:ok)
      expect(entry.reload.status).to eq("completed")
      expect(entry.active_break).to be_nil
    end

    it "rejects a clock-out aimed at a different clock-in and leaves the active entry untouched" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      entry = TimeEntry.clocked_in.find_by!(user: employee)

      post "/api/v1/time_entries/clock_out",
           params: { time_entry_id: entry.id + 999, client_id: business_client.id },
           headers: auth_headers_for[employee]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("changed since this form was opened")
      expect(entry.reload).to have_attributes(status: "clocked_in", client_id: nil)

      post "/api/v1/time_entries/clock_out", params: { time_entry_id: entry.id }, headers: auth_headers_for[employee]
      expect(response).to have_http_status(:ok)
    end

    it "drops a stale task when clock-out changes the category, and clears an explicitly emptied client" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      entry.update!(client: business_client, service_type: bookkeeping, service_task: bank_rec)

      post "/api/v1/time_entries/clock_out",
           params: { time_entry_id: entry.id, client_id: nil, service_type_id: payroll.id }.to_json,
           headers: auth_headers_for[employee].merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:ok)
      expect(entry.reload).to have_attributes(client_id: nil, service_type_id: payroll.id, service_task_id: nil)
    end

    it "keeps saved work details when clock-out omits them" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      entry.update!(client: business_client, service_type: bookkeeping, service_task: bank_rec)

      post "/api/v1/time_entries/clock_out", headers: auth_headers_for[employee]

      expect(response).to have_http_status(:ok)
      expect(entry.reload).to have_attributes(client_id: business_client.id, service_task_id: bank_rec.id)
    end

    it "returns 422 instead of 500 when the chosen client was removed" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      missing_id = Client.maximum(:id).to_i + 1000

      post "/api/v1/time_entries/clock_out", params: { client_id: missing_id }, headers: auth_headers_for[employee]

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("Client no longer exists")
      expect(TimeEntry.clocked_in.where(user: employee)).to exist
    end

    it "returns saved work details in the clock status for the clock-out form" do
      post "/api/v1/time_entries/clock_in", headers: auth_headers_for[employee]
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      entry.update!(client: business_client, service_type: bookkeeping, service_task: bank_rec, period_type: "month", period_start: Date.new(2026, 7, 1))

      get "/api/v1/time_entries/current_status", headers: auth_headers_for[employee]

      expect(json[:entry_id]).to eq(entry.id)
      expect(json[:work_date]).to eq(entry.work_date.iso8601)
      expect(json[:work_details]).to include(
        client: { id: business_client.id, name: "MoSa's Joint" },
        service_task: { id: bank_rec.id, name: "Bank Reconciliation" },
        period_type: "month",
        period_start: "2026-07-01"
      )
    end

    it "returns 422 for a non-date period start" do
      post "/api/v1/time_entries",
           params: manual_entry_params(period_start: 123).to_json,
           headers: auth_headers_for[employee].merge("Content-Type" => "application/json")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("must be a valid date")
    end
  end

  describe "GET /api/v1/time_entries/pending_approvals client labels" do
    it "counts and sorts clients by their display name" do
      business = Client.create!(first_name: "Zoe", last_name: "Aguon", client_type: "business", business_name: "Beta Builders")
      person = Client.create!(first_name: "Amy", last_name: "Zamora")
      later = create(:time_entry, user: employee, client: business, approval_status: "pending")
      earlier = create(:time_entry, user: employee, client: person, approval_status: "pending")

      get "/api/v1/time_entries/pending_approvals", params: { sort: "client", direction: "asc" }, headers: auth_headers_for[admin]

      expect(response).to have_http_status(:ok)
      expect(json[:pending_entries].map { |row| row[:id] }).to eq([ earlier.id, later.id ])
      expect(json.dig(:summary, :counts_by_client).map { |row| row[:name] }).to contain_exactly("Amy Zamora", "Beta Builders")
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
