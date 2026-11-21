# frozen_string_literal: true

require "rails_helper"

# Locking a time period and "Approve unscheduled-only entries" take the same
# advisory lock (TimePeriodLock.serialize_with_approvals!). Each example holds
# one side open on its own connection and checks the other side waits, so an
# entry in a period that is being locked is never approved.
RSpec.describe "Period locks and bulk approval", type: :request do
  self.use_transactional_tests = false

  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let!(:admin) { User.create!(email: "plk-admin-#{SecureRandom.hex(4)}@example.test", clerk_id: "plk_#{SecureRandom.hex(4)}", first_name: "P", last_name: "Admin", role: "admin") }
  let!(:staff) { User.create!(email: "plk-staff-#{SecureRandom.hex(4)}@example.test", clerk_id: "plk_s_#{SecureRandom.hex(4)}", first_name: "P", last_name: "Staff", role: "employee") }
  let!(:entry) do
    start = tz.parse("2026-11-03 09:00")
    TimeEntry.create!(user: staff, work_date: Date.new(2026, 11, 3), entry_method: "clock", status: "completed", start_time: start,
                      end_time: start + 2.hours, hours: 2, approval_status: "pending", approval_note: TimeClockService::UNSCHEDULED_NOTE,
                      overtime_status: "none", unscheduled_clock_in: true)
  end

  after do
    lock_ids = TimePeriodLock.where(locked_by_id: admin.id).pluck(:id)
    AuditLog.where(auditable_type: "TimePeriodLock", auditable_id: lock_ids).delete_all
    AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry.id).delete_all
    TimePeriodLock.where(id: lock_ids).delete_all
    TimeEntry.where(id: entry.id).delete_all
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

  # Runs block inside a transaction on its own connection, holding it open
  # until release is pushed.
  def hold_open(held, release, &block)
    Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do
        ActiveRecord::Base.transaction do
          block.call
          held << true
          release.pop
        end
      end
    end
  end

  def lock_count_now
    ActiveRecord::Base.connection_pool.with_connection { TimePeriodLock.where(locked_by_id: admin.id).count }
  end

  before do
    # Routes load lazily in the test environment; load them before racing.
    call("GET", "/api/v1/time_entries/unscheduled_only_approvals")
  end

  # Releases the held transaction even when an expectation fails, so a
  # failing example can't leave the advisory lock held for the next one.
  def with_held(held, release, holder)
    held.pop
    yield
  ensure
    release << true
    holder.join(10)
  end

  it "makes locking a period wait for a bulk approval in progress" do
    held = Queue.new
    release = Queue.new
    approval = hold_open(held, release) { TimePeriodLock.serialize_with_approvals! }
    locking = nil

    with_held(held, release, approval) do
      locking = Thread.new { call("POST", "/api/v1/admin/time_period_locks", { start_date: "2026-11-01", end_date: "2026-11-07" }) }
      sleep 0.5
      expect(lock_count_now).to eq(0)
    end
    status, = locking.join(10)&.value
    expect(status).to eq(201)
    expect(lock_count_now).to eq(1)
  end

  it "makes a bulk approval wait for a period being locked, then leaves its entries pending" do
    _, preview = call("GET", "/api/v1/time_entries/unscheduled_only_approvals")
    expect(preview["entry_ids"]).to eq([ entry.id ])

    held = Queue.new
    release = Queue.new
    locking = hold_open(held, release) do
      TimePeriodLock.serialize_with_approvals!
      TimePeriodLock.create!(start_date: Date.new(2026, 11, 1), end_date: Date.new(2026, 11, 7), locked_at: Time.current, locked_by: admin)
    end
    approving = nil

    with_held(held, release, locking) do
      approving = Thread.new { call("POST", "/api/v1/time_entries/approve_unscheduled_only", { entries: preview["entries"] }) }
      sleep 0.5
      expect(approving).to be_alive
    end
    status, body = approving.join(10)&.value
    expect(status).to eq(200)
    expect(body).to include("approved_count" => 0, "ineligible_count" => 1)
    expect(entry.reload.approval_status).to eq("pending")
  end
end
