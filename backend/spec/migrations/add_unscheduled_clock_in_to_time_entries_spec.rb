# frozen_string_literal: true

require "rails_helper"
require Rails.root.join("db/migrate/20261121050000_add_unscheduled_clock_in_to_time_entries").to_s

# Runs the real migration inside the example's transaction (PostgreSQL DDL is
# transactional): down, insert rows as they were before, then up.
RSpec.describe AddUnscheduledClockInToTimeEntries do
  let(:migration) { described_class.new }
  let(:connection) { ActiveRecord::Base.connection }
  let(:user) { create(:user, :employee) }

  after { TimeEntry.reset_column_information }

  def insert_entry(method, note)
    connection.select_value(<<~SQL.squish)
      INSERT INTO time_entries (user_id, work_date, hours, entry_method, status, approval_status, approval_note, created_at, updated_at)
      VALUES (#{user.id}, '2026-11-03', 2, #{connection.quote(method)}, 'completed', 'pending', #{connection.quote(note)}, NOW(), NOW())
      RETURNING id
    SQL
  end

  it "marks clock entries whose approval note says they were unscheduled" do
    ActiveRecord::Migration.suppress_messages { migration.down }
    TimeEntry.reset_column_information
    only = insert_entry("clock", "Clocked in without a schedule")
    corrected = insert_entry("clock", "Clocked in without a schedule | Employee corrected clock-out time to 05:00 PM")
    scheduled = insert_entry("clock", "Employee corrected clock-out time to 05:00 PM")
    manual = insert_entry("manual", "Clocked in without a schedule")
    no_note = insert_entry("clock", nil)

    ActiveRecord::Migration.suppress_messages { migration.up }
    TimeEntry.reset_column_information

    flags = TimeEntry.where(id: [ only, corrected, scheduled, manual, no_note ]).pluck(:id, :unscheduled_clock_in).to_h
    expect(flags).to eq(only => true, corrected => true, scheduled => false, manual => false, no_note => false)
  end
end
