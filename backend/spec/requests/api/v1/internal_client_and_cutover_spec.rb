# frozen_string_literal: true

require "rails_helper"

RSpec.describe "Internal client and work details cutover", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:employee) { create(:user, :employee) }
  let!(:internal) { Client.ensure_internal! }
  let(:client_a) { Client.create!(first_name: "A", last_name: "A", client_type: "business", business_name: "Alpha Co") }
  let(:person) { Client.create!(first_name: "Pat", last_name: "Person") }
  let(:office) { ServiceType.create!(name: "Office & errands", internal: true) }
  let(:work_date) { Date.new(2026, 11, 16) }

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}", "Content-Type" => "application/json" }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  def manual(lines, date: work_date, user: employee)
    post "/api/v1/time_entries", params: {
      time_entry: { work_date: date.iso8601, start_time: "09:00", end_time: "10:00", work_lines: lines }
    }.to_json, headers: headers_for(user)
  end

  describe "the internal client" do
    it "is pinned first in pickers, ahead of businesses and individuals" do
      client_a
      person
      get "/api/v1/clients/options", headers: headers_for(employee)

      expect(json[:clients].map { |row| row[:name] }).to eq([ "Internal – Cornerstone", "Alpha Co", "Pat Person" ])
      expect(json[:clients].first[:system_kind]).to eq("internal")
    end

    it "can't be renamed, archived or deleted" do
      expect(internal.update(business_name: "Something else")).to be(false)
      expect(internal.reload.update(archived_at: Time.current)).to be(false)
      expect(internal.reload.destroy).to be(false)
      expect(Client.internal).to be_present

      post "/api/v1/clients/#{internal.id}/archive", headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(internal.reload.archived_at).to be_nil
    end

    it "is created only once" do
      expect(Client.ensure_internal!).to eq(internal)
      expect(Client.where(system_kind: "internal").count).to eq(1)
    end
  end

  describe "with the cutover off (the default)" do
    it "accepts lines without a client or description" do
      manual([ { minutes: 60 } ])
      expect(response).to have_http_status(:created)
    end
  end

  describe "with the cutover set" do
    before { Setting.set(TimeEntryWorkRequirement::SETTING_KEY, work_date.iso8601) }

    it "requires a client and a description on every line" do
      manual([ { client_id: client_a.id, description: "Bank recs", minutes: 30 }, { minutes: 30 } ])

      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("Line 2 needs client and description")
    end

    it "requires a category only for internal work" do
      manual([ { client_id: client_a.id, description: "Bank recs", minutes: 30 },
               { client_id: internal.id, description: "Post office run", minutes: 30 } ])
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("Line 2 needs category")

      manual([ { client_id: client_a.id, description: "Bank recs", minutes: 30 },
               { client_id: internal.id, description: "Post office run", service_type_id: office.id, minutes: 30 } ])
      expect(response).to have_http_status(:created)
    end

    it "does not apply to entries dated before the cutover" do
      manual([ { minutes: 60 } ], date: work_date - 1)
      expect(response).to have_http_status(:created)
    end

    it "is enforced at clock-out and keeps the clock running" do
      Setting.set(TimeEntryWorkRequirement::SETTING_KEY, Date.current.iso8601)
      post "/api/v1/time_entries/clock_in", headers: headers_for(employee)
      entry = TimeEntry.clocked_in.find_by!(user: employee)
      entry.update_columns(clock_in_at: 1.hour.ago, start_time: 1.hour.ago.in_time_zone(TimeClockService::BUSINESS_TIMEZONE))

      post "/api/v1/time_entries/clock_out", params: { time_entry_id: entry.id }.to_json, headers: headers_for(employee)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("needs client and description")
      expect(entry.reload.status).to eq("clocked_in")

      post "/api/v1/time_entries/clock_out", params: {
        time_entry_id: entry.id, work_lines: [ { client_id: client_a.id, description: "Payroll inputs", minutes: 60 } ]
      }.to_json, headers: headers_for(employee)
      expect(response).to have_http_status(:ok)
    end

    it "is enforced on edit and on approval, single and bulk" do
      entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "pending", description: nil)

      patch "/api/v1/time_entries/#{entry.id}", params: { time_entry: { end_time: "16:00" } }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/time_entries/#{entry.id}/approve", headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("can't be approved yet: This entry needs client and description")

      post "/api/v1/time_entries/bulk_approve", params: { entry_ids: [ entry.id ] }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(entry.reload.approval_status).to eq("pending")

      patch "/api/v1/time_entries/#{entry.id}", params: {
        time_entry: { work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 480 } ] }
      }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:ok)

      post "/api/v1/time_entries/#{entry.id}/approve", headers: headers_for(admin)
      expect(response).to have_http_status(:ok)
    end

    it "does not block the stale-clock auto-close job" do
      Setting.set(TimeEntryWorkRequirement::SETTING_KEY, (Date.current - 2).iso8601)
      entry = TimeEntry.create!(user: employee, work_date: Date.current, start_time: 13.hours.ago, clock_in_at: 13.hours.ago,
                                entry_method: "clock", status: "clocked_in", hours: 0)

      expect(TimeClockService.flag_stale_entries).to eq(1)
      expect(entry.reload).to have_attributes(status: "completed", approval_status: "pending")
    end

    it "rejects an invalid cutover date in settings" do
      put "/api/v1/admin/settings", params: { time_work_details_required_from: "next week" }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)

      put "/api/v1/admin/settings", params: { time_work_details_required_from: "" }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:ok)
      expect(TimeEntryWorkRequirement.cutover_date).to be_nil
    end
  end

  describe "staff edits and re-approval" do
    it "keeps an approved entry approved when only its lines change, and re-queues it when hours change" do
      entry = create(:time_entry, user: employee, work_date: work_date, approval_status: "approved", approved_by: admin)

      patch "/api/v1/time_entries/#{entry.id}", params: {
        time_entry: { work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 300 },
                                    { client_id: internal.id, description: "Meeting", service_type_id: office.id, minutes: 180 } ] }
      }.to_json, headers: headers_for(employee)
      expect(response).to have_http_status(:ok)
      expect(entry.reload.approval_status).to eq("approved")

      patch "/api/v1/time_entries/#{entry.id}", params: {
        time_entry: { end_time: "18:00", work_lines: [ { client_id: client_a.id, description: "Bank recs", minutes: 540 } ] }
      }.to_json, headers: headers_for(employee)
      expect(response).to have_http_status(:ok)
      expect(entry.reload.approval_status).to eq("pending")
    end
  end

  describe "GET /api/v1/time_entries/unassigned" do
    let!(:unassigned) { create(:time_entry, user: employee, work_date: work_date, approval_status: "approved", client: nil) }
    let!(:assigned) { create(:time_entry, user: employee, work_date: work_date + 1, approval_status: "approved", client: client_a) }
    let!(:denied) { create(:time_entry, user: employee, work_date: work_date, approval_status: "denied", client: nil) }
    let!(:split) do
      entry = create(:time_entry, user: admin, work_date: work_date + 2, approval_status: "approved")
      entry.work_lines_input = [ { client_id: client_a.id, description: "Recs", minutes: 360 }, { description: "Errands", minutes: 120 } ]
      entry.save!
      entry
    end

    it "lists entries with client-less lines, by date and person, for admins" do
      get "/api/v1/time_entries/unassigned", headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json[:time_entries].map { |row| row[:id] }).to contain_exactly(unassigned.id, split.id)
      expect(json.dig(:summary, :hours)).to eq(10.0)
      expect(json.dig(:summary, :by_user).map { |row| row[:hours] }).to eq([ 8.0, 2.0 ])
      split_row = json[:time_entries].find { |row| row[:id] == split.id }
      expect(split_row[:line_issues].map { |issue| issue[:missing] }).to eq([ [], [ "client" ] ])

      get "/api/v1/time_entries/unassigned", params: { user_id: admin.id, start_date: (work_date + 1).iso8601 }, headers: headers_for(admin)
      expect(json[:time_entries].map { |row| row[:id] }).to eq([ split.id ])
    end

    it "can include lines missing a description" do
      assigned.update!(description: nil)
      get "/api/v1/time_entries/unassigned", params: { issue: "any" }, headers: headers_for(admin)
      expect(json[:time_entries].map { |row| row[:id] }).to include(assigned.id)
    end

    it "is admin-only" do
      get "/api/v1/time_entries/unassigned", headers: headers_for(employee)
      expect(response).to have_http_status(:forbidden)
    end
  end
end
