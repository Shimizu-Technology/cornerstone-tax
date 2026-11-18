# frozen_string_literal: true

# Optional accounting period a time entry's work applies to, separate from the
# day the work was done (work_date). Examples: bank reconciliation for
# July 2026, a payroll return for the 3rd quarter of 2026.
#
# Stored as a type plus the first day of that period:
#   period_type  = "month" | "quarter" | "year"
#   period_start = first day of the month, quarter (Jan/Apr/Jul/Oct 1) or year
# Both columns are blank together. Existing entries are left untouched.
class AddWorkPeriodToTimeEntries < ActiveRecord::Migration[8.1]
  def change
    add_column :time_entries, :period_type, :string
    add_column :time_entries, :period_start, :date

    add_index :time_entries, [ :period_start, :period_type ], name: "index_time_entries_on_work_period"

    add_check_constraint :time_entries,
                         "period_type IS NULL OR period_type IN ('month', 'quarter', 'year')",
                         name: "check_time_entries_period_type"
    add_check_constraint :time_entries,
                         "(period_type IS NULL) = (period_start IS NULL)",
                         name: "check_time_entries_period_pair"
  end
end
