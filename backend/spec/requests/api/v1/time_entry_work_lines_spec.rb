# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Time entry work lines API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee) }
  let(:other_user) { create(:user, :employee) }
  let(:client_a) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:client_b) { Client.create!(first_name: "B", last_name: "B", client_type: "business", business_name: "Beta Co") }
  let(:bookkeeping) { ServiceType.create!(name: "Bookkeeping") }

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}", "Content-Type" => "application/json" }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  let(:work_date) { Date.current - 1 }

  it "creates a manual entry split across clients and returns its lines" do
    post "/api/v1/time_entries", params: {
      time_entry: {
        work_date: work_date.iso8601, start_time: "09:00", end_time: "10:00",
        work_lines: [
          { client_id: client_a.id, description: "Prepared bank reconciliations", minutes: 45 },
          { client_id: client_b.id, description: "Reconciled cc accounts", duration: "15m", service_type_id: bookkeeping.id }
        ]
      }
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:created)
    entry = json[:time_entry]
    expect(entry[:hours]).to eq(1.0)
    expect(entry[:approval_status]).to eq("pending")
    expect(entry[:work_lines].map { |line| line.values_at(:client_label, :description, :hours, :minutes) }).to eq([
      [ "Alpha Co", "Prepared bank reconciliations", 0.75, 45 ],
      [ "Beta Co", "Reconciled cc accounts", 0.25, 15 ]
    ])
    expect(entry.dig(:client, :id)).to eq(client_a.id)
  end

  it "creates a manual day log with no times, totalling its lines" do
    post "/api/v1/time_entries", params: {
      time_entry: {
        work_date: work_date.iso8601,
        work_lines: [
          { client_id: client_a.id, description: "Bank recs", minutes: 45 },
          { client_id: client_b.id, description: "Payroll inputs", duration: "1.5h" },
          { client_id: nil, description: "Weekly meeting", minutes: 30 }
        ]
      }
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:created)
    expect(json.dig(:time_entry, :hours)).to eq(2.75)
    expect(json.dig(:time_entry, :duration_only)).to be(true)
    expect(json.dig(:time_entry, :work_lines).last[:client_label]).to eq("Unassigned")
  end

  it "returns a readable 422 when the lines do not add up" do
    post "/api/v1/time_entries", params: {
      time_entry: { work_date: work_date.iso8601, start_time: "09:00", end_time: "11:00",
                    work_lines: [ { client_id: client_a.id, minutes: 60 } ] }
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json[:error]).to include("short of this entry's 2h by 1h")
  end

  it "re-splits an existing entry and audits the line change" do
    entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "approved", client: client_a)

    patch "/api/v1/time_entries/#{entry.id}", params: {
      time_entry: { work_lines: [ { client_id: client_a.id, minutes: 300 }, { client_id: client_b.id, minutes: 180 } ] }
    }.to_json, headers: headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(json.dig(:time_entry, :work_lines).map { |line| line[:hours] }).to eq([ 5.0, 3.0 ])
    expect(AuditLog.where(auditable: entry, action: "updated").last.changes_made).to have_key("work_lines")
  end

  it "finds a split entry by any of its clients" do
    entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "approved")
    entry.work_lines_input = [ { client_id: client_a.id, minutes: 240 }, { client_id: client_b.id, minutes: 240 } ]
    entry.save!

    get "/api/v1/time_entries", params: { client_id: client_b.id }, headers: headers_for(admin)

    expect(json[:time_entries].map { |row| row[:id] }).to eq([ entry.id ])
  end

  it "splits a clock session at clock-out, absorbing the minutes the form was open" do
    post "/api/v1/time_entries/clock_in", headers: headers_for(employee)
    entry = TimeEntry.clocked_in.find_by!(user: employee)
    started = 2.hours.ago
    entry.update_columns(clock_in_at: started, start_time: started.in_time_zone(TimeClockService::BUSINESS_TIMEZONE))

    # The form showed 1h 57m; two more minutes passed before submit.
    post "/api/v1/time_entries/clock_out", params: {
      time_entry_id: entry.id,
      work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 90 },
                    { client_id: client_b.id, description: "Filing", minutes: 27 } ]
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:ok)
    lines = json.dig(:time_entry, :work_lines)
    expect(lines.sum { |line| line[:hours] }.round(2)).to eq(json.dig(:time_entry, :hours))
    expect(lines.map { |line| line[:client_label] }).to eq([ "Alpha Co", "Beta Co" ])
  end

  it "keeps the clock running when clock-out lines are far off" do
    post "/api/v1/time_entries/clock_in", headers: headers_for(employee)
    entry = TimeEntry.clocked_in.find_by!(user: employee)
    started = 2.hours.ago
    entry.update_columns(clock_in_at: started, start_time: started.in_time_zone(TimeClockService::BUSINESS_TIMEZONE))

    post "/api/v1/time_entries/clock_out", params: {
      time_entry_id: entry.id, work_lines: [ { client_id: client_a.id, minutes: 30 } ]
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json[:error]).to include("Work lines add up to 30m")
    expect(entry.reload.status).to eq("clocked_in")
  end
  it "returns 422, not 500, for work lines on an entry with a start time but no end time" do
    post "/api/v1/time_entries", params: {
      time_entry: { work_date: work_date.iso8601, start_time: "08:00", work_lines: [ { client_id: client_a.id, minutes: 60 } ] }
    }.to_json, headers: headers_for(employee)

    expect(response).to have_http_status(:unprocessable_entity)
    expect(json[:error]).to include("start and end times")
  end

  it "accepts JSON Float hours at the clock-out tolerance boundary" do
    post "/api/v1/time_entries/clock_in", headers: headers_for(employee)
    entry = TimeEntry.clocked_in.find_by!(user: employee)
    started = 1.hour.ago
    entry.update_columns(clock_in_at: started, start_time: started.in_time_zone(TimeClockService::BUSINESS_TIMEZONE))

    post "/api/v1/time_entries/clock_out", params: { time_entry_id: entry.id, work_lines: [ { client_id: client_a.id, hours: 1.1 } ] }.to_json,
                                           headers: headers_for(employee)

    expect(response).to have_http_status(:ok)
    expect(json.dig(:time_entry, :work_lines, 0, :hours)).to eq(json.dig(:time_entry, :hours))
  end

  it "locks the entry while replacing its work lines" do
    entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "approved")
    expect_any_instance_of(TimeEntry).to receive(:lock!).and_call_original

    patch "/api/v1/time_entries/#{entry.id}", params: {
      time_entry: { work_lines: [ { client_id: client_a.id, minutes: 240 }, { client_id: client_b.id, minutes: 240 } ] }
    }.to_json, headers: headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(entry.work_lines.reload.size).to eq(2)
  end

  describe "row locking on every path that can change work lines" do
    let(:pending_entry) { create(:time_entry, user: employee, work_date: work_date, approval_status: "pending") }
    let(:locked_ids) { [] }

    before do
      ids = locked_ids
      allow_any_instance_of(TimeEntry).to receive(:lock_for_work_lines!).and_wrap_original do |original, *args|
        ids << original.receiver.id
        original.call(*args)
      end
    end

    it "locks before approving, denying and deleting" do
      other = create(:time_entry, user: employee, work_date: work_date, approval_status: "pending")

      post "/api/v1/time_entries/#{pending_entry.id}/approve", headers: headers_for(admin)
      expect(response).to have_http_status(:ok)
      post "/api/v1/time_entries/#{other.id}/deny", headers: headers_for(admin)
      expect(response).to have_http_status(:ok)
      delete "/api/v1/time_entries/#{other.id}", headers: headers_for(admin)
      expect(response).to have_http_status(:no_content)

      expect(locked_ids).to eq([ pending_entry.id, other.id, other.id ])
    end

    it "locks before clocking out and before auto-closing a stale clock" do
      post "/api/v1/time_entries/clock_in", headers: headers_for(employee)
      clocked = TimeEntry.clocked_in.find_by!(user: employee)
      post "/api/v1/time_entries/clock_out", headers: headers_for(employee)
      expect(response).to have_http_status(:ok)

      stale = TimeEntry.create!(user: other_user, work_date: Date.current, start_time: 13.hours.ago, clock_in_at: 13.hours.ago,
                                entry_method: "clock", status: "clocked_in", hours: 0)
      TimeClockService.flag_stale_entries
      expect(stale.reload.status).to eq("completed")

      expect(locked_ids).to eq([ clocked.id, stale.id ])
    end

    it "refuses to run outside a transaction" do
      entry = create(:time_entry, user: employee, work_date: work_date)
      allow(TimeEntry.connection).to receive(:transaction_open?).and_return(false)
      expect { entry.lock_for_work_lines! }.to raise_error(ActiveRecord::TransactionIsolationError)
    end
  end

  it "locks entries for bulk approval in id order" do
    entries = Array.new(3) { create(:time_entry, user: employee, work_date: work_date, approval_status: "pending") }
    queries = []
    subscriber = ActiveSupport::Notifications.subscribe("sql.active_record") do |*, payload|
      queries << payload[:sql] if payload[:sql].include?("FOR UPDATE") && payload[:sql].include?('"time_entries"')
    end
    post "/api/v1/time_entries/bulk_approve", params: { entry_ids: entries.map(&:id).reverse }.to_json, headers: headers_for(admin)
    ActiveSupport::Notifications.unsubscribe(subscriber)

    expect(response).to have_http_status(:ok)
    bulk_lock = queries.find { |sql| sql.include?("IN (") }
    expect(bulk_lock).to match(/ORDER BY "time_entries"\."id" ASC.*FOR UPDATE/m)
  end
  it "accepts exact_hours for unchanged lines through the API" do
    entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "approved")
    entry.work_lines_input = [ { client_id: client_a.id, minutes: 160 }, { client_id: client_b.id, minutes: 160 }, { client_id: client_a.id, minutes: 160 } ]
    entry.save!
    stored = entry.work_lines.map { |line| line.hours.to_f }

    patch "/api/v1/time_entries/#{entry.id}", params: {
      time_entry: { work_lines: [ { client_id: client_a.id, minutes: 100 }, { client_id: client_b.id, minutes: 220 },
                                  { client_id: client_a.id, exact_hours: stored[2] } ] }
    }.to_json, headers: headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(json.dig(:time_entry, :work_lines).map { |line| line[:hours] }.last).to eq(stored[2])
  end

  it "suggests the person's recent clients and descriptions" do
    entry = create(:time_entry, user: employee, work_date: Date.current - 2, approval_status: "approved")
    entry.work_lines_input = [ { client_id: client_a.id, description: "Bank recs", minutes: 240 },
                               { client_id: client_b.id, description: "Payroll inputs", minutes: 120 },
                               { client_id: client_a.id, description: "Credit card recs", minutes: 120 } ]
    entry.save!
    create(:time_entry, user: admin, work_date: Date.current - 1, client: client_b, description: "Not mine")

    get "/api/v1/time_entries/work_line_suggestions", headers: headers_for(employee)

    expect(response).to have_http_status(:ok)
    expect(json[:recent_clients].map { |client| client[:name] }).to eq([ "Alpha Co", "Beta Co" ])
    expect(json[:descriptions_by_client][client_a.id.to_s.to_sym]).to contain_exactly("Bank recs", "Credit card recs")
    expect(json[:descriptions_by_client].values.flatten).not_to include("Not mine")
  end

  describe "work-only edits leave attendance alone" do
    let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
    let!(:clock_entry) do
      start = tz.parse("#{work_date} 08:00:01")
      finish = tz.parse("#{work_date} 08:07:59")
      record = TimeEntry.create!(user: employee, work_date: work_date, entry_method: "clock", status: "completed",
                                 start_time: start, end_time: finish, clock_in_at: start, clock_out_at: finish,
                                 approval_status: "approved", approved_by: admin, approved_at: 1.hour.ago, client: client_a)
      record
    end

    it "keeps clock seconds, hours and approval when only work lines are sent" do
      expect(clock_entry.hours).to eq(BigDecimal("0.13"))

      patch "/api/v1/time_entries/#{clock_entry.id}", params: {
        time_entry: { work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 8 } ] }
      }.to_json, headers: headers_for(employee)

      expect(response).to have_http_status(:ok)
      clock_entry.reload
      expect(clock_entry.hours).to eq(BigDecimal("0.13"))
      expect(clock_entry.clock_in_at.sec).to eq(1)
      expect(clock_entry.approval_status).to eq("approved")
      expect(clock_entry.work_lines.sole).to have_attributes(description: "Bank recs", hours: BigDecimal("0.13"))
    end

    it "ignores unchanged HH:MM times an older form resends, so seconds are not truncated" do
      patch "/api/v1/time_entries/#{clock_entry.id}", params: {
        time_entry: { work_date: work_date.iso8601, start_time: "08:00", end_time: "08:07",
                      work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 8 } ] }
      }.to_json, headers: headers_for(employee)

      expect(response).to have_http_status(:ok)
      clock_entry.reload
      expect([ clock_entry.hours, clock_entry.clock_in_at.sec, clock_entry.clock_out_at.sec ]).to eq([ BigDecimal("0.13"), 1, 59 ])
      expect(clock_entry.approval_status).to eq("approved")
    end

    it "still applies a real time correction" do
      patch "/api/v1/time_entries/#{clock_entry.id}", params: { time_entry: { end_time: "08:30" } }.to_json, headers: headers_for(employee)

      expect(response).to have_http_status(:ok)
      expect(clock_entry.reload.clock_out_at.in_time_zone(tz).strftime("%H:%M:%S")).to eq("08:30:00")
      expect(clock_entry.approval_status).to eq("pending")
    end
  end

  it "keeps per-client hours when a scaled split is resubmitted with its stored hours" do
    tz = ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE]
    entry = TimeEntry.new(user: employee, work_date: work_date, entry_method: "clock", approval_status: nil,
                          start_time: tz.parse("#{work_date} 09:00"), end_time: tz.parse("#{work_date} 09:07"))
    entry.work_lines_input = Array.new(6) { |index| { client_id: index.even? ? client_a.id : client_b.id, description: "Step #{index}", minutes: 1 } }
    entry.work_lines_tolerance_minutes = WorkLineHours::CLOCK_OUT_TOLERANCE_MINUTES
    entry.save!
    per_client = ->(record) { record.work_lines.reload.group_by(&:client_id).transform_values { |rows| rows.sum(&:hours) } }
    hours_before = per_client.call(entry)

    lines = entry.work_lines.map do |line|
      { client_id: line.client_id, description: line.position == 1 ? "Filed checks" : line.description, hours: line.hours.to_f }
    end
    patch "/api/v1/time_entries/#{entry.id}", params: { time_entry: { work_lines: lines } }.to_json, headers: headers_for(admin)

    expect(response).to have_http_status(:ok)
    expect(entry.work_lines.reload.map { |line| line.hours.to_f }).to eq([ 0.02 ] * 6)
    expect(per_client.call(entry)).to eq(hours_before)
  end
end
