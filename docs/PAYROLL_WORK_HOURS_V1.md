# Payroll Work Hours v1

Cornerstone Tax sends Cornerstone Payroll the hours each person worked, by client, category, task and period. Payroll adds staff pay, employer taxes and client fees on its side to work out cost and profit per client.

This feed is separate from the [Time Summary v1](https://github.com/Shimizu-Technology/cornerstone-payroll/blob/main/docs/TIME_TRACKING_V1_CONTRACT.md) feed (`GET /api/v1/payroll/time_summary`), which is for paying staff. The two differ in three ways:

- **This feed is read-only.** It does not record a payroll export and does not protect (lock) time entries, so editing an entry after Payroll has read this feed needs no correction reason.
- **Its rows come from work lines**, not from whole entries. One clock session split across three clients becomes three rows.
- **It never carries pay data:** no pay rates, wages, salaries, SSNs or bank details. Tax does not hold pay data and must never send it.

## Request

```
GET /api/v1/payroll/work_hours?start=YYYY-MM-DD&end=YYYY-MM-DD
X-Work-Hours-Secret: <PAYROLL_WORK_HOURS_SECRET>
```

| Parameter | Required | Notes |
|---|---|---|
| `start` | yes | First work date, inclusive. `start_date` is accepted as an alias. |
| `end` | yes | Last work date, inclusive, at most 62 days after `start`. `end_date` is accepted as an alias. |

**Authentication.** Set `PAYROLL_WORK_HOURS_SECRET` on both apps, and send it in the `X-Work-Hours-Secret` header.

- This secret is **separate from `PAYROLL_SHARED_SECRET`**. Rotate each one on its own.
- The server compares the header with `ActiveSupport::SecurityUtils.secure_compare`, which digests both values first, so the comparison takes the same time whatever is sent.

| Status | Meaning |
|---|---|
| 200 | Payload below |
| 401 | Missing or wrong `X-Work-Hours-Secret` |
| 422 | Missing or invalid dates, `end` before `start`, or a range over 62 days (`{ "error": "..." }`) |
| 503 | `PAYROLL_WORK_HOURS_SECRET` is not configured on Tax |

## Response

```json
{
  "schema_version": "1.0",
  "source": "cornerstone_tax",
  "start_date": "2026-11-16",
  "end_date": "2026-11-29",
  "generated_at": "2026-11-30T01:00:00Z",
  "rows": [
    {
      "tax_user_id": 12,
      "email": "staff@example.com",
      "work_date": "2026-11-16",
      "client_id": 345,
      "client_name": "Example Co",
      "system_kind": null,
      "unassigned": false,
      "category_id": 3,
      "category": "Bookkeeping",
      "task_id": 9,
      "task": "Bank reconciliation",
      "period_type": "month",
      "period_start": "2026-10-01",
      "period_label": "October 2026",
      "hours": 2.5,
      "minutes": 150,
      "entry_ids": [1001, 1004],
      "approval_state": "approved"
    }
  ],
  "day_totals": [
    {
      "tax_user_id": 12,
      "email": "staff@example.com",
      "work_date": "2026-11-16",
      "countable_hours": 7.5,
      "pending_hours": 0.0,
      "unassigned_hours": 1.0
    }
  ],
  "counts": {
    "pending_entries": 1,
    "denied_entries": 0,
    "open_clock_entries": 0,
    "by_user": [
      { "tax_user_id": 12, "email": "staff@example.com", "pending_entries": 1, "denied_entries": 0, "open_clock_entries": 0 }
    ]
  }
}
```

### Rows

Each row has one person's hours for one date, client, category, task, period and approval state, summed across that person's work lines.

| Field | Meaning |
|---|---|
| `tax_user_id`, `email` | The Tax user. Match people on these values. Tax sends no other personal data. |
| `client_id`, `client_name` | The client the work was for. Clients are businesses or individuals. |
| `system_kind` | `"internal"` for **Internal – Cornerstone** (Cornerstone's own office work, errands, meetings, training and admin). `null` for real clients. |
| `unassigned` | `true` when the work line has no client. Then `client_id` is `null` and `client_name` is `"Unassigned"`. These rows are always included, so totals add up. |
| `category_id`, `category` | The line's category. For older entries that only have a legacy category, `category_id` is `null` and `category` reads `"<name> (legacy)"`. |
| `task_id`, `task`, `period_*` | Optional detail. `period_start` is the first day of the month, quarter or year the work applies to. |
| `hours` | Decimal hours, 2 places. Work lines always add up exactly to their entry's hours. |
| `minutes` | `hours × 60`, rounded. |
| `entry_ids` | The Tax time entries behind the row. One entry can appear in several rows. |
| `approval_state` | `approved` (approved by an admin), `clock` (a clock entry that needs no approval; it counts like approved), or `pending` (waiting for an admin). |

Rows **leave out** denied entries and open clocks. Those appear only in `counts`.

### Day totals

There is one row per person per date that has reported time.

- `countable_hours`: approved plus clock hours. **This equals the `hours` that `GET /api/v1/payroll/time_summary` reports for the same person and day.** Days with no countable time are omitted here, while the time summary lists them as zero.
- `pending_hours`: hours still waiting for approval.
- `unassigned_hours`: hours on lines with no client.
- The rows for a person and day add up to `countable_hours + pending_hours`.

### Counts

`pending_entries`, `denied_entries` and `open_clock_entries` cover the whole range, overall and per person. Payroll should treat a period that still has pending entries or open clocks as not final, just as with the time summary.

## Versioning

`schema_version` changes only for breaking changes. New fields may be added within 1.x. Consumers must ignore fields they don't know.
