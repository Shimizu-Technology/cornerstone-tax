# frozen_string_literal: true

require "rails_helper"

# Two real PATCH requests replace the same entry's work lines at the same
# time, each on its own thread and database connection. A barrier where
# the lines are read makes both requests read before either writes unless
# the row lock serializes them. Without TimeEntry#lock_for_work_lines! this
# produced two full line sets (0.24h of lines on a 0.12h entry).
RSpec.describe "Concurrent work-line saves", type: :request do
  self.use_transactional_tests = false

  # Lets the first thread to read the lines wait (briefly) for the other.
  class LineReadBarrier
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

  module BarrierOnLineRead
    mattr_accessor :barrier

    def current_work_lines
      lines = super
      BarrierOnLineRead.barrier&.wait if @work_lines_input
      lines
    end
  end

  let(:tz) { ActiveSupport::TimeZone[TimeClockService::BUSINESS_TIMEZONE] }
  let!(:admin) { User.create!(email: "conc-admin-#{SecureRandom.hex(4)}@example.test", clerk_id: "conc_#{SecureRandom.hex(4)}", first_name: "C", last_name: "Admin", role: "admin") }
  let!(:clients) do
    Array.new(2) { |index| Client.create!(first_name: "C#{index}", last_name: "Client", client_type: "business", business_name: "Concurrency #{index} #{SecureRandom.hex(3)}") }
  end
  let!(:entry) do
    record = TimeEntry.new(user: admin, work_date: Date.new(2026, 11, 16), entry_method: "manual", approval_status: "approved",
                           start_time: tz.parse("2026-11-16 09:00"), end_time: tz.parse("2026-11-16 09:07"))
    record.save!
    record
  end

  before do
    TimeEntry.prepend(BarrierOnLineRead) unless TimeEntry.ancestors.include?(BarrierOnLineRead)
    BarrierOnLineRead.barrier = LineReadBarrier.new(2, 1.5)
  end

  after do
    BarrierOnLineRead.barrier = nil
    AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry.id).delete_all
    TimeEntry.where(id: entry.id).delete_all
    Client.where(id: clients.map(&:id)).delete_all
    User.where(id: admin.id).delete_all
  end

  def patch_lines(lines, as: admin, entry_id: entry.id)
    env = Rack::MockRequest.env_for(
      "/api/v1/time_entries/#{entry_id}",
      method: "PATCH",
      input: { time_entry: { work_lines: lines } }.to_json,
      "CONTENT_TYPE" => "application/json",
      "HTTP_AUTHORIZATION" => "Bearer test_token_#{as.id}",
      "HTTP_HOST" => "www.example.com"
    )
    status, _headers, body = Rails.application.call(env)
    text = +""
    body.each { |part| text << part }
    body.close if body.respond_to?(:close)
    [ status, text ]
  end

  it "serializes the saves so the lines always add up to the entry" do
    first = Array.new(6) { |index| { client_id: clients[0].id, description: "First", minutes: index.zero? ? 2 : 1 } }
    second = [ { client_id: clients[1].id, description: "Second", minutes: 4 }, { client_id: clients[0].id, description: "Second", minutes: 3 } ]

    # Routes load lazily in the test environment; load them before racing.
    expect(patch_lines(first).first).to eq(200)
    BarrierOnLineRead.barrier = LineReadBarrier.new(2, 1.5)

    results = [ first, second ].map { |lines| Thread.new { patch_lines(lines) } }.map(&:value)

    expect(results.map(&:first)).to eq([ 200, 200 ]), results.inspect
    entry.reload
    lines = entry.work_lines.reload
    expect(lines.sum(&:hours)).to eq(entry.hours)
    expect(lines.map(&:description).uniq.size).to eq(1)
  end

  describe "a staff edit racing a clock-out" do
    let!(:staff) { User.create!(email: "conc-staff-#{SecureRandom.hex(4)}@example.test", clerk_id: "conc_s_#{SecureRandom.hex(4)}", first_name: "C", last_name: "Staff", role: "employee") }

    after do
      entry_ids = TimeEntry.where(user_id: staff.id).pluck(:id)
      AuditLog.where(auditable_type: "TimeEntry", auditable_id: entry_ids).delete_all
      TimeEntry.where(id: entry_ids).delete_all
      User.where(id: staff.id).delete_all
    end

    it "decides approval on the locked row, so an entry completed meanwhile goes to review" do
      BarrierOnLineRead.barrier = nil
      # Holds the PATCH thread just before it takes the row lock (a stub, so
      # it is removed after this example).
      allow_any_instance_of(TimeEntry).to receive(:lock_for_work_lines!).and_wrap_original do |original, *args|
        if (pause = Thread.current[:pause_before_lock])
          pause[:paused] << true
          pause[:resume].pop
        end
        original.call(*args)
      end
      started = 2.hours.ago
      active = TimeEntry.create!(user: staff, work_date: started.in_time_zone(tz).to_date, entry_method: "clock", status: "clocked_in", hours: 0,
                                 start_time: started.in_time_zone(tz), clock_in_at: started)
      # Load routes before racing (an empty update of an open clock changes nothing).
      expect(patch_lines([], as: staff, entry_id: active.id).first).to eq(200)

      gate = { paused: Queue.new, resume: Queue.new }
      edit = Thread.new do
        Thread.current[:pause_before_lock] = gate
        patch_lines([ { client_id: clients[0].id, description: "Bank recs", minutes: 120 } ], as: staff, entry_id: active.id)
      end
      gate[:paused].pop # the PATCH loaded the active entry and is about to lock it
      TimeClockService.clock_out(user: staff)
      gate[:resume] << true
      status, body = edit.value

      expect(status).to eq(200), body
      active.reload
      expect(active.status).to eq("completed")
      expect(active.approval_status).to eq("pending")
      expect(active.work_lines.sole).to have_attributes(client_id: clients[0].id, description: "Bank recs")
    end
  end

  describe "expected_version under concurrency" do
    def request(method, path, body, as: admin)
      env = Rack::MockRequest.env_for(path, method: method, input: body.to_json, "CONTENT_TYPE" => "application/json",
                                            "HTTP_AUTHORIZATION" => "Bearer test_token_#{as.id}", "HTTP_HOST" => "www.example.com")
      status, _headers, rack_body = Rails.application.call(env)
      text = +""
      rack_body.each { |part| text << part }
      rack_body.close if rack_body.respond_to?(:close)
      [ status, text ]
    end

    it "lets exactly one of two saves with the same expected version win; the other gets 409" do
      BarrierOnLineRead.barrier = nil
      expect(patch_lines(Array.new(7) { { client_id: clients[0].id, minutes: 1 } }).first).to eq(200) # warm up routes
      version = entry.reload.work_version
      bodies = [
        { expected_version: version, time_entry: { work_lines: [ { client_id: clients[0].id, minutes: 7 } ] } },
        { expected_version: version, time_entry: { work_lines: [ { client_id: clients[1].id, minutes: 7 } ] } }
      ]

      results = bodies.map { |body| Thread.new { request("PATCH", "/api/v1/time_entries/#{entry.id}", body) } }.map(&:value)

      expect(results.map(&:first).sort).to eq([ 200, 409 ]), results.inspect
      expect(entry.work_lines.reload.size).to eq(1)
    end

    it "lets only one of two concurrent day-log creates through; the other gets 409" do
      BarrierOnLineRead.barrier = nil
      day = Date.new(2026, 11, 17)
      body = { time_entry: { work_date: day.iso8601, work_lines: [ { client_id: clients[0].id, minutes: 30 } ] } }
      request("GET", "/api/v1/time_entries", {}) # warm up routes

      results = Array.new(2) { Thread.new { request("POST", "/api/v1/time_entries", body) } }.map(&:value)

      expect(results.map(&:first).sort).to eq([ 201, 409 ]), results.inspect
      expect(TimeEntry.where(user: admin, work_date: day).count).to eq(1)
    ensure
      ids = TimeEntry.where(user: admin, work_date: day).pluck(:id)
      AuditLog.where(auditable_type: "TimeEntry", auditable_id: ids).delete_all
      TimeEntry.where(id: ids).delete_all
    end
  end
end
