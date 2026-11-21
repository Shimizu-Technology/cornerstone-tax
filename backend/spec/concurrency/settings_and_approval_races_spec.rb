# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("spec/support/concurrency_helpers").to_s

# Races found in review of the time tracking settings (#69). Each example
# runs real requests on their own threads and database connections.
RSpec.describe "Settings and approval races", type: :request do
  self.use_transactional_tests = false
  include ConcurrencyHelpers

  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let!(:admin) { User.create!(email: "race-admin-#{SecureRandom.hex(4)}@example.test", clerk_id: "race_#{SecureRandom.hex(4)}", first_name: "R", last_name: "Admin", role: "admin") }
  let!(:staff) { User.create!(email: "race-staff-#{SecureRandom.hex(4)}@example.test", clerk_id: "race_s_#{SecureRandom.hex(4)}", first_name: "R", last_name: "Staff", role: "employee") }

  after do
    entry_ids = TimeEntry.where(user_id: staff.id).pluck(:id)
    AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry_ids).delete_all
    AuditLog.where(auditable_type: "User", auditable_id: [ staff.id, admin.id ]).delete_all
    TimeEntry.where(id: entry_ids).delete_all
    Setting.where(key: %w[time_pay_schedule time_pay_period_anchor]).delete_all
    User.where(id: [ staff.id, admin.id ]).delete_all
  end

  def call(method, path, body = nil)
    env = Rack::MockRequest.env_for(path, method: method, input: body&.to_json, "CONTENT_TYPE" => "application/json",
                                          "HTTP_AUTHORIZATION" => "Bearer test_token_#{admin.id}", "HTTP_HOST" => "www.example.com")
    status, _headers, response = Rails.application.call(env)
    text = +""
    response.each { |part| text << part }
    response.close if response.respond_to?(:close)
    [ status, text.present? ? JSON.parse(text) : {} ]
  end

  before do
    # Routes load lazily in the test environment; load them before racing.
    call("GET", "/api/v1/admin/settings")
  end

  it "rechecks the pay schedule's anchor against a save that commits first" do
    Setting.set("time_pay_schedule", "semi_monthly")
    Setting.set("time_pay_period_anchor", "2026-10-18")
    saving = nil

    # Another admin is clearing the anchor; this save relies on it.
    while_holding(-> { Setting.serialize_updates!; Setting.set("time_pay_period_anchor", "") }) do
      saving = Thread.new { call("PUT", "/api/v1/admin/settings", { time_pay_schedule: "weekly" }) }
      expect(wait_for_lock_waiters).to be(true)
    end
    status, body = saving.join(10)&.value

    expect(status).to eq(422)
    expect(body["error"]).to include("Choose the first day of a pay period")
    expect(Setting.get("time_pay_schedule")).to eq("semi_monthly")
  end

  it "audits only the flexible-hours change that actually happened" do
    switching = nil

    # Another admin has just switched it on and hasn't committed yet.
    while_holding(-> { User.lock(User::ROW_MUTEX).find(staff.id).update!(flexible_hours: true) }) do
      switching = Thread.new { call("PATCH", "/api/v1/admin/users/#{staff.id}", { flexible_hours: true }) }
      expect(wait_for_lock_waiters).to be(true)
    end
    status, = switching.join(10)&.value

    expect(status).to eq(200)
    expect(staff.reload.flexible_hours).to be(true)
    expect(AuditLog.where(auditable_type: "User", auditable_id: staff.id)).to be_empty
  end

  # "Approve unscheduled-only" confirms are already serialized with each
  # other (TimePeriodLock.serialize_with_approvals!); the race is with the
  # other approval paths, here "Approve selected".
  describe "two bulk approvals for the same person's week" do
    # Holds each request where it reads the approved hours, for up to 1.5s,
    # so without per-person serialization both read the same total.
    class OvertimeReadBarrier
      def initialize(parties, timeout)
        @parties = parties
        @timeout = timeout
        @arrived = 0
        @mutex = Mutex.new
        @condition = ConditionVariable.new
      end

      def wait
        @mutex.synchronize do
          @arrived += 1
          if @arrived >= @parties
            @condition.broadcast
          else
            deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + @timeout
            while @arrived < @parties
              remaining = deadline - Process.clock_gettime(Process::CLOCK_MONOTONIC)
              break if remaining <= 0

              @condition.wait(@mutex, remaining)
            end
          end
        end
      end
    end

    def clock_entry(date, hours, approval_status:, note: nil)
      start = tz.parse("#{date} 08:00")
      TimeEntry.create!(user: staff, work_date: Date.iso8601(date), entry_method: "clock", status: "completed", start_time: start,
                        end_time: start + hours.hours, hours: hours, approval_status: approval_status, approval_note: note,
                        overtime_status: "none", unscheduled_clock_in: note.present?)
    end

    it "flags weekly overtime on the second approval" do
      # 32 approved hours Mon-Thu, then two unscheduled 6-hour days: 44 > 40.
      %w[2026-11-09 2026-11-10 2026-11-11 2026-11-12].each { |date| clock_entry(date, 8, approval_status: "approved") }
      first = clock_entry("2026-11-13", 6, approval_status: "pending", note: TimeClockService::UNSCHEDULED_NOTE)
      second = clock_entry("2026-11-14", 6, approval_status: "pending", note: "Employee corrected clock-out time to 02:00 PM")

      barrier = OvertimeReadBarrier.new(2, 1.5)
      allow_any_instance_of(Api::V1::TimeEntriesController).to receive(:build_bulk_overtime_context).and_wrap_original do |original, *args|
        barrier.wait
        original.call(*args)
      end

      results = [
        Thread.new { call("POST", "/api/v1/time_entries/approve_unscheduled_only", { entries: [ { id: first.id, version: first.work_version } ] }) },
        Thread.new { call("POST", "/api/v1/time_entries/bulk_approve", { entry_ids: [ second.id ] }) }
      ].map { |thread| thread.join(15)&.value }

      expect(results.map(&:first)).to eq([ 200, 200 ])
      statuses = [ first.reload, second.reload ].map { |entry| [ entry.approval_status, entry.overtime_status ] }
      expect(statuses).to contain_exactly([ "approved", "none" ], [ "approved", "pending" ])
    end
  end
end
