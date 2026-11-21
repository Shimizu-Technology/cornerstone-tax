# frozen_string_literal: true

require "rails_helper"

# Entries left clocked in with an end time (an April 2026 edit path set the
# end time on an open clock entry without completing it). They never count,
# block the person's clock and were invisible to the admin fix-up paths.
RSpec.describe "Stuck clock entries", type: :request do
  let(:admin) { create(:user, :admin) }
  let(:staff) { create(:user, :employee, first_name: "Sam", last_name: "Stuck") }
  let(:guam) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }

  def headers_for(user)
    { "Authorization" => "Bearer test_token_#{user.id}", "Content-Type" => "application/json" }
  end

  def json
    JSON.parse(response.body, symbolize_names: true)
  end

  # An open clock entry from 09:00 on the date, optionally with the end time
  # (and hours) an old edit wrote straight to the row.
  # (One open entry per person: pass another user for a second one.)
  def clock_entry(date: "2026-04-27", end_at: nil, hours: 0, status: "clocked_in", user: staff)
    start = guam.parse("#{date} 09:00")
    entry = TimeEntry.create!(user: user, work_date: Date.iso8601(date), entry_method: "clock", status: status,
                              start_time: start, clock_in_at: start, hours: 0)
    entry.update_columns(end_time: guam.parse("#{date} #{end_at}"), hours: hours) if end_at
    entry.reload
  end

  describe "prevention" do
    it "refuses an end time on an entry that is still clocked in" do
      entry = clock_entry

      expect(entry.update(end_time: guam.parse("2026-04-27 12:38"))).to be(false)
      expect(entry.errors[:end_time].first).to start_with("can't be set while the entry is still clocked in")
    end

    it "refuses a new clocked-in entry that already has an end time" do
      start = guam.parse("2026-04-27 09:00")
      entry = TimeEntry.new(user: staff, work_date: Date.new(2026, 4, 27), entry_method: "clock", status: "clocked_in",
                            start_time: start, clock_in_at: start, end_time: start + 3.hours)

      expect(entry).not_to be_valid
      expect(entry.errors[:end_time]).to be_present
    end

    it "ignores an end time sent when editing an open clock entry" do
      entry = clock_entry

      patch "/api/v1/time_entries/#{entry.id}", params: { time_entry: { end_time: "12:38", description: "Still working" } }.to_json,
                                                headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(entry.reload).to have_attributes(status: "clocked_in", end_time: nil, description: "Still working")
    end

    it "still lets a stuck entry be edited in other ways" do
      entry = clock_entry(end_at: "12:38", hours: 3.63)

      expect(entry.update(description: "Note added")).to be(true)
    end

    it "leaves stuck entries to admins in the stale clock job, and still closes ordinary stale clocks" do
      stuck = clock_entry(end_at: "12:38", hours: 3.63)
      open_entry = TimeEntry.create!(user: create(:user, :employee), work_date: Date.new(2026, 4, 28), entry_method: "clock",
                                     status: "clocked_in", start_time: guam.parse("2026-04-28 09:00"), clock_in_at: guam.parse("2026-04-28 09:00"), hours: 0)

      TimeClockService.flag_stale_entries

      expect(stuck.reload).to have_attributes(status: "clocked_in", formatted_end_time: "12:38 PM", hours: 3.63)
      expect(open_entry.reload.status).to eq("completed")
    end
  end

  describe "GET /api/v1/time_entries/stuck_clock_entries" do
    it "lists only entries left clocked in with an end time" do
      stuck = clock_entry(end_at: "12:38", hours: 3.63)
      clock_entry(date: "2026-11-20", user: create(:user, :employee))
      create(:time_entry, user: staff)

      get "/api/v1/time_entries/stuck_clock_entries", headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(json[:time_entries].map { |row| row[:id] }).to eq([ stuck.id ])
      expect(json[:time_entries].first).to include(status: "clocked_in", hours: 3.63, formatted_end_time: "12:38 PM")
    end

    it "is admin-only" do
      get "/api/v1/time_entries/stuck_clock_entries", headers: headers_for(staff)

      expect(response).to have_http_status(:forbidden)
    end
  end

  describe "POST /api/v1/time_entries/:id/mark_completed" do
    it "completes the entry with its own end time and hours, sends it to approval, versions and audits it" do
      entry = clock_entry(end_at: "12:38", hours: 3.63)
      version = entry.work_version

      post "/api/v1/time_entries/#{entry.id}/mark_completed", params: { expected_version: version }.to_json, headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      entry.reload
      expect(entry).to have_attributes(status: "completed", hours: 3.63, formatted_end_time: "12:38 PM",
                                       clock_out_at: guam.parse("2026-04-27 12:38"), approval_status: "pending",
                                       approval_note: TimeClockService::STUCK_COMPLETED_NOTE, overtime_status: "none")
      expect(entry.work_version).to be > version
      log = AuditLog.where(auditable: entry).sole
      expect(log).to have_attributes(action: "updated", user_id: admin.id, metadata: "Marked completed (was left clocked in with an end time)")
      expect(log.changes_made).to include("status" => { "from" => "clocked_in", "to" => "completed" },
                                          "approval_status" => { "from" => nil, "to" => "pending" })
      expect(json.dig(:time_entry, :status)).to eq("completed")
    end

    it "closes an open break at the end time" do
      entry = clock_entry(end_at: "12:38", hours: 3.63)
      entry.update_columns(status: "on_break")
      entry.time_entry_breaks.create!(start_time: guam.parse("2026-04-27 12:00"))

      post "/api/v1/time_entries/#{entry.id}/mark_completed", headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(entry.reload).to have_attributes(status: "completed", break_minutes: 38, hours: 3.0)
      expect(entry.time_entry_breaks.sole.end_time).to eq(guam.parse("2026-04-27 12:38"))
    end

    it "puts an overnight end time on the next day" do
      entry = clock_entry(end_at: "02:00", hours: 17.0)
      entry.update_columns(start_time: guam.parse("2026-04-27 21:00"), clock_in_at: guam.parse("2026-04-27 21:00"))

      post "/api/v1/time_entries/#{entry.id}/mark_completed", headers: headers_for(admin)

      expect(response).to have_http_status(:ok)
      expect(entry.reload).to have_attributes(status: "completed", hours: 5.0, clock_out_at: guam.parse("2026-04-28 02:00"))
    end

    it "refuses entries that aren't stuck, a stale version, staff and locked periods" do
      open_entry = clock_entry(date: "2026-11-20", user: create(:user, :employee))
      post "/api/v1/time_entries/#{open_entry.id}/mark_completed", headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(open_entry.reload.status).to eq("clocked_in")

      stuck = clock_entry(end_at: "12:38", hours: 3.63)
      post "/api/v1/time_entries/#{stuck.id}/mark_completed", params: { expected_version: stuck.work_version + 1 }.to_json, headers: headers_for(admin)
      expect(response).to have_http_status(:unprocessable_entity)
      expect(json[:error]).to include("changed since you loaded it")

      post "/api/v1/time_entries/#{stuck.id}/mark_completed", headers: headers_for(staff)
      expect(response).to have_http_status(:forbidden)

      TimePeriodLock.create!(start_date: Date.new(2026, 4, 26), end_date: Date.new(2026, 5, 2), locked_at: Time.current, locked_by: admin)
      post "/api/v1/time_entries/#{stuck.id}/mark_completed", headers: headers_for(admin)
      expect(response).to have_http_status(:forbidden)
      expect(stuck.reload.status).to eq("clocked_in")
    end

    it "frees the person's clock" do
      stuck = clock_entry(end_at: "12:38", hours: 3.63)
      post "/api/v1/time_entries/clock_in", headers: headers_for(staff)
      expect(response).to have_http_status(:unprocessable_entity)

      post "/api/v1/time_entries/#{stuck.id}/mark_completed", headers: headers_for(admin)
      post "/api/v1/time_entries/clock_in", headers: headers_for(staff)

      expect(response).to have_http_status(:created)
    end
  end
end
