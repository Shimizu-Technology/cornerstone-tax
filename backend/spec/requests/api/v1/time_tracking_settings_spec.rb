# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Time tracking settings", type: :request do
  include ActiveSupport::Testing::TimeHelpers

  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee, first_name: "Casey", last_name: "Clock") }
  let(:guam) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}", "Content-Type" => "application/json" }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def clock_session(user, from: "09:00", to: "10:00", clock_out_params: {})
    travel_to(guam.parse("2026-11-18 #{from}")) { post "/api/v1/time_entries/clock_in", headers: headers_for(user) }
    expect(response).to have_http_status(:created)
    travel_to(guam.parse("2026-11-18 #{to}")) do
      post "/api/v1/time_entries/clock_out", params: clock_out_params.to_json, headers: headers_for(user)
    end
    expect(response).to have_http_status(:ok)
    TimeEntry.where(user: user).order(:id).last
  end

  describe "flexible hours" do
    it "keeps sending unscheduled clock-ins to approval for people without it" do
      entry = clock_session(employee)

      expect(entry).to have_attributes(approval_status: "pending", approval_note: "Clocked in without a schedule")
    end

    it "doesn't send an unscheduled clock-in to approval" do
      employee.update!(flexible_hours: true)

      entry = clock_session(employee)

      expect(entry).to have_attributes(status: "completed", approval_status: nil, approval_note: nil)
      expect(TimeEntry.countable).to include(entry)
    end

    it "still sends a corrected clock-out time to approval" do
      employee.update!(flexible_hours: true)

      entry = clock_session(employee, clock_out_params: { corrected_end_time: "09:45" })

      expect(entry.approval_status).to eq("pending")
      expect(entry.approval_note).to eq("Employee corrected clock-out time to 09:45 AM")
    end

    it "still flags overtime" do
      employee.update!(flexible_hours: true)
      create(:time_entry, user: employee, work_date: Date.new(2026, 11, 18), hours: 8.0, status: "completed", approval_status: nil)

      entry = clock_session(employee, from: "18:00", to: "19:00")

      expect(entry).to have_attributes(approval_status: nil, overtime_status: "pending")
    end

    it "is recorded at clock-in whatever the flag, and decided at clock-out" do
      employee.update!(flexible_hours: true)
      travel_to(guam.parse("2026-11-18 09:00")) { post "/api/v1/time_entries/clock_in", headers: headers_for(employee) }

      expect(TimeEntry.clocked_in.find_by!(user: employee)).to have_attributes(unscheduled_clock_in: true, approval_note: nil)
    end

    it "applies when it is switched on during the shift" do
      travel_to(guam.parse("2026-11-18 09:00")) { post "/api/v1/time_entries/clock_in", headers: headers_for(employee) }
      expect(TimeEntry.clocked_in.find_by!(user: employee).unscheduled_clock_in).to be(true)
      employee.update!(flexible_hours: true)

      travel_to(guam.parse("2026-11-18 10:00")) { post "/api/v1/time_entries/clock_out", headers: headers_for(employee) }

      expect(TimeEntry.where(user: employee).last).to have_attributes(approval_status: nil, approval_note: nil)
    end

    it "applies when it is switched off during the shift" do
      employee.update!(flexible_hours: true)
      travel_to(guam.parse("2026-11-18 09:00")) { post "/api/v1/time_entries/clock_in", headers: headers_for(employee) }
      employee.update!(flexible_hours: false)

      travel_to(guam.parse("2026-11-18 10:00")) { post "/api/v1/time_entries/clock_out", headers: headers_for(employee) }

      expect(TimeEntry.where(user: employee).last).to have_attributes(approval_status: "pending", approval_note: "Clocked in without a schedule")
    end

    it "drops the note an older clock-in wrote when the person is now on flexible hours" do
      employee.update!(flexible_hours: true)
      travel_to(guam.parse("2026-11-18 09:00")) { post "/api/v1/time_entries/clock_in", headers: headers_for(employee) }
      # As written before clock-in stopped deciding (and as the backfill marks it).
      TimeEntry.clocked_in.find_by!(user: employee).update_columns(approval_note: "Clocked in without a schedule")

      travel_to(guam.parse("2026-11-18 10:00")) { post "/api/v1/time_entries/clock_out", headers: headers_for(employee) }

      expect(TimeEntry.where(user: employee).last).to have_attributes(approval_status: nil, approval_note: nil)
    end

    it "keeps an auto-closed unscheduled shift's reason when the person isn't flexible" do
      travel_to(guam.parse("2026-11-18 09:00")) { post "/api/v1/time_entries/clock_in", headers: headers_for(employee) }
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      entry.update_columns(clock_in_at: 20.hours.ago, start_time: 20.hours.ago)

      TimeClockService.flag_stale_entries

      expect(entry.reload.approval_note).to start_with("Clocked in without a schedule | Auto-closed")
    end

    it "is shown in the clock status" do
      employee.update!(flexible_hours: true)

      get "/api/v1/time_entries/current_status", headers: headers_for(employee)

      expect(json).to include(flexible_hours: true, work_task_required: false)
    end

    it "is switched by an admin, with an audit row" do
      patch "/api/v1/admin/users/#{employee.id}", params: { flexible_hours: true }.to_json, headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json.dig(:user, :flexible_hours)).to be(true)
      expect(employee.reload.flexible_hours).to be(true)
      log = AuditLog.where(auditable: employee).sole
      expect(log).to have_attributes(action: "updated", user_id: admin.id, metadata: "Flexible hours turned on")
      expect(log.changes_made).to eq("flexible_hours" => [ false, true ])
    end

    it "can't be switched by staff, even for themselves" do
      patch "/api/v1/admin/users/#{employee.id}", params: { flexible_hours: true }.to_json, headers: headers_for(employee)

      expect(response).to have_http_status(:forbidden)
      expect(employee.reload.flexible_hours).to be(false)
    end

    it "rejects a value that isn't true or false, and portal clients" do
      patch "/api/v1/admin/users/#{employee.id}", params: { flexible_hours: "sometimes" }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)

      portal = create(:user, role: "client", client: Client.create!(first_name: "Port", last_name: "Al"))
      patch "/api/v1/admin/users/#{portal.id}", params: { flexible_hours: true }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(portal.reload.flexible_hours).to be(false)
    end

    it "doesn't change anything (or log) when only the role is sent" do
      patch "/api/v1/admin/users/#{employee.id}", params: { role: "employee" }.to_json, headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(AuditLog.where(auditable: employee)).to be_empty
    end
  end

  describe "approve unscheduled-only entries" do
    let(:other) { create(:user, :employee, first_name: "Avery", last_name: "Alpha") }

    # A finished clock entry of `hours`, from 9:00 on work_date.
    def pending_clock(user, note: "Clocked in without a schedule", hours: 2.0, work_date: Date.new(2026, 11, 3), **attrs)
      start = guam.parse("#{work_date.iso8601} 09:00")
      create(:time_entry, { user: user, entry_method: "clock", status: "completed", approval_status: "pending", approval_note: note,
                            overtime_status: "none", work_date: work_date, start_time: start, end_time: start + hours.hours,
                            hours: hours }.merge(attrs))
    end

    # Confirm with each entry's current version (as the preview returns it).
    def confirm(*entries, as: admin, versions: {})
      payload = entries.map { |entry| { id: entry.id, version: versions.fetch(entry.id) { entry.reload.work_version } } }
      post "/api/v1/time_entries/approve_unscheduled_only", params: { entries: payload }.to_json, headers: headers_for(as)
    end

    let!(:only_unscheduled) { pending_clock(employee) }
    let!(:second) { pending_clock(other, hours: 3.0, work_date: Date.new(2026, 11, 4)) }
    let!(:corrected) { pending_clock(employee, note: "Clocked in without a schedule | Employee corrected clock-out time to 05:00 PM") }
    let!(:edited) { pending_clock(employee, note: "Clocked in without a schedule\n\nEmployee edited time entry — awaiting admin review") }
    let!(:overtime) { pending_clock(employee, overtime_status: "pending") }
    let!(:manual) { create(:time_entry, user: employee, entry_method: "manual", approval_status: "pending", approval_note: "Clocked in without a schedule") }
    let!(:locked) { pending_clock(employee, locked_at: Time.current) }

    it "previews only entries whose single reason is the missing schedule" do
      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json[:entries]).to eq([ { id: only_unscheduled.id, version: only_unscheduled.reload.work_version },
                                     { id: second.id, version: second.reload.work_version } ])
      expect(json).to include(entry_ids: [ only_unscheduled.id, second.id ], count: 2, hours: 5.0,
                              oldest_work_date: "2026-11-03", newest_work_date: "2026-11-04", needs_work_details_count: 0)
      expect(json[:by_user]).to eq([
        { id: other.id, name: "Avery Alpha", entry_count: 1, hours: 3.0 },
        { id: employee.id, name: "Casey Clock", entry_count: 1, hours: 2.0 }
      ])
    end

    it "leaves entries that still miss required work details in the queue" do
      Setting.set("time_work_details_required_from", "2026-11-01")

      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)

      expect(json).to include(count: 0, entry_ids: [], needs_work_details_count: 2)
    end

    it "approves the previewed entries and nothing else" do
      confirm(only_unscheduled, second)

      expect(response).to have_http_status(:ok)
      expect(json).to include(approved_count: 2, skipped_count: 0, changed_count: 0, ineligible_count: 0)
      expect(only_unscheduled.reload).to have_attributes(approval_status: "approved", approved_by_id: admin.id)
      expect(second.reload.approval_status).to eq("approved")
      [ corrected, edited, overtime, manual, locked ].each { |entry| expect(entry.reload.approval_status).to eq("pending") }
    end

    it "skips entries that no longer qualify, or never did" do
      only_unscheduled.update!(approval_note: "Clocked in without a schedule | Employee corrected clock-out time to 05:00 PM")

      confirm(only_unscheduled, second, corrected)

      expect(json).to include(approved_count: 1, skipped_count: 2, ineligible_count: 2, approved_entry_ids: [ second.id ])
      expect(only_unscheduled.reload.approval_status).to eq("pending")
      expect(corrected.reload.approval_status).to eq("pending")
    end

    it "skips an entry edited since the preview even if it still qualifies" do
      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)
      previewed = json[:entries].to_h { |row| [ row[:id], row[:version] ] }
      # A work-line edit that keeps the entry unscheduled-only but moves its version.
      only_unscheduled.update!(description: "Changed in another tab")

      confirm(only_unscheduled, second, versions: previewed)

      expect(json).to include(approved_count: 1, changed_count: 1, skipped_count: 1, approved_entry_ids: [ second.id ])
      expect(only_unscheduled.reload.approval_status).to eq("pending")
    end

    it "previews one batch of at most the confirm limit, oldest first, with figures for that batch" do
      stub_const("Api::V1::TimeEntriesController::UNSCHEDULED_BATCH_LIMIT", 1)

      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)

      expect(json).to include(entry_ids: [ only_unscheduled.id ], count: 1, hours: 2.0, total_count: 2, batch_limit: 1,
                              newest_work_date: "2026-11-03")
      expect(json[:by_user]).to eq([ { id: employee.id, name: "Casey Clock", entry_count: 1, hours: 2.0 } ])

      confirm(only_unscheduled, second)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to eq("Approve at most 1 entries at a time")
    end

    it "requires the version from the preview" do
      post "/api/v1/time_entries/approve_unscheduled_only", params: { entries: [ { id: only_unscheduled.id } ] }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/time_entries/approve_unscheduled_only", params: { entry_ids: [ only_unscheduled.id ] }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(only_unscheduled.reload.approval_status).to eq("pending")
    end

    it "leaves entries in a locked time period out of the preview and the approval" do
      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)
      previewed = json[:entries].to_h { |row| [ row[:id], row[:version] ] }
      TimePeriodLock.create!(start_date: Date.new(2026, 11, 1), end_date: Date.new(2026, 11, 3), locked_at: Time.current, locked_by: admin)

      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(admin)
      expect(json[:entry_ids]).to eq([ second.id ])

      confirm(only_unscheduled, second, versions: previewed)
      expect(json).to include(approved_count: 1, ineligible_count: 1, approved_entry_ids: [ second.id ])
      expect(only_unscheduled.reload.approval_status).to eq("pending")
    end

    it "writes an audit row for each approval" do
      confirm(only_unscheduled, second)

      logs = AuditLog.where(auditable_type: "TimeEntry", auditable_id: [ only_unscheduled.id, second.id ])
      expect(logs.count).to eq(2)
      expect(logs.map { |log| [ log.user_id, log.action, log.metadata, log.changes_made ] }.uniq).to eq(
        [ [ admin.id, "updated", "Approved in bulk: unscheduled-only", { "approval_status" => [ "pending", "approved" ] } ] ]
      )
    end

    it "keeps the overtime rule when approving" do
      # 7h already counted that day; approving the 2h entry crosses the 8h line.
      start = guam.parse("2026-11-03 12:00")
      create(:time_entry, user: employee, work_date: only_unscheduled.work_date, start_time: start, end_time: start + 7.hours,
                          hours: 7.0, approval_status: nil)

      confirm(only_unscheduled)

      expect(only_unscheduled.reload).to have_attributes(approval_status: "approved", overtime_status: "pending")
    end

    it "is admin-only and needs a preview" do
      get "/api/v1/time_entries/unscheduled_only_approvals", headers: headers_for(employee)
      expect(response).to have_http_status(:forbidden)

      confirm(only_unscheduled, as: employee)
      expect(response).to have_http_status(:forbidden)
      expect(only_unscheduled.reload.approval_status).to eq("pending")

      post "/api/v1/time_entries/approve_unscheduled_only", params: { entries: [] }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
    end
  end

  describe "require a task on every work line" do
    let(:client_a) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
    let(:internal) { Client.ensure_internal! }
    let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }
    let!(:bank_rec) { ServiceTask.create!(service_type: bookkeeping, name: "Bank Reconciliation") }
    let(:office) { ServiceType.create!(name: "Office & errands", internal: true) }

    before { Setting.set("time_work_details_required_from", "2026-11-01") }

    def manual(lines)
      post "/api/v1/time_entries", params: {
        time_entry: { work_date: "2026-11-16", start_time: "09:00", end_time: "10:00", work_lines: lines }
      }.to_json, headers: headers_for(employee)
    end

    it "is off by default: a client line needs no category or task" do
      manual([ { client_id: client_a.id, description: "Reconciled", minutes: 60 } ])

      expect(response).to have_http_status(:created)
    end

    context "when on" do
      before { Setting.set("time_work_task_required", "true") }

      it "asks a client line for a category and a task" do
        manual([ { client_id: client_a.id, description: "Reconciled", minutes: 60 } ])

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json[:error]).to include("This entry needs category and task")
      end

      it "asks for the task when the category has tasks" do
        manual([ { client_id: client_a.id, description: "Reconciled", service_type_id: bookkeeping.id, minutes: 60 } ])

        expect(response).to have_http_status(:unprocessable_entity)
        expect(json[:error]).to include("This entry needs task")
      end

      it "accepts a line with its task, and a category that has no tasks" do
        manual([
          { client_id: client_a.id, description: "Reconciled", service_type_id: bookkeeping.id, service_task_id: bank_rec.id, minutes: 30 },
          { client_id: internal.id, description: "Bank run", service_type_id: office.id, minutes: 30 }
        ])

        expect(response).to have_http_status(:created)
      end

      it "ignores inactive tasks" do
        bank_rec.update!(is_active: false)

        manual([ { client_id: client_a.id, description: "Reconciled", service_type_id: bookkeeping.id, minutes: 60 } ])

        expect(response).to have_http_status(:created)
      end

      it "doesn't apply before the cutover date" do
        post "/api/v1/time_entries", params: {
          time_entry: { work_date: "2026-10-30", start_time: "09:00", end_time: "10:00", work_lines: [ { client_id: client_a.id, description: "Old", minutes: 60 } ] }
        }.to_json, headers: headers_for(employee)

        expect(response).to have_http_status(:created)
      end

      it "is reported to the editors and to the Unassigned time list" do
        entry = create(:time_entry, user: employee, work_date: Date.new(2026, 11, 16), approval_status: nil, status: "completed")
        entry.work_lines.first.update_columns(client_id: client_a.id, description: "Reconciled", service_type_id: bookkeeping.id)

        get "/api/v1/time_entries/work_line_suggestions", headers: headers_for(employee)
        expect(json[:work_task_required]).to be(true)

        get "/api/v1/time_entries/unassigned", params: { issue: "any" }, headers: headers_for(admin)
        row = json[:time_entries].find { |item| item[:id] == entry.id }
        expect(row[:line_issues].first[:missing]).to eq([ "task" ])
        expect(json.dig(:summary, :task_required)).to be(true)
      end

      it "doesn't list or label entries from before the cutover for a missing task" do
        before_cutover = create(:time_entry, user: employee, work_date: Date.new(2026, 10, 30), approval_status: nil, status: "completed")
        before_cutover.work_lines.first.update_columns(client_id: client_a.id, description: "Reconciled", service_type_id: bookkeeping.id)
        no_category = create(:time_entry, user: employee, work_date: Date.new(2026, 10, 29), approval_status: nil, status: "completed")
        no_category.work_lines.first.update_columns(client_id: client_a.id, description: "Reconciled")

        get "/api/v1/time_entries/unassigned", params: { issue: "any" }, headers: headers_for(admin)

        expect(json[:time_entries].map { |item| item[:id] }).not_to include(before_cutover.id, no_category.id)
      end

      it "labels only the task-rule gaps from the cutover on" do
        # Listed for a missing client, which applies at any date; no task label.
        old = create(:time_entry, user: employee, work_date: Date.new(2026, 10, 30), approval_status: nil, status: "completed")
        old.work_lines.first.update_columns(client_id: nil, description: "Reconciled")

        get "/api/v1/time_entries/unassigned", params: { issue: "any" }, headers: headers_for(admin)

        row = json[:time_entries].find { |item| item[:id] == old.id }
        expect(row[:line_issues].first[:missing]).to eq([ "client" ])
      end
    end
  end

  describe "settings" do
    def save(values)
      put "/api/v1/admin/settings", params: values.to_json, headers: headers_for(admin)
    end

    it "defaults to semi-monthly pay periods and no task requirement" do
      get "/api/v1/admin/settings", headers: headers_for(admin)

      expect(json).to include(time_pay_schedule: "semi_monthly", time_pay_period_anchor: "", time_work_task_required: "false",
                              time_work_details_required_from: "")
    end

    it "saves the task requirement and a pay schedule" do
      save(time_work_task_required: "true", time_pay_schedule: "biweekly", time_pay_period_anchor: "2026-10-18")

      expect(response).to have_http_status(:ok)
      expect(Setting.get("time_work_task_required")).to eq("true")
      expect(PaySchedule.schedule).to eq("biweekly")
    end

    it "rejects bad values without saving any of them" do
      save(time_work_task_required: "maybe", time_pay_schedule: "monthly")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("must be true or false").and include("Pay schedule must be one of")
      expect(Setting.get("time_work_task_required")).to eq("false")
    end

    it "needs the first day of a period for biweekly and weekly schedules" do
      save(time_pay_schedule: "weekly")

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to eq("Choose the first day of a pay period: weekly and every-two-weeks schedules count from it")
      expect(Setting.get("time_pay_schedule")).to eq("semi_monthly")
    end

    it "is admin-only" do
      put "/api/v1/admin/settings", params: { time_work_task_required: "true" }.to_json, headers: headers_for(employee)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "pay periods" do
    def periods_on(date)
      PaySchedule.current_and_previous(Date.iso8601(date)).transform_values { |value| value.respond_to?(:as_json) ? value.as_json : value }
    end

    it "is semi-monthly by default" do
      expect(periods_on("2026-11-21")).to include(
        schedule: "semi_monthly",
        current: { start_date: "2026-11-16", end_date: "2026-11-30" },
        previous: { start_date: "2026-11-01", end_date: "2026-11-15" }
      )
      expect(periods_on("2026-11-05")[:previous]).to eq(start_date: "2026-10-16", end_date: "2026-10-31")
      expect(periods_on("2027-02-20")[:current]).to eq(start_date: "2027-02-16", end_date: "2027-02-28")
    end

    it "counts biweekly and weekly periods from the anchor, either side of it" do
      Setting.set("time_pay_schedule", "biweekly")
      Setting.set("time_pay_period_anchor", "2026-10-18")
      expect(periods_on("2026-11-21")).to include(
        current: { start_date: "2026-11-15", end_date: "2026-11-28" },
        previous: { start_date: "2026-11-01", end_date: "2026-11-14" }
      )
      expect(periods_on("2026-10-10")[:current]).to eq(start_date: "2026-10-04", end_date: "2026-10-17")

      Setting.set("time_pay_schedule", "weekly")
      expect(periods_on("2026-11-21")[:current]).to eq(start_date: "2026-11-15", end_date: "2026-11-21")
    end

    it "derives the schedule, label and periods from one read of the settings" do
      Setting.set("time_pay_schedule", "weekly")
      Setting.set("time_pay_period_anchor", "2026-10-18")
      # Simulates the anchor being cleared between two separate reads.
      allow(Setting).to receive(:get).and_call_original
      allow(Setting).to receive(:get).with("time_pay_period_anchor").and_return("2026-10-18", "")

      periods = periods_on("2026-11-21")

      expect(periods).to include(schedule: "weekly", label: "Every week",
                                 current: { start_date: "2026-11-15", end_date: "2026-11-21" })
    end

    it "falls back to semi-monthly when a biweekly anchor is missing" do
      Setting.set("time_pay_schedule", "biweekly")

      expect(periods_on("2026-11-21")[:schedule]).to eq("semi_monthly")
    end

    it "is served to staff for the work summary presets" do
      travel_to(guam.parse("2026-11-21 12:00")) do
        get "/api/v1/work_summary/pay_periods", headers: headers_for(employee)
      end

      expect(response).to have_http_status(:ok)
      expect(json).to eq(
        schedule: "semi_monthly",
        label: "Semi-monthly (1st–15th and 16th–end of month)",
        current: { start_date: "2026-11-16", end_date: "2026-11-30" },
        previous: { start_date: "2026-11-01", end_date: "2026-11-15" }
      )
    end
  end
end
