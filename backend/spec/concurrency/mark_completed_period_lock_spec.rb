# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("spec/support/concurrency_helpers").to_s

# "Mark completed" takes the same period-lock guard as locking a period and
# bulk approval (TimePeriodLock.serialize_with_approvals!). A period being
# locked while the request runs is waited for, then refuses it.
RSpec.describe "Mark completed racing a period lock", type: :request do
  self.use_transactional_tests = false
  include ConcurrencyHelpers

  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let!(:admin) { User.create!(email: "mc-admin-#{SecureRandom.hex(4)}@example.test", clerk_id: "mc_#{SecureRandom.hex(4)}", first_name: "M", last_name: "Admin", role: "admin") }
  let!(:staff) { User.create!(email: "mc-staff-#{SecureRandom.hex(4)}@example.test", clerk_id: "mc_s_#{SecureRandom.hex(4)}", first_name: "M", last_name: "Staff", role: "employee") }
  let!(:stuck) do
    start = tz.parse("2026-04-27 09:00")
    entry = TimeEntry.create!(user: staff, work_date: Date.new(2026, 4, 27), entry_method: "clock", status: "clocked_in",
                              start_time: start, clock_in_at: start, hours: 0)
    entry.update_columns(end_time: tz.parse("2026-04-27 12:38"), hours: 3.63)
    entry
  end

  after do
    lock_ids = TimePeriodLock.where(locked_by_id: admin.id).pluck(:id)
    AuditLog.where(auditable_type: "TimeEntry", auditable_id: stuck.id).delete_all
    TimePeriodLock.where(id: lock_ids).delete_all
    TimeEntry.where(id: stuck.id).delete_all
    User.where(id: [ staff.id, admin.id ]).delete_all
  end

  def call(method, path)
    env = Rack::MockRequest.env_for(path, method: method, "CONTENT_TYPE" => "application/json",
                                          "HTTP_AUTHORIZATION" => "Bearer test_token_#{admin.id}", "HTTP_HOST" => "www.example.com")
    status, _headers, response = Rails.application.call(env)
    text = +""
    response.each { |part| text << part }
    response.close if response.respond_to?(:close)
    [ status, text.present? ? JSON.parse(text) : {} ]
  end

  before do
    # Routes load lazily in the test environment; load them before racing.
    call("GET", "/api/v1/time_entries/stuck_clock_entries")
  end

  it "waits for the period being locked, then refuses" do
    marking = nil
    lock_period = lambda do
      TimePeriodLock.serialize_with_approvals!
      TimePeriodLock.create!(start_date: Date.new(2026, 4, 26), end_date: Date.new(2026, 5, 2), locked_at: Time.current, locked_by: admin)
    end

    while_holding(lock_period) do
      # The lock isn't committed yet, so the controller's early check passes.
      marking = Thread.new { call("POST", "/api/v1/time_entries/#{stuck.id}/mark_completed") }
      expect(wait_for_lock_waiters).to be(true)
    end
    status, body = marking.join(15)&.value

    expect(status).to eq(403)
    expect(body["error"]).to include("time period is locked")
    expect(stuck.reload.status).to eq("clocked_in")
  end
end
