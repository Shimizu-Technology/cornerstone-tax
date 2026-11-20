# frozen_string_literal: true

require "rails_helper"
require "csv"

RSpec.describe "Work summary", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:staff) { create(:user, :employee, first_name: "Sam", last_name: "Staff") }
  let(:other) { create(:user, :employee) }
  let(:alpha) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:beta) { Client.create!(first_name: "B", last_name: "B", client_type: "business", business_name: "Beta Co") }
  let(:monday) { Date.new(2026, 11, 16) }

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}" }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def day_log(user, date, lines, **attrs)
    entry = TimeEntry.new({ user: user, work_date: date, entry_method: "manual", approval_status: "approved" }.merge(attrs))
    entry.work_lines_input = lines
    entry.save!
    entry
  end

  before do
    day_log(staff, monday, [
      { client_id: alpha.id, description: "Prepared bank reconciliations", minutes: 45 },
      { client_id: beta.id, description: "Reconciled cc accounts", minutes: 20 },
      { client_id: nil, description: "Weekly meeting", minutes: 30 }
    ])
    day_log(staff, monday + 1, [ { client_id: alpha.id, description: "Payroll inputs", minutes: 90 } ], approval_status: "pending")
    day_log(staff, monday + 2, [ { client_id: beta.id, description: "Rejected", minutes: 60 } ], approval_status: "denied")
    day_log(other, monday, [ { client_id: beta.id, description: "Not Sam's", minutes: 60 } ])
  end

  let(:range) { { start_date: monday.iso8601, end_date: (monday + 13).iso8601 } }

  it "lists each day's lines and totals per client in hours and minutes" do
    get "/api/v1/work_summary", params: range, headers: headers_for(staff)

    expect(response).to have_http_status(:ok)
    expect(json[:days].map { |day| [ day[:work_date], day[:lines].map { |line| [ line[:client_name], line[:minutes] ] }, day[:total_label] ] }).to eq([
      [ "2026-11-16", [ [ "Alpha Co", 45 ], [ "Beta Co", 20 ], [ "Unassigned", 30 ] ], "1h 35m" ],
      [ "2026-11-17", [ [ "Alpha Co", 90 ] ], "1h 30m" ]
    ])
    expect(json[:days].last[:lines].first[:approval_state]).to eq("pending")
    expect(json[:clients].map { |row| row.values_at(:client_name, :minutes, :label) }).to eq([
      [ "Alpha Co", 135, "2h 15m" ], [ "Unassigned", 30, "30m" ], [ "Beta Co", 20, "20m" ]
    ])
    expect(json.values_at(:total_minutes, :total_label)).to eq([ 185, "3h 5m" ])
    expect(json[:counts]).to include(pending_entries: 1, denied_entries: 1, unassigned_minutes: 30)
  end

  it "downloads CSV and PDF" do
    get "/api/v1/work_summary/csv", params: range, headers: headers_for(staff)
    expect(response).to have_http_status(:ok)
    expect(response.headers["Content-Disposition"]).to include("Work_Summary_sam-staff_2026-11-16_to_2026-11-29.csv")
    rows = CSV.parse(response.body)
    expect(rows).to include([ "2026-11-16", nil, "Alpha Co", "Prepared bank reconciliations", nil, nil, nil, "45", "0.75", "approved" ])
    expect(rows).to include([ "Alpha Co", nil, nil, nil, nil, nil, nil, "135", "2.25", "2h 15m" ])
    expect(rows.last).to eq([ "Total", nil, nil, nil, nil, nil, nil, "185", "3.08", "3h 5m" ])

    get "/api/v1/work_summary/pdf", params: range, headers: headers_for(staff)
    expect(response).to have_http_status(:ok)
    expect(response.body).to start_with("%PDF")
  end

  it "lets admins see anyone and keeps staff to their own" do
    get "/api/v1/work_summary", params: range.merge(user_id: staff.id), headers: headers_for(admin)
    expect(json.dig(:user, :full_name)).to eq("Sam Staff")

    get "/api/v1/work_summary", params: range.merge(user_id: staff.id), headers: headers_for(other)
    expect(response).to have_http_status(:forbidden)

    get "/api/v1/work_summary", params: range.merge(user_id: other.id), headers: headers_for(other)
    expect(json[:days].flat_map { |day| day[:lines] }.map { |line| line[:description] }).to eq([ "Not Sam's" ])
  end

  it "rejects bad ranges" do
    get "/api/v1/work_summary", params: { start_date: "2026-01-01", end_date: "2026-06-01" }, headers: headers_for(staff)
    expect(response).to have_http_status(:unprocessable_entity)
  end
end
