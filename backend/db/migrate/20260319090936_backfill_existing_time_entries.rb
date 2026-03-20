# frozen_string_literal: true

class BackfillExistingTimeEntries < ActiveRecord::Migration[8.0]
  def up
    TimeEntry.where(entry_method: "manual", approval_status: nil).update_all(
      approval_status: "approved"
    )
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end
end
