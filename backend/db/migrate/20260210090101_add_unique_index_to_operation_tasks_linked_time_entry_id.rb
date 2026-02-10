class AddUniqueIndexToOperationTasksLinkedTimeEntryId < ActiveRecord::Migration[8.1]
  def change
    # Unique index ensures 1:1 relationship between task and time entry
    # Partial index (WHERE NOT NULL) allows multiple tasks to have NULL linked_time_entry_id
    add_index :operation_tasks, :linked_time_entry_id,
              unique: true,
              where: "linked_time_entry_id IS NOT NULL",
              name: "index_operation_tasks_on_linked_time_entry_unique"
  end
end
