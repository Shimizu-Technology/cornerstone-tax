class AddCadenceFieldsToClientOperationAssignments < ActiveRecord::Migration[8.1]
  def up
    add_column :client_operation_assignments, :cadence_type, :string, null: false, default: "monthly"
    add_column :client_operation_assignments, :cadence_interval, :integer
    add_column :client_operation_assignments, :cadence_anchor, :date

    execute <<~SQL
      UPDATE client_operation_assignments AS coa
      SET
        cadence_type = COALESCE(ot.recurrence_type, 'monthly'),
        cadence_interval = CASE
          WHEN ot.recurrence_type = 'custom' THEN COALESCE(ot.recurrence_interval, 30)
          ELSE NULL
        END,
        cadence_anchor = COALESCE(coa.starts_on, CURRENT_DATE)
      FROM operation_templates AS ot
      WHERE coa.operation_template_id = ot.id
    SQL
  end

  def down
    remove_column :client_operation_assignments, :cadence_anchor
    remove_column :client_operation_assignments, :cadence_interval
    remove_column :client_operation_assignments, :cadence_type
  end
end
