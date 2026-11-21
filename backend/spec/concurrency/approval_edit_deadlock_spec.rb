# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("spec/support/concurrency_helpers").to_s

# An approval locks the entry's owner, then the entry. A staff edit locks the
# entry, then inserts its audit row, which takes a KEY SHARE lock on the
# acting user (the same person). With the owner locked FOR UPDATE that was a
# deadlock (approval waits for the entry, the edit waits for the user);
# FOR NO KEY UPDATE (User::ROW_MUTEX) doesn't conflict with KEY SHARE.
RSpec.describe "Approval racing a staff edit of the same entry", type: :request do
  self.use_transactional_tests = false
  include ConcurrencyHelpers

  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let!(:admin) { User.create!(email: "dl-admin-#{SecureRandom.hex(4)}@example.test", clerk_id: "dl_#{SecureRandom.hex(4)}", first_name: "D", last_name: "Admin", role: "admin") }
  let!(:staff) { User.create!(email: "dl-staff-#{SecureRandom.hex(4)}@example.test", clerk_id: "dl_s_#{SecureRandom.hex(4)}", first_name: "D", last_name: "Staff", role: "employee") }
  let!(:entry) do
    start = tz.parse("2026-11-10 09:00")
    TimeEntry.create!(user: staff, work_date: Date.new(2026, 11, 10), entry_method: "clock", status: "completed", start_time: start,
                      end_time: start + 2.hours, hours: 2, approval_status: "pending", overtime_status: "none",
                      approval_note: "Employee corrected clock-out time to 11:00 AM")
  end

  after do
    AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry.id).delete_all
    TimeEntry.where(id: entry.id).delete_all
    User.where(id: [ staff.id, admin.id ]).delete_all
  end

  def call(method, path, body = nil, as:)
    env = Rack::MockRequest.env_for(path, method: method, input: body&.to_json, "CONTENT_TYPE" => "application/json",
                                          "HTTP_AUTHORIZATION" => "Bearer test_token_#{as.id}", "HTTP_HOST" => "www.example.com")
    status, _headers, response = Rails.application.call(env)
    text = +""
    response.each { |part| text << part }
    response.close if response.respond_to?(:close)
    [ status, text.present? ? JSON.parse(text) : {} ]
  end

  before do
    # Routes load lazily in the test environment; load them before racing.
    call("GET", "/api/v1/time_entries/#{entry.id}", as: admin)
    # Pauses a thread that sets :pause_after_entry_lock right after it has
    # locked the entry.
    allow_any_instance_of(TimeEntry).to receive(:lock_for_work_lines!).and_wrap_original do |original, *args|
      result = original.call(*args)
      if (pause = Thread.current[:pause_after_entry_lock])
        pause[:paused] << true
        pause[:resume].pop(timeout: 10)
      end
      result
    end
  end

  it "lets both finish: the edit first, then the approval" do
    pause = { paused: Queue.new, resume: Queue.new }
    editing = Thread.new do
      Thread.current[:pause_after_entry_lock] = pause
      call("PATCH", "/api/v1/time_entries/#{entry.id}", { time_entry: { description: "Edited while being approved" } }, as: staff)
    end
    approving = nil

    begin
      expect(pause[:paused].pop(timeout: 10)).to be(true)
      approving = Thread.new { call("POST", "/api/v1/time_entries/#{entry.id}/approve", nil, as: admin) }
      # The approval holds the owner and is waiting for the entry.
      expect(wait_for_lock_waiters).to be(true)
    ensure
      pause[:resume] << true
    end

    edit_status, = editing.join(15)&.value
    approve_status, approve_body = approving.join(15)&.value

    expect([ edit_status, approve_status ]).to eq([ 200, 200 ]), approve_body.inspect
    expect(entry.reload).to have_attributes(description: "Edited while being approved", approval_status: "approved")
  end
end
