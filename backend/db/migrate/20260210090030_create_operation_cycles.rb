class CreateOperationCycles < ActiveRecord::Migration[8.1]
  def change
    create_table :operation_cycles do |t|
      t.references :client, null: false, foreign_key: true
      t.references :operation_template, null: false, foreign_key: true
      t.references :client_operation_assignment, foreign_key: true
      t.date :period_start, null: false
      t.date :period_end, null: false
      t.string :cycle_label, null: false
      t.string :generation_mode, null: false, default: "manual"
      t.string :status, null: false, default: "active"
      t.datetime :generated_at
      t.references :generated_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :operation_cycles, [:client_id, :operation_template_id, :period_start, :period_end],
              unique: true, name: "index_operation_cycles_unique_period"
    add_index :operation_cycles, :status
    add_index :operation_cycles, [:client_id, :status]
  end
end
