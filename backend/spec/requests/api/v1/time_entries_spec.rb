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
