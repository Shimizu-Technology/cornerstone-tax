class CreateClientOperationAssignments < ActiveRecord::Migration[8.1]
  def change
    create_table :client_operation_assignments do |t|
      t.references :client, null: false, foreign_key: true
      t.references :operation_template, null: false, foreign_key: true
      t.boolean :auto_generate, null: false, default: true
      t.string :assignment_status, null: false, default: "active"
      t.date :starts_on
      t.date :ends_on
      t.references :created_by, foreign_key: { to_table: :users }

      t.timestamps
    end

    add_index :client_operation_assignments, [:client_id, :operation_template_id], unique: true, name: "index_client_operation_assignments_unique"
    add_index :client_operation_assignments, :assignment_status
  end
end
