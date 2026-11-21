# frozen_string_literal: true

# Work lines ("allocations"): how one attendance entry's hours were spent,
# split by client, free-text description, optional category/task and period.
# The time entry stays the attendance and pay record (times, breaks,
# overtime, approval, export protection); its lines only describe the work.
#
# Every completed entry with hours gets exactly one line copying its current
# client, category, task, period and description, carrying the full hours.
# Entries without a client get a client-less line (reported as Unassigned).
class CreateTimeEntryAllocations < ActiveRecord::Migration[8.1]
  # Idempotent: entries that already have a line are skipped.
  BACKFILL_SQL = <<~SQL
    INSERT INTO time_entry_allocations
      (time_entry_id, client_id, service_type_id, service_task_id, period_type, period_start,
       hours, description, position, created_at, updated_at)
    SELECT time_entries.id, client_id, service_type_id, service_task_id, period_type, period_start,
           hours, description, 0, NOW(), NOW()
    FROM time_entries
    WHERE status = 'completed' AND hours > 0
      AND NOT EXISTS (SELECT 1 FROM time_entry_allocations existing WHERE existing.time_entry_id = time_entries.id)
  SQL

  def up
    create_table :time_entry_allocations do |t|
      t.references :time_entry, null: false, foreign_key: { on_delete: :cascade }
      t.references :client, foreign_key: true
      t.references :service_type, foreign_key: true
      t.references :service_task, foreign_key: true
      t.string :period_type
      t.date :period_start
      t.decimal :hours, precision: 5, scale: 2, null: false
      t.text :description
      t.integer :position, null: false, default: 0
      t.timestamps
    end

    add_index :time_entry_allocations, [ :time_entry_id, :position ]
    add_check_constraint :time_entry_allocations, "hours > 0 AND hours <= 24", name: "check_time_entry_allocations_hours"
    add_check_constraint :time_entry_allocations, "(period_type IS NULL) = (period_start IS NULL)", name: "check_time_entry_allocations_period_pair"
    add_check_constraint :time_entry_allocations,
                         "period_type IS NULL OR period_type IN ('month', 'quarter', 'year')",
                         name: "check_time_entry_allocations_period_type"
    add_check_constraint :time_entry_allocations,
                         "period_start IS NULL OR (EXTRACT(day FROM period_start) = 1 AND (period_type = 'month' OR " \
                         "(period_type = 'quarter' AND EXTRACT(month FROM period_start) IN (1, 4, 7, 10)) OR " \
                         "(period_type = 'year' AND EXTRACT(month FROM period_start) = 1)))",
                         name: "check_time_entry_allocations_period_alignment"

    execute BACKFILL_SQL
  end

  # Entries whose work lines say more than the legacy entry columns can
  # hold: split across several lines, or a single line that differs from
  # the entry's own client, category, task, period, description or hours.
  # Rolling back would silently lose that attribution.
  LOSSY_ROLLBACK_SQL = <<~SQL
    SELECT time_entries.id
    FROM time_entries
    JOIN time_entry_allocations lines ON lines.time_entry_id = time_entries.id
    GROUP BY time_entries.id
    HAVING COUNT(lines.id) > 1
        OR BOOL_OR(
             lines.client_id IS DISTINCT FROM time_entries.client_id
          OR lines.service_type_id IS DISTINCT FROM time_entries.service_type_id
          OR lines.service_task_id IS DISTINCT FROM time_entries.service_task_id
          OR lines.period_type IS DISTINCT FROM time_entries.period_type
          OR lines.period_start IS DISTINCT FROM time_entries.period_start
          OR NULLIF(BTRIM(lines.description), '') IS DISTINCT FROM NULLIF(BTRIM(time_entries.description), '')
          OR lines.hours IS DISTINCT FROM time_entries.hours
        )
    ORDER BY time_entries.id
  SQL

  # Refuses to roll back once work lines hold attribution the legacy columns
  # can't represent. See docs/TIME_ENTRY_WORK_LINES_ROLLBACK.md.
  def down
    lossy_ids = select_values(LOSSY_ROLLBACK_SQL)
    if lossy_ids.any?
      sample = lossy_ids.first(20).join(", ")
      raise ActiveRecord::IrreversibleMigration,
            "Refusing to drop time_entry_allocations: #{lossy_ids.size} time entr#{lossy_ids.size == 1 ? 'y has' : 'ies have'} " \
            "work lines the entry columns can't represent (split across clients, or a line that differs from its entry). " \
            "Rolling back would lose that client attribution. Entry ids: #{sample}#{lossy_ids.size > 20 ? ', …' : ''}. " \
            "Roll forward instead, or follow docs/TIME_ENTRY_WORK_LINES_ROLLBACK.md."
    end

    drop_table :time_entry_allocations
  end
end
