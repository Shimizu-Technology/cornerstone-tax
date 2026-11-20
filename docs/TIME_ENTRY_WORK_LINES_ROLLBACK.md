# Rolling back time entry work lines

Migration `20261121010000_create_time_entry_allocations` adds `time_entry_allocations`, the per-client work lines behind each time entry. Its `down` step drops that table.

## Why `down` can refuse

The old time entry columns (`client_id`, `service_type_id`, `service_task_id`, `period_*`, `description`, `hours`) can hold only one client, one category and one description per entry. Once staff split an entry across clients, or once a line differs from its entry, dropping the table would silently move all of that entry's hours back to a single client.

So `down` checks first. If any entry has more than one line, or a single line that differs from its entry's columns, it raises `ActiveRecord::IrreversibleMigration`. The error gives the number of such entries, the first 20 ids, and a pointer to this file. Nothing is dropped.

While every entry has exactly one line that matches its columns (for example, right after deploy and before anyone splits time), `down` drops the table, and re-running `up` rebuilds the same lines from the entry columns.

I chose to refuse rather than keep a backup table that `up` restores from. A backup taken at rollback time goes stale as soon as the old code edits entries again, and restoring stale splits onto changed entries is worse than refusing.

## Recovery procedure

**Preferred: roll forward.** Fix the problem in a new release and keep the table. Work lines don't change attendance, pay hours, approvals or exports, so a broken work-lines screen can usually be hidden or patched without touching the data.

If the table really must go:

1. **Freeze edits.** Make sure no one is editing time while you do this.
2. **Export the lines**, so the attribution can be re-entered or reloaded later:
   ```sh
   pg_dump "$DATABASE_URL" --data-only --table=time_entry_allocations > time_entry_allocations_$(date +%Y%m%d%H%M).sql
   ```
   Keep the file with the incident notes. It holds client names only by id, but treat it as business data.
3. **List the affected entries.** The migration's `LOSSY_ROLLBACK_SQL` query returns them:
   ```sh
   bin/rails runner 'require Rails.root.join("db/migrate/20261121010000_create_time_entry_allocations"); puts ActiveRecord::Base.connection.select_values(CreateTimeEntryAllocations::LOSSY_ROLLBACK_SQL)'
   ```
4. **Collapse each affected entry** to what the legacy columns can say. Only Leon or Dafne can decide which client keeps the hours, so get that decision written down first. Then, for each entry, keep one line, or update the entry's columns and delete the other lines so the one remaining line matches. For example:
   ```sql
   -- keep the largest line's client for entry 123
   DELETE FROM time_entry_allocations WHERE time_entry_id = 123 AND id <> (
     SELECT id FROM time_entry_allocations WHERE time_entry_id = 123 ORDER BY hours DESC, position LIMIT 1);
   UPDATE time_entry_allocations a SET hours = e.hours, client_id = e.client_id, service_type_id = e.service_type_id,
     service_task_id = e.service_task_id, period_type = e.period_type, period_start = e.period_start, description = e.description
   FROM time_entries e WHERE a.time_entry_id = e.id AND e.id = 123;
   ```
5. **Run `bin/rails db:rollback`** again. It succeeds once the query in step 3 returns nothing.
6. **Afterwards**, once the fixed release is deployed, run `up` again. It rebuilds one line per entry from the entry columns. To restore the original splits, reload the step 2 export into the new table, but only for entries that haven't been edited since the export. Compare `time_entries.updated_at` with the export time.

Payroll exports are not affected. They snapshot their own copy of the work lines when they are generated.
