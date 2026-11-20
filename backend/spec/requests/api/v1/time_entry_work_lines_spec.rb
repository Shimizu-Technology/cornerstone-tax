# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Time entry work lines API", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee) }
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
end
