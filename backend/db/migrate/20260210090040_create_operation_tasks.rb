class CreateOperationTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :operation_tasks do |t|
      t.references :operation_cycle, null: false, foreign_key: true
      t.references :operation_template_task, null: false, foreign_key: true
      t.references :client, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.integer :position, null: false, default: 0
      t.string :status, null: false, default: "not_started"
      t.references :assigned_to, foreign_key: { to_table: :users }
      t.datetime :due_at
      t.datetime :started_at
      t.datetime :completed_at
      t.references :completed_by, foreign_key: { to_table: :users }
      t.boolean :evidence_required, null: false, default: false
      t.text :evidence_note
      t.text :notes
      t.references :linked_time_entry, foreign_key: { to_table: :time_entries }

      t.timestamps
    end

    add_index :operation_tasks, [:operation_cycle_id, :position], name: "index_operation_tasks_order"
    add_index :operation_tasks, :status
    add_index :operation_tasks, :due_at
    add_index :operation_tasks, [:client_id, :status]
    add_index :operation_tasks, [:assigned_to_id, :status]
  end
end
