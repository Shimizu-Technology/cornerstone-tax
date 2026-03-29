# AIRE Ops Implementation (Cornerstone Tax Base)

## Decision
AIRE day-to-day operations app is built from **cornerstone-tax**, not cornerstone-payroll.

## Phase 1 delivered in this branch
- Added AIRE route scaffold in frontend:
  - `/aire`
  - `/aire/programs`
  - `/aire/team`
  - `/aire/contact`
  - `/aire/kiosk` (full-screen iPad-style kiosk UI shell)
- Added time-category rate support:
  - `time_categories.key`
  - `time_categories.hourly_rate_cents`
- Added AIRE seed categories and rates:
  - `AIRE Flight Time` (3000)
  - `AIRE Ground Teaching` (3000)
  - `AIRE Admin Office` (1000)
- Updated time category APIs to expose key/rate fields.
- Updated clock-in flow to accept optional `time_category_id` and persist it on the clock entry.

## Next implementation steps
1. Kiosk authentication (PIN/code) + secure backend endpoint.
2. Staff lookup + clock actions from kiosk (clock in/out, break in/out).
3. Manager approval + correction UX tuned for AIRE workflows.
4. Payroll handoff endpoint/format for Cornerstone Payroll consumption.
5. Brand/content migration from current AIRE website assets.
