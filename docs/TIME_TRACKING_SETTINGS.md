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
`checkLines` in the app). With the setting on, the task picker sits next to
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

If it's switched on during a shift, that shift's clock-out doesn't go to
approval either.

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
is "Clocked in without a schedule", it has no overtime to review and it isn't
in a locked period. That excludes corrected clock-out times and staff edits,
because both add to the note. Entries that still miss required work details are
counted separately and stay in the queue.

On confirm, the server re-checks each previewed entry under a row lock and
approves only those that still qualify. Anything that changed in the meantime
is skipped and counted. Approval applies the usual overtime check, so an
approval that crosses the threshold puts the entry's overtime up for review.

Endpoints (admin only):
- `GET /api/v1/time_entries/unscheduled_only_approvals`
- `POST /api/v1/time_entries/approve_unscheduled_only` with `entry_ids`
  (at most 500).
