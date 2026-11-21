# frozen_string_literal: true

require "rails_helper"

# Clock-out locks the entry and then closes its open break. end_break used to
# close (lock) the break first and then update (lock) the entry: opposite
# orders, so the two could deadlock. Every break operation now locks the
# entry first. This forces the bad interleaving on two connections.
RSpec.describe "Break and entry lock order" do
  self.use_transactional_tests = false

  let!(:staff) do
    User.create!(email: "lockorder-#{SecureRandom.hex(4)}@example.test", clerk_id: "lockorder_#{SecureRandom.hex(4)}",
                 first_name: "Lock", last_name: "Order", role: "employee")
  end

  after do
    ids = TimeEntry.where(user_id: staff.id).pluck(:id)
    TimeEntryBreak.where(time_entry_id: ids).delete_all
    TimeEntry.where(id: ids).delete_all
    User.where(id: staff.id).delete_all
  end

  def start_on_break
    started = 2.hours.ago
    entry = TimeEntry.create!(user: staff, work_date: started.in_time_zone(TimeClockService::BUSINESS_TIMEZONE).to_date,
                              entry_method: "clock", status: "on_break", hours: 0,
                              start_time: started.in_time_zone(TimeClockService::BUSINESS_TIMEZONE), clock_in_at: started)
    entry.time_entry_breaks.create!(start_time: 30.minutes.ago)
    entry
  end

  # Pauses the thread that set :pause_before_break_close just before it
  # closes the break (i.e. while it already holds the entry lock).
  def pause_break_close
    allow_any_instance_of(TimeEntryBreak).to receive(:close!).and_wrap_original do |original, *args|
      if (pause = Thread.current[:pause_before_break_close])
        pause[:paused] << true
        pause[:resume].pop
      end
      original.call(*args)
    end
  end

  def run_in_thread(pause = nil)
    Thread.new do
      Thread.current[:pause_before_break_close] = pause
      Thread.current.report_on_exception = false
      ActiveRecord::Base.connection_pool.with_connection do
        yield
        :ok
      rescue StandardError => e
        e
      end
    end
  end

  it "lets end_break wait for a clock-out instead of deadlocking" do
    entry = start_on_break
    pause_break_close
    pause = { paused: Queue.new, resume: Queue.new }

    clock_out = run_in_thread(pause) { TimeClockService.clock_out(user: staff) }
    pause[:paused].pop # clock-out holds the entry lock and is about to close the break
    end_break = run_in_thread { TimeClockService.end_break(user: staff) }
    sleep 0.5 # give end_break time to reach (and block on) its first lock
    pause[:resume] << true

    results = [ clock_out.value, end_break.value ]
    expect(results.grep(ActiveRecord::Deadlocked)).to be_empty, results.inspect
    expect(results.first).to eq(:ok)
    expect(results.last).to be_a(TimeClockService::ClockError)
    entry.reload
    expect(entry.status).to eq("completed")
    expect(entry.time_entry_breaks.where(end_time: nil)).to be_empty
  end

  it "lets the stale auto-close and end_break run in either order without deadlocking" do
    entry = start_on_break
    entry.update_columns(clock_in_at: 13.hours.ago)
    pause_break_close
    pause = { paused: Queue.new, resume: Queue.new }

    auto_close = run_in_thread(pause) { TimeClockService.flag_stale_entries }
    pause[:paused].pop
    end_break = run_in_thread { TimeClockService.end_break(user: staff) }
    sleep 0.5
    pause[:resume] << true

    results = [ auto_close.value, end_break.value ]
    expect(results.grep(ActiveRecord::Deadlocked)).to be_empty, results.inspect
    expect(entry.reload.status).to eq("completed")
  end
end
