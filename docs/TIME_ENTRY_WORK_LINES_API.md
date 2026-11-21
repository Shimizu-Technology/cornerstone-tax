# Time entry work lines: API input

`POST /api/v1/time_entries`, `PATCH /api/v1/time_entries/:id` (inside `time_entry`) and `POST /api/v1/time_entries/clock_out` accept `work_lines`, an array that **replaces** all of an entry's lines. Line hours always add up exactly to the entry's hours.

## Each line

| Field | Notes |
|---|---|
| `client_id` | Optional unless the cutover rule applies (see below). `null` means Unassigned. |
| `description` | Free text: what was done. |
| `service_type_id`, `service_task_id` | Optional category and task. A task needs its category. |
| `period_type`, `period_start` | Optional period: `month`/`quarter`/`year` and the first day of it. |
| **time**: exactly one of the fields below | |
| `exact_hours` | An **unchanged** line's stored hours (up to 2 decimals). It is kept exactly as sent and is never rescaled. |
| `minutes` | A changed or new line's time, in minutes. |
| `hours` | A changed or new line's time, in decimal hours (a duration, like `minutes`). |
| `duration` | A changed or new line's time as text: `45`, `45m`, `1.5h`, `1h 30m`, `1:30`. |

## How hours are assigned

1. **Exact lines** (`exact_hours`) keep their hours.
2. **Changed lines** (`minutes`, `hours` or `duration`) share the time that's left: the entry's hours minus the exact lines' hours. The split is proportional to their minutes, with cumulative rounding, so the parts add up exactly.
3. The changed lines' minutes must come within **1 minute** of that remainder. At clock-out the limit is 6 minutes, because the clock keeps running while the form is open. One extra minute is allowed per exact line, since rounded display minutes can be that far off.
4. A **day log** (a manual entry with no start or end time) takes its hours from its lines: the exact hours plus the changed lines' minutes.

The request is rejected with **422** and nothing is changed when:
- only exact lines are sent and they don't add up to the entry (for example, the entry's times changed). At least one line must change;
- the exact lines already use all of the entry's time, so the changed lines would get nothing;
- the changed lines are further from the remainder than allowed;
- a changed line would round to 0.00h.

Untouched lines are **never** altered to make a request fit.

## Clients

Send `exact_hours` for every line whose time the person didn't edit, using the value the API returned in `work_lines[].hours`. Send `minutes` for lines they edited or added. If `exact_hours` aren't sent, a description-only edit can move 0.01h between lines, because rounded display minutes are not the stored hours.

Example: stored hours [0.08, 0.08, 0.14, 0.05, 0.17, 0.19] (an entry of 0.71h) are shown as minutes [5, 5, 8, 3, 10, 12]. The person changes the first two to 4 and 6:

```json
[{"minutes": 4}, {"minutes": 6}, {"exact_hours": 0.14}, {"exact_hours": 0.05}, {"exact_hours": 0.17}, {"exact_hours": 0.19}]
```

The result is [0.06, 0.10, 0.14, 0.05, 0.17, 0.19]: the changed lines share the 0.16h left, and the others are untouched.

## Version check (`expected_version`)

Every time entry has a `version` (an integer, serialized exactly). It goes up on **every** change to the entry and on every create, update or delete of one of its work lines, in the same transaction. That includes changing only a split, for example [4h, 4h] → [3h, 5h]. Use `version`, not `updated_at`, to detect changes: `updated_at` doesn't move when only lines change, and two changes can land in the same second.

- **Edits** (`PATCH /api/v1/time_entries/:id`) may send `expected_version`, either top-level or inside `time_entry`: the `version` the client was editing. The server compares it under the entry's row lock. If it differs, nothing is saved and the response is **409**:
  ```json
  {"error": "This entry was changed elsewhere after you started. Nothing was saved.", "code": "version_conflict", "time_entry": { …current entry… }}
  ```
  Of two saves sent with the same `expected_version`, exactly one wins; the other gets the 409.
- **Day logs** (`POST` with `work_lines` and no start or end time): if the person already has a non-denied day log for that date, the response is **409** with the same `code` and the **existing** day log in `time_entry`. Send `additional_day_log: true` to create a separate one on purpose. Concurrent creates for the same person are serialized, so only one gets through.
- **Optional.** Clients that don't send `expected_version` (clock-out, older screens, scripts) keep working, last write wins, as before. The app's Log my day and edit modals always send it. On a 409 they refetch the entry and show the conflict panel: "Save my lines as a separate day log" or "Discard my lines".

## Cutover rule

From Settings → "Require client and description from": every line needs a client and a description; internal lines (Internal – Cornerstone) also need a category; the task is always optional.
