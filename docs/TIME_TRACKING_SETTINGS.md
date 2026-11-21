# Time tracking settings

Milestone 2 left a few decisions open. Each one is now a setting with a
best-guess default, so the office can change it without a code change.
All of them are in **Settings → System → Time tracking**, except Flexible
hours, which is set per person in **Users**.

| Setting | Key | Default | Where |
|---|---|---|---|
| Required from | `time_work_details_required_from` | Off (blank) | Settings → System → Time tracking |
| Require a task on every work line | `time_work_task_required` | Off (`"false"`) | Settings → System → Time tracking |
| Pay schedule | `time_pay_schedule` | Semi-monthly (`"semi_monthly"`) | Settings → System → Time tracking |
| First day of a pay period | `time_pay_period_anchor` | Blank (only used by weekly and every-two-weeks) | Settings → System → Time tracking |
| Flexible hours | `users.flexible_hours` | Off for everyone | Users → Team, per person |

## Required from

**What it does.** From this work date, every work line needs a client and a
description of what was done. Lines on Internal – Cornerstone also need a
category. Time that misses this can't be saved (clock-out, Log my day, the
edit modals) or approved. Background jobs, such as the stale clock
auto-close, aren't blocked; their entries are caught at approval and in
Unassigned time.

**Default: off.** Staff need time to get used to logging by client. Turn it on
with a date once they have; "Turn off" clears it.

The key name is unchanged from milestone 2.

## Require a task on every work line

**What it does.** With "Required from" set, every line, client or internal,
also needs a category, plus a task when that category has active tasks. A
category without tasks (the starter internal categories have none) can't take a
task, so those lines need only the category. The clock-out sheet, Log my day,
both edit modals, approval and the Unassigned time list ("Anything missing")
all follow the same rule (`TimeEntryWorkRequirement` on the server,
`checkLines` in the app). Like the rest of the rule, it applies only from the
"Required from" date; Unassigned time doesn't list or label older entries for
a missing task. With the setting on, the task picker sits next to
the category instead of under "Task and period".

**Default: off.** Staff describe their work in free text, and the task list
doesn't yet cover all of it. Turn it on once the categories and tasks match
the work.

## Pay schedule

**What it does.** Sets the "This pay period" and "Last pay period" presets in
the per-person work summary, which opens on this pay period. Any date range can
still be chosen.

- **Semi-monthly:** the 1st–15th and the 16th–end of each month.
- **Every two weeks / every week:** 14- or 7-day periods counted from "First
  day of a pay period". Any period's start date works, past or future. If that
  date is missing, the summary falls back to semi-monthly. Settings won't
  save either schedule without it.

**Default: semi-monthly.** Payroll's recent Cornerstone periods (Oct 18–31,
then Nov 1–15) show the switch to semi-monthly.

The app serves the resolved periods at `GET /api/v1/work_summary/pay_periods`
(see `PaySchedule`).

## Flexible hours (per person)

**What it does.** For someone on flexible hours, clocking in without a
schedule doesn't send the entry to approval: no "Clocked in without a
schedule" note and no pending status. Everything else is unchanged:

- a corrected clock-out time still goes to approval;
- overtime is still flagged for approval;
- staff edits to attendance still go back to an admin.

**When it's decided.** Clock-in records whether there was a schedule
(`time_entries.unscheduled_clock_in`), whatever the flag says. Clock-out, and
the stale auto-close, decide approval with the flag as it is at that moment:
the entry goes to pending if it was unscheduled and the person isn't on
flexible hours. So switching the flag during a shift takes effect at
clock-out, either way. The clock card's message follows the current flag.
The migration backfills `unscheduled_clock_in` from the existing "Clocked in
without a schedule" notes. A clock-in the previous release writes during the
deploy carries that note without the flag; clock-out treats the note as
unscheduled too, so it still goes to approval.

Admins switch it in **Users → Team** (each change is recorded in Activity).
Staff can't change it, including for themselves.

**Default: off for everyone, and no data migration.** Production data since
Aug 1 (read-only check) shows a few people who don't keep a fixed schedule. For
three of them, roughly half to two-thirds of their entries were unscheduled
clock-ins, and they account for most of the pending queue. Admins switch it on
for those people after deploy.

## Approve unscheduled-only entries

This isn't a setting, but it goes with Flexible hours. It clears the backlog
those clock-ins have already built up.

In **Pending Approvals**, "Approve unscheduled-only entries" previews the
pending entries whose only reason is a clock-in without a schedule: the count,
hours, date range and a per-person breakdown. Nothing is approved until the
admin confirms.

An entry qualifies when it is a finished clock entry, its whole approval note
is "Clocked in without a schedule", it has no overtime to review, and neither
the entry nor its date is locked (`TimePeriodLock`). That excludes corrected
clock-out times and staff edits, because both add to the note. Entries that
still miss required work details are counted separately and stay in the queue.

The preview returns each entry's `version` (its `work_version`). On confirm,
the server:

1. takes the same advisory lock that locking a time period takes, so a period
   locked while the approval runs either waits for it or is seen by it;
2. locks the entries' owners (users, `FOR NO KEY UPDATE`), then the entries,
   both in id order, and skips any entry whose version moved since the preview
   (`changed_count`);
3. re-checks the rule, including period locks, and skips any that no longer
   qualify (`ineligible_count`);
4. approves the rest, writing an audit row for each ("Approved in bulk:
   unscheduled-only").

Approval applies the usual overtime check, so an approval that crosses the
threshold puts the entry's overtime up for review.

Endpoints (admin only):
- `GET /api/v1/time_entries/unscheduled_only_approvals`
- `POST /api/v1/time_entries/approve_unscheduled_only` with
  `entries: [{ id, version }]` from the preview (at most 500).

## Locking notes

- Every user row lock used as a mutex is `FOR NO KEY UPDATE` (`User::ROW_MUTEX`):
  day-log creates, approval owner locks, flexible-hours and employment
  changes. It serializes those paths but doesn't block the `KEY SHARE` lock
  that inserting a row referencing the user takes (for example an audit row),
  so an approval and a staff edit of the same entry can't deadlock.
- Order: period/settings advisory locks, then users, then entries, each in id
  order.
- If PostgreSQL still reports a deadlock, the API answers 409 ("Please try
  again"); nothing was saved.

