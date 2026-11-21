# frozen_string_literal: true

# Helpers for specs that race real requests on separate database connections
# (spec/concurrency). Required explicitly by those specs.
module ConcurrencyHelpers
  # Opens a transaction on its own connection, runs setup inside it and keeps
  # it open while the block runs. The readiness wait is bounded, an exception
  # in the holder is raised here, and the transaction is always released.
  def while_holding(setup, ready_timeout: 10)
    held = Queue.new
    release = Queue.new
    holder = Thread.new do
      ActiveRecord::Base.connection_pool.with_connection do
        ActiveRecord::Base.transaction do
          setup.call
          held << true
          release.pop
        end
      end
    end
    holder.report_on_exception = false
    unless held.pop(timeout: ready_timeout)
      holder.join(1) # re-raises the holder's exception, if it failed
      raise "The holding transaction wasn't ready within #{ready_timeout}s"
    end
    yield
  ensure
    release&.push(true)
    holder&.join(10)
  end

  # True once at least `count` other connections to this database are
  # waiting on a lock (row, transaction or advisory); false after timeout.
  # Lets a spec observe contention instead of sleeping and hoping.
  def wait_for_lock_waiters(count = 1, timeout: 10)
    deadline = Process.clock_gettime(Process::CLOCK_MONOTONIC) + timeout
    loop do
      waiting = ActiveRecord::Base.connection_pool.with_connection do |connection|
        connection.select_value(<<~SQL.squish).to_i
          SELECT count(*) FROM pg_stat_activity
          WHERE datname = current_database() AND wait_event_type = 'Lock' AND pid <> pg_backend_pid()
        SQL
      end
      return true if waiting >= count
      return false if Process.clock_gettime(Process::CLOCK_MONOTONIC) > deadline

      sleep 0.02
    end
  end
end
