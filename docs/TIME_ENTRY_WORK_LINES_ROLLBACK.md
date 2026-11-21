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
2. **Export the lines** with the time of the export, so the attribution can be re-entered or reloaded later:
   ```sh
   psql "$DATABASE_URL" -c "\copy (SELECT time_entry_id, client_id, service_type_id, service_task_id, period_type, period_start, hours, description, position, created_at, NOW() AT TIME ZONE 'UTC' AS exported_at FROM time_entry_allocations ORDER BY time_entry_id, position) TO 'time_entry_allocations_export.csv' CSV HEADER"
   ```
   Keep the file with the incident notes. It holds client names only by id, but treat it as business data. The columns are listed explicitly because their physical order differs between a migrated database and one loaded from `schema.rb`. The export time is in UTC, like Rails' `created_at` and `updated_at`, so the comparison in step 6 doesn't depend on the session's timezone.
3. **List the affected entries.** The migration's `LOSSY_ROLLBACK_SQL` query returns them:
   ```sh
   bin/rails runner 'require Rails.root.join("db/migrate/20261121010000_create_time_entry_allocations"); puts ActiveRecord::Base.connection.select_values(CreateTimeEntryAllocations::LOSSY_ROLLBACK_SQL)'
   ```
4. **Collapse each affected entry** to the one line Leon or Dafne chose to keep. Only they can decide which client keeps the hours, so get that decision written down first. Then copy the chosen line's work onto the entry, give that line the entry's full hours, and delete the other lines, all in one transaction. For example, for entry 123, keeping its largest line:
   ```sql
   BEGIN;
   -- the line to keep (here: the largest; use the id that was agreed)
   CREATE TEMP TABLE keep ON COMMIT DROP AS
     SELECT id FROM time_entry_allocations WHERE time_entry_id = 123 ORDER BY hours DESC, position LIMIT 1;
   -- 1. the entry takes the kept line's client, category, task, period and description
   UPDATE time_entries e SET client_id = a.client_id, service_type_id = a.service_type_id,
     service_task_id = a.service_task_id, period_type = a.period_type, period_start = a.period_start,
     description = a.description
   FROM time_entry_allocations a WHERE a.id = (SELECT id FROM keep) AND e.id = 123;
   -- 2. the kept line carries the entry's full hours
   UPDATE time_entry_allocations a SET hours = e.hours, position = 0
   FROM time_entries e WHERE a.id = (SELECT id FROM keep) AND e.id = a.time_entry_id;
   -- 3. the other lines go
   DELETE FROM time_entry_allocations WHERE time_entry_id = 123 AND id <> (SELECT id FROM keep);
   COMMIT;
   ```
5. **Run `bin/rails db:rollback`** again. It succeeds once the query in step 3 returns nothing.
6. **Afterwards, restore the splits** once the fixed release is deployed. Running `up` again rebuilds one line per entry from the entry columns. To put the original splits back, restore them in stages, and only for entries that haven't been edited since the export:
   ```sql
   BEGIN;
   -- stage the export (named columns, so column order doesn't matter; times are UTC like Rails' columns)
   CREATE TEMP TABLE allocations_restore (
     time_entry_id bigint, client_id bigint, service_type_id bigint, service_task_id bigint, period_type varchar,
     period_start date, hours numeric(5,2), description text, position integer, created_at timestamp, exported_at timestamp
   ) ON COMMIT DROP;
   \copy allocations_restore (time_entry_id, client_id, service_type_id, service_task_id, period_type, period_start, hours, description, position, created_at, exported_at) FROM 'time_entry_allocations_export.csv' CSV HEADER
   -- entries untouched since the export (their lines can be restored safely)
   CREATE TEMP TABLE restorable ON COMMIT DROP AS
     SELECT DISTINCT r.time_entry_id
     FROM allocations_restore r JOIN time_entries e ON e.id = r.time_entry_id
     WHERE e.updated_at <= r.exported_at;
   -- drop the regenerated single lines for those entries ...
   DELETE FROM time_entry_allocations WHERE time_entry_id IN (SELECT time_entry_id FROM restorable);
   -- ... and insert the exported lines, letting the table assign new ids
   INSERT INTO time_entry_allocations
     (time_entry_id, client_id, service_type_id, service_task_id, period_type, period_start, hours, description, position, created_at, updated_at)
   SELECT time_entry_id, client_id, service_type_id, service_task_id, period_type, period_start, hours, description, position, created_at, NOW()
   FROM allocations_restore WHERE time_entry_id IN (SELECT time_entry_id FROM restorable);
   -- the entry columns mirror the first line again; the description joins all of them, as the app does
   UPDATE time_entries e SET client_id = f.client_id, service_type_id = f.service_type_id, service_task_id = f.service_task_id,
     period_type = f.period_type, period_start = f.period_start,
     description = (SELECT string_agg(d.description, '; ' ORDER BY d.first_position) FROM (
       SELECT description, MIN(position) AS first_position FROM time_entry_allocations
       WHERE time_entry_id = e.id AND NULLIF(BTRIM(description), '') IS NOT NULL GROUP BY description) d)
   FROM time_entry_allocations f
   WHERE f.time_entry_id = e.id AND f.position = 0 AND e.id IN (SELECT time_entry_id FROM restorable);
   COMMIT;
   ```
   Run this in `psql`, because `\copy` is a psql command.
   - Entries edited since the export keep their regenerated line. List them with the same join using `e.updated_at > r.exported_at`, and re-split them by hand.
   - No sequence reset is needed, because the insert lets the table assign the ids.
   - Check the result: `SELECT time_entry_id FROM time_entry_allocations GROUP BY time_entry_id HAVING SUM(hours) <> (SELECT hours FROM time_entries WHERE id = time_entry_id)` must return nothing.
   - The SQL in step 4 doesn't change `updated_at`, so the entries you collapsed are still restored here. An entry edited through the app after the export is not.

Payroll exports are not affected. They snapshot their own copy of the work lines when they are generated.
