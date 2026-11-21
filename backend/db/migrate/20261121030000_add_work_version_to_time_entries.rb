# frozen_string_literal: true

# A change counter for each time entry, used as an optimistic-concurrency
# token by the work-lines editors (expected_version). It goes up on every
# change to the entry and on every create, update or delete of one of its
# work lines, inside the same transaction. Unlike updated_at it is exact
# (no sub-second truncation) and it also moves when only the lines change.
class AddWorkVersionToTimeEntries < ActiveRecord::Migration[8.1]
  def change
    add_column :time_entries, :work_version, :integer, null: false, default: 0
  end
end
