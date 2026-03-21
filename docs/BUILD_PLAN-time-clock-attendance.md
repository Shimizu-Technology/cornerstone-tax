# Build Plan: Time Clock / Employee Attendance Rules (Item 5)

**Date:** March 18, 2026
**Branch:** `feature/time-clock-attendance`
**Source:** Cornerstone Feedback Requirements — Item 5 (5A–5D)

---

## Overview

Replace the current manual-only time entry system with a real clock in/out system that enforces schedule rules, tracks breaks, and requires approval for manual corrections and overtime.

### Design Principles

1. **Clock in/out is the primary method** for employees to log time
2. **Manual entries require admin approval** (pending state)
3. **Schedule is the source of truth** — no schedule, no clock-in
4. **Breaks are tracked via clock in/out** — not manual entry
5. **Overtime thresholds are configurable** (default: 8h daily, 40h weekly)
6. **Early clock-in blocked** unless within 5 minutes of scheduled start
7. **Admins can override everything** — create/edit any entry, approve/deny pending entries

---

## Employee Clock In/Out Flow

### Clock In
1. Employee opens time tracking page
2. System shows today's schedule (e.g., "8:00 AM – 5:00 PM")
3. Employee taps "Clock In"
4. System checks:
   - **Has schedule for today?** No → blocked ("No shift scheduled for today")
   - **Already clocked in?** Yes → blocked
   - **More than 5 min before scheduled start?** → blocked ("Your shift starts at 8:00 AM. You can clock in starting at 7:55 AM.")
   - **Within 5 min of scheduled start or after?** → allowed
5. Creates time entry: `clock_in_at = now`, `entry_method = 'clock'`, `status = 'clocked_in'`

### Start Break
1. Employee taps "Start Break"
2. Creates a `time_entry_break` record: `start_time = now`
3. Time entry status changes to `on_break`

### End Break
1. Employee taps "End Break"
2. Updates the break record: `end_time = now`, calculates `duration_minutes`
3. Time entry status changes back to `clocked_in`
4. Multiple breaks allowed per shift

### Clock Out
1. Employee taps "Clock Out"
2. System checks:
   - **Would this push past daily OT threshold?** → entry saved, flagged `overtime_status = 'pending'`
   - **Would this push past weekly OT threshold?** → same
3. Updates time entry: `clock_out_at = now`, `end_time = now`, calculates `hours`, status = `completed`
4. System auto-calculates `attendance_status`: early, on_time, late (based on schedule)
5. System auto-calculates total `break_minutes` from break records

### Manual Entry (Employee)
1. Employee fills in date, start/end time manually (for corrections, forgot to clock out, etc.)
2. Entry created with `entry_method = 'manual'`, `approval_status = 'pending'`
3. Appears in admin approval queue
4. Admin approves → `approval_status = 'approved'`, counts toward hours
5. Admin denies → `approval_status = 'denied'`, does NOT count toward hours

### Admin Override
- Admins can create/edit entries for any employee, any date
- Entries created/edited by admin: `admin_override = true`, `approval_status = 'approved'`
- Admins can approve/deny pending entries from the approval queue
- Admins can clock someone in/out on their behalf

---

## Database Changes

### Migration 1: Add columns to `time_entries`

```ruby
add_column :time_entries, :schedule_id, :bigint, null: true
add_column :time_entries, :clock_in_at, :datetime, null: true
add_column :time_entries, :clock_out_at, :datetime, null: true
add_column :time_entries, :entry_method, :string, default: 'manual', null: false
add_column :time_entries, :status, :string, default: 'completed', null: false
add_column :time_entries, :admin_override, :boolean, default: false, null: false
add_column :time_entries, :attendance_status, :string, null: true
add_column :time_entries, :approval_status, :string, null: true
add_column :time_entries, :approved_by_id, :bigint, null: true
add_column :time_entries, :approved_at, :datetime, null: true
add_column :time_entries, :approval_note, :text, null: true
add_column :time_entries, :overtime_status, :string, null: true

add_index :time_entries, :schedule_id
add_index :time_entries, :status
add_index :time_entries, :approval_status
add_index :time_entries, :approved_by_id
add_foreign_key :time_entries, :schedules, column: :schedule_id
add_foreign_key :time_entries, :users, column: :approved_by_id
```

**Column values:**
- `entry_method`: `'clock'`, `'manual'`
- `status`: `'clocked_in'`, `'on_break'`, `'completed'`
- `attendance_status`: `'early'`, `'on_time'`, `'late'`, `null` (for manual entries without a schedule)
- `approval_status`: `'approved'`, `'pending'`, `'denied'`, `null` (clock entries don't need approval)
- `overtime_status`: `'none'`, `'pending'`, `'approved'`, `'denied'`, `null`

### Migration 2: Create `time_entry_breaks` table

```ruby
create_table :time_entry_breaks do |t|
  t.references :time_entry, null: false, foreign_key: true
  t.datetime :start_time, null: false
  t.datetime :end_time, null: true
  t.integer :duration_minutes, null: true
  t.timestamps
end
```

### Migration 3: Seed configurable settings

```ruby
Setting.find_or_create_by(key: 'overtime_daily_threshold_hours').update(value: '8')
Setting.find_or_create_by(key: 'overtime_weekly_threshold_hours').update(value: '40')
Setting.find_or_create_by(key: 'early_clock_in_buffer_minutes').update(value: '5')
```

### Backfill existing entries

All existing `time_entries` should be backfilled:
- `entry_method = 'manual'`
- `status = 'completed'`
- `approval_status = 'approved'` (treat all historical entries as approved)

---

## Backend Changes

### New: `TimeClockService`

Central service for clock in/out logic:
- `clock_in(user:)` — validates schedule, early check, creates entry
- `clock_out(user:)` — validates active entry, checks overtime, completes entry
- `start_break(user:)` — creates break record, updates status
- `end_break(user:)` — closes break record, updates status
- `calculate_attendance_status(time_entry)` — compares to schedule
- `check_overtime(user:, date:)` — daily + weekly threshold check

### Modified: `TimeEntriesController`

New actions:
- `POST /api/v1/time_entries/clock_in` — employee clock in
- `POST /api/v1/time_entries/clock_out` — employee clock out
- `POST /api/v1/time_entries/start_break` — start break
- `POST /api/v1/time_entries/end_break` — end break
- `GET /api/v1/time_entries/current_status` — get employee's current clock status
- `GET /api/v1/time_entries/pending_approvals` — admin: list pending entries
- `POST /api/v1/time_entries/:id/approve` — admin: approve entry
- `POST /api/v1/time_entries/:id/deny` — admin: deny entry

Modified actions:
- `create` — if employee, set `approval_status = 'pending'`; if admin, set `approved`
- `update` — same logic; if employee edits, re-enters pending state

### Modified: `TimeEntry` model

- New associations: `belongs_to :schedule`, `belongs_to :approved_by`, `has_many :time_entry_breaks`
- New validations: `status` inclusion, `entry_method` inclusion
- New scopes: `clocked_in`, `pending_approval`, `approved`, `for_overtime_check`
- `total_break_minutes` — sum of break durations
- `net_hours` — hours minus break time
- `counts_toward_hours?` — only if approved (or clock entry without overtime issue)

### New: `TimeEntryBreak` model

- `belongs_to :time_entry`
- Validations: `start_time` required, `end_time` after `start_time` (when present)
- `duration_minutes` calculated on close

---

## Frontend Changes

### Employee View: Clock In/Out Card

New component at top of time tracking page (employees only):

**State: Not Clocked In**
```
┌─────────────────────────────────────┐
│  Today's Schedule: 8:00 AM – 5:00 PM
│
│  You are not clocked in.
│
│         [ Clock In ]                 
└─────────────────────────────────────┘
```

**State: Clocked In**
```
┌─────────────────────────────────────┐
│  Clocked in at 8:02 AM             
│  Elapsed: 2h 34m (excl. breaks)    
│                                      
│  [ Start Break ]    [ Clock Out ]   
└─────────────────────────────────────┘
```

**State: On Break**
```
┌─────────────────────────────────────┐
│  On break since 12:01 PM           
│  Break duration: 15m               
│                                      
│         [ End Break ]               
└─────────────────────────────────────┘
```

**State: No Schedule**
```
┌─────────────────────────────────────┐
│  No shift scheduled for today.      
│  Contact your manager if you need   
│  to work today.                     
└─────────────────────────────────────┘
```

### Admin View: Approval Queue

New tab or section in time tracking (admins only):

- List of pending manual entries and overtime requests
- Each shows: employee name, date, times, reason (manual entry / overtime)
- Approve / Deny buttons with optional note
- Badge count on the tab showing pending items

### Admin View: Who's Working Now

New section showing real-time status:
- List of employees with today's schedule
- Status: Not clocked in / Clocked in since X / On break / Completed
- Late flag if past scheduled start and not clocked in

### Modified: Time Entry Form

- Employees: manual entry form still available but submits as pending
- Shows "(Requires Approval)" label
- Admins: form works as before but shows override indicator

### Modified: Time Entry List

- Show `approval_status` badge (pending/approved/denied)
- Show `entry_method` indicator (clock icon vs manual icon)
- Show `attendance_status` (late badge, etc.)
- Denied entries shown as strikethrough or dimmed

---

## Build Order

### Phase 1: Database & Models (backend)
1. Create migrations (time_entry columns + time_entry_breaks table)
2. Backfill existing entries
3. Update TimeEntry model (associations, validations, scopes)
4. Create TimeEntryBreak model
5. Add settings seeds

### Phase 2: Clock In/Out Service (backend)
6. Create TimeClockService
7. Add clock_in/clock_out/start_break/end_break actions to controller
8. Add current_status endpoint
9. Test with curl

### Phase 3: Approval Workflow (backend)
10. Add pending state to manual entries (modify create/update)
11. Add approve/deny endpoints
12. Add pending_approvals endpoint
13. Add overtime detection logic

### Phase 4: Employee Clock UI (frontend)
14. Create ClockInOutCard component
15. Integrate with time tracking page
16. Handle all states (not clocked in, clocked in, on break, no schedule, blocked)
17. Manual entry form shows pending state for employees

### Phase 5: Admin Approval UI (frontend)
18. Create ApprovalQueue component
19. Add "Who's Working Now" section
20. Add approval badges to time entry list
21. Admin override indicators

### Phase 6: Overtime & Settings (frontend + backend)
22. Add overtime threshold settings to admin settings page
23. Add early clock-in buffer setting
24. Overtime warnings on clock out
25. Weekly overtime tracking in reports

---

## Settings (Admin Configurable)

| Key | Default | Description |
|-----|---------|-------------|
| `overtime_daily_threshold_hours` | `8` | Hours per day before overtime |
| `overtime_weekly_threshold_hours` | `40` | Hours per week before overtime |
| `early_clock_in_buffer_minutes` | `5` | Minutes before scheduled start that clock-in is allowed |

---

## Edge Cases

| Scenario | Behavior |
|----------|----------|
| Employee forgets to clock out | Entry stays as `clocked_in` overnight. Admin gets flagged. Employee submits manual correction (pending approval). |
| Employee has no schedule | Cannot clock in. Must contact manager. |
| Employee tries to clock in 10 min early | Blocked with message showing when they can clock in. |
| Employee tries to clock in 3 min early | Allowed (within 5-min buffer). |
| Admin creates entry for employee | `admin_override = true`, auto-approved. |
| Employee submits manual entry | `approval_status = 'pending'`. Doesn't count until approved. |
| Clock out would cause overtime | Entry completed but `overtime_status = 'pending'`. Admin reviews. |
| Multiple breaks in one shift | All tracked as separate `time_entry_breaks` records. |
| Employee clocks in, then schedule changes | Clock-in was valid at the time; no retroactive invalidation. |
| Period lock with pending entries | Pending entries in a locked period should be auto-denied or flagged. |
