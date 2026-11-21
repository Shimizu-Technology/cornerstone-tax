# frozen_string_literal: true

# Records, at clock-in, whether there was no schedule (regardless of the
# person's Flexible hours flag). Clock-out decides approval from it and the
# flag at that moment. Existing clock entries are backfilled from the
# "Clocked in without a schedule" approval note that clock-in used to write.
class AddUnscheduledClockInToTimeEntries < ActiveRecord::Migration[8.1]
  def up
    add_column :time_entries, :unscheduled_clock_in, :boolean, null: false, default: false

    # A deploy-time backfill of a column the work-line editors don't show, so
    # work_version is left alone (open edit forms aren't invalidated).
    execute <<~SQL.squish
      UPDATE time_entries
      SET unscheduled_clock_in = TRUE
      WHERE entry_method = 'clock'
        AND approval_note LIKE 'Clocked in without a schedule%'
    SQL
  end

  def down
    remove_column :time_entries, :unscheduled_clock_in
  end
end
