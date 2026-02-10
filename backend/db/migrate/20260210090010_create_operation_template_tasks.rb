class CreateOperationTemplateTasks < ActiveRecord::Migration[8.1]
  def change
    create_table :operation_template_tasks do |t|
      t.references :operation_template, null: false, foreign_key: true
      t.string :title, null: false
      t.text :description
      t.integer :position, null: false, default: 0
      t.references :default_assignee, foreign_key: { to_table: :users }
      t.integer :due_offset_value
      t.string :due_offset_unit
      t.string :due_offset_from
      t.boolean :evidence_required, null: false, default: false
      t.boolean :is_active, null: false, default: true

      t.timestamps
    end

    add_index :operation_template_tasks, [:operation_template_id, :position], name: "index_operation_template_tasks_order"
    add_index :operation_template_tasks, :is_active
    add_index :operation_template_tasks, [:operation_template_id, :title], unique: true, name: "index_operation_template_tasks_unique_title"
  end
end
