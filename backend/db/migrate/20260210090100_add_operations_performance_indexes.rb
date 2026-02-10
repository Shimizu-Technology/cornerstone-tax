# frozen_string_literal: true

class AddOperationsPerformanceIndexes < ActiveRecord::Migration[8.1]
  def change
    add_index :operation_tasks, [ :status, :due_at ],
              where: "status <> 'done'",
              name: "index_operation_tasks_active_status_due"

    add_index :operation_cycles, [ :client_id, :period_start, :created_at ],
              order: { period_start: :desc, created_at: :desc },
              name: "index_operation_cycles_client_recent"

    add_index :client_operation_assignments, [ :assignment_status, :auto_generate, :starts_on, :ends_on ],
              name: "index_client_operation_assignments_auto_window"
  end
end
