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

  def patch_lines(lines)
    env = Rack::MockRequest.env_for(
      "/api/v1/time_entries/#{entry.id}",
      method: "PATCH",
      input: { time_entry: { work_lines: lines } }.to_json,
      "CONTENT_TYPE" => "application/json",
      "HTTP_AUTHORIZATION" => "Bearer test_token_#{admin.id}",
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
end
