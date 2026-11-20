# frozen_string_literal: true

# The payroll ingest endpoint that filled this table (POST /api/v1/payroll/ingest)
# was removed. Drop the table only when it holds nothing; if a batch exists,
# stop so someone decides what to keep before the data goes.
class DropPayrollImportBatches < ActiveRecord::Migration[8.1]
  def up
    return unless table_exists?(:payroll_import_batches)

    count = select_value("SELECT COUNT(*) FROM payroll_import_batches").to_i
    if count.positive?
      raise ActiveRecord::IrreversibleMigration,
            "payroll_import_batches has #{count} row(s). Export or review them before dropping the table."
    end

    drop_table :payroll_import_batches
  end

  def down
    create_table :payroll_import_batches do |t|
      t.string :idempotency_key, null: false
      t.string :source_payroll_run_id, null: false
      t.jsonb :payload, null: false, default: {}
      t.string :status, null: false, default: "pending"
      t.decimal :total_gross, precision: 12, scale: 2
      t.decimal :total_net, precision: 12, scale: 2
      t.decimal :total_tax, precision: 12, scale: 2
      t.integer :employee_count
      t.jsonb :reconciliation_details, default: {}
      t.text :error_message
      t.timestamps
    end

    add_index :payroll_import_batches, :idempotency_key, unique: true
    add_index :payroll_import_batches, :source_payroll_run_id
    add_index :payroll_import_batches, :status
    add_index :payroll_import_batches, :created_at
  end
end
