# Payroll Work Hours feed (v1)

Cornerstone Tax sends Cornerstone Payroll the hours each person worked, by client, category, task and period. Payroll adds staff pay, employer taxes and client fees on its side to work out cost and profit per client.

This feed is separate from the [Time Summary v1](https://github.com/Shimizu-Technology/cornerstone-payroll/blob/main/docs/TIME_TRACKING_V1_CONTRACT.md) feed (`GET /api/v1/payroll/time_summary`), which is for paying staff. The two differ in three ways:

- **This feed is read-only.** It does not record a payroll export and does not protect (lock) time entries, so editing an entry after Payroll has read this feed needs no correction reason.
- **Its rows come from work lines**, not from whole entries. One clock session split across three clients becomes three rows.
- **It never carries pay data:** no pay rates, wages, salaries, SSNs or bank details. Tax does not hold pay data and must never send it.

## Request

```
GET /api/v1/payroll/work_hours?start=YYYY-MM-DD&end=YYYY-MM-DD
X-Work-Hours-Timestamp: <unix seconds>
X-Work-Hours-Signature: <hex HMAC-SHA256>
```

| Parameter | Required | Notes |
|---|---|---|
| `start` | yes | First work date, inclusive. `start_date` is accepted as an alias. |
| `end` | yes | Last work date, inclusive, at most 62 days after `start`. `end_date` is accepted as an alias. |

### Authentication: signed requests

Every request is signed with HMAC-SHA256, using the shared secret `PAYROLL_WORK_HOURS_SECRET`. The secret itself is never sent.

- **Separate secret.** It is separate from the time summary's `PAYROLL_SHARED_SECRET`. Rotate each one on its own, and never reuse one for the other.
- **`X-Work-Hours-Timestamp`:** the current time in unix seconds, as a plain integer.
- **`X-Work-Hours-Signature`:** lower-case hex `HMAC-SHA256(secret, string_to_sign)`, where `string_to_sign` is these five lines joined with `\n` and no trailing newline:
  1. the HTTP method in upper case, e.g. `GET`;
  2. the path without the query string: `/api/v1/payroll/work_hours`;
  3. the **canonical query**:
     - take every `name=value` pair and percent-decode it;
     - re-encode the name and the value per RFC 3986: keep `A–Z a–z 0–9 - _ . ~`, and encode everything else as `%XX` with upper-case hex (a space is `%20`, not `+`);
     - sort the pairs by name, then by value;
     - join them with `&`;
     - the line is empty when there is no query;
  4. the timestamp, exactly as sent in the header;
  5. the lower-case hex SHA-256 of the raw request body (for a GET, the hash of the empty string: `e3b0c442…b855`).

The server rejects:
- a timestamp more than **5 minutes** from its own clock, in either direction;
- a signature that doesn't match. The comparison is constant-time (`ActiveSupport::SecurityUtils.secure_compare`).

**Each query parameter may appear only once.** A request with any repeated name, compared after percent-decoding (so `start=…&st%61rt=…` counts), is refused with **400** before the signature is checked. Rails keeps only the last value of a repeated key, while the canonical query sorts all of them, so one signature would otherwise cover `start=A&start=B` and `start=B&start=A`, which mean different start dates.

Changing any part of the query after signing (dates, extra parameters) invalidates the signature. Pair order and percent-encoding don't matter, because both sides canonicalize.

The 5-minute window limits how long a captured request can be replayed. The feed is read-only and returns the same data to a replay, so no nonce store is kept. Keep both servers' clocks synced (NTP).

#### Ruby signer for Payroll

The spec `spec/requests/api/v1/payroll/work_hours_spec.rb` loads this exact block from this file and calls the endpoint with it, so it stays correct.

```ruby
require "erb"
require "net/http"
require "openssl"
require "uri"

# Signs a Work Hours v1 request. query is a Hash of params; returns
# [request_uri, headers]. Matches Payroll::WorkHoursSignature in Tax.
module WorkHoursSigner
  module_function

  def canonical_query(query)
    query.map { |name, value| [ name.to_s, value.to_s ] }.sort
         .map { |name, value| "#{ERB::Util.url_encode(name)}=#{ERB::Util.url_encode(value)}" }.join("&")
  end

  def signed(secret:, query:, path: "/api/v1/payroll/work_hours", method: "GET", body: "", now: Time.now)
    canonical = canonical_query(query)
    timestamp = now.to_i.to_s
    string_to_sign = [ method.upcase, path, canonical, timestamp, OpenSSL::Digest::SHA256.hexdigest(body) ].join("\n")
    signature = OpenSSL::HMAC.hexdigest("SHA256", secret, string_to_sign)
    [ canonical.empty? ? path : "#{path}?#{canonical}",
      { "X-Work-Hours-Timestamp" => timestamp, "X-Work-Hours-Signature" => signature } ]
  end
end

# Example:
#   uri, headers = WorkHoursSigner.signed(secret: ENV.fetch("PAYROLL_WORK_HOURS_SECRET"),
#                                         query: { start: "2026-11-16", end: "2026-11-29" })
#   http = Net::HTTP.new("tax.example.com", 443).tap { |h| h.use_ssl = true }
#   response = http.get(uri, headers)
```

| Status | Meaning |
|---|---|
| 200 | Payload below |
| 400 | A query parameter appears more than once (`{ "error": "Each query parameter may appear only once (repeated: …)" }`) |
| 401 | Missing headers, a timestamp outside the window, or a signature that doesn't match (`{ "error": "Unauthorized: ..." }`) |
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
