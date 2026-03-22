# Cornerstone Team — Requested Fixes & Features

**Date:** March 18, 2026
**Source:** Written feedback document from Cornerstone Accounting & Business Services
**Last Updated:** March 20, 2026

---

## Status Overview

| Phase | Item | Priority | Effort | Status |
|-------|------|----------|--------|--------|
| 1A | Multiple 1099 Entry Support | Highest | Small | **DONE** |
| 1B | Centralized Document Upload | Highest | Medium | **Partially Done** — see implementation plan below |
| 1C | Client Portal with Status Tracking | Highest | Large | **DONE** |
| 2 | Better Dependent Guidance | Medium | Very Small | **DONE** |
| 3 | Time Clock / Employee Attendance Rules (5A–5D) | Lower | Large | **DONE** — PR `feature/time-clock-attendance` |

---

## 1. Multiple 1099 Entry Support — DONE

### What Was Built
- `form_1099_payer_names` changed from `Record<string, string>` to `Record<string, PayerEntry[]>` (stable React keys via `id` + `name`)
- "Add Another {type}" button per 1099 type with remove buttons (mirrors W-2 employer pattern)
- `handleSubmit` uses `flatMap` to turn payer arrays into individual `income_source` entries
- Frontend-only change; backend already supported multiple income sources per type

---

## 2. Centralized Document Upload — PARTIALLY DONE

### What's Already Built
- **Admin document upload** — Full CRUD on tax return detail page (presign → S3 → register, view, download, delete)
- **Portal document upload** — Client-scoped upload/view on portal documents page with notification on upload
- **S3 infrastructure** — Presign flow, validation (PDF/JPEG/PNG, 50MB), download URLs all working
- **Client-scoped API** — `Api::V1::Portal::DocumentsController` with `current_client` scoping
- **Document types** — w2, 1099, id, prior_return, other

### What's Still Needed

#### 2A. Add `supporting_documents` document type (Trivial)
Clients need to upload bank statements, mortgage interest statements (1098), property tax records, childcare receipts, charitable donation receipts, business expense records, student loan interest (1098-E), tuition statements (1098-T), etc. Currently these all go under "Other" which is vague.

**Changes:**
- `backend/app/models/document.rb` — Add `supporting_documents` to `DOCUMENT_TYPES`
- `frontend/src/lib/documentConstants.ts` — Add `{ value: 'supporting_documents', label: 'Supporting Documents' }` to `DOCUMENT_TYPES`

#### 2B. Document upload step in the intake form (Medium — the key missing piece)

**The Problem:** Clients fill out intake, submit, then email W-2s and 1099s separately. Documents end up split across the site and email.

**The Challenge:** The intake form is unauthenticated — the tax return doesn't exist until `CreateIntakeService` runs after submit.

**Recommended Approach: Post-Submission Upload (Option A)**

Rather than uploading during form fill (which requires managing orphaned S3 files if someone abandons the form), show a document upload screen *after* successful submission:

1. `CreateIntakeService` creates the client + tax return as today
2. The API response returns the `tax_return_id` (it may already — verify)
3. Instead of showing just a "Success!" message, show a new step: **"Upload Your Documents"**
4. This step shows smart prompts based on the income sources they selected:
   - Selected W-2? → "Please upload your W-2 from {employer name}"
   - Selected 1099-INT? → "Please upload your 1099-INT from {payer name}"
   - Always show: "Upload your Photo ID" and "Upload any other supporting documents"
5. Uses a new lightweight **intake document upload endpoint** (no auth required, scoped to the just-created tax return via a one-time token or the tax return ID)
6. "Skip — I'll upload later" button for clients who don't have documents handy
7. Documents are attached to the tax return, visible in admin and portal immediately

**Backend changes needed:**
- New `Api::V1::IntakeDocumentsController` with `presign` and `create` actions
- Scoped to the tax return ID returned from intake submission
- Security: either a short-lived token returned with the intake response, or rate-limited by tax return ID + time window (e.g., only allow uploads within 1 hour of creation)
- Triggers `DocumentUploadNotificationJob` same as portal uploads

**Frontend changes needed:**
- New `StepDocumentUpload` component in the intake form
- Shown after successful submission (step 9, after Authorization)
- Smart prompts based on selected income sources and employer/payer names
- Drag-and-drop upload with document type pre-selection
- Progress states and success confirmation per file
- "Skip" and "Done" buttons

**Why this approach:**
- No orphaned S3 files from abandoned forms
- Simpler implementation (tax return already exists when uploading)
- Clear two-step UX: "Submit info" → "Upload documents"
- Client sees exactly what documents are expected based on their income sources

#### 2C. Shared DocumentUpload component (Nice-to-have, can defer)

Currently admin (`DocumentUpload.tsx`) and portal (`PortalDocuments.tsx`) have separate upload implementations. Extracting a shared component would reduce duplication. This is a refactor that can wait — both implementations work independently.

---

## 3. Client Portal with Status Tracking — DONE

### What Was Built
- `Api::V1::Portal::*` controllers with `require_client!` authorization
- Client-scoped access (can only see own data)
- Portal pages: Dashboard, Return Status, Documents, Settings, Notifications
- Client login flow via Clerk (separate from staff login)
- Document upload within portal
- Real-time status tracking with configurable workflow stages
- In-app notification system
- Document viewer (inline PDF/image viewing)

---

## 4. Better Dependent Guidance — DONE

### What Was Built
- Blue info box in `StepDependents` with the suggested wording:
  > "You may still be able to claim your child as a dependent even if they are in college, depending on age, student status, support, and residency. If you're unsure, go ahead and add them — our team will verify eligibility during the review."

---

## 5. Time Clock / Employee Attendance Rules — DONE

### What Was Built (PR: `feature/time-clock-attendance`)

All sub-items (5A–5D) implemented:

- **TimeClockService** — Centralized service for all clock/break/approval logic
- **Clock in/out with break tracking** — Real-time timer UI, start/end break actions
- **Schedule-based validation** — Configurable early clock-in buffer, post-shift guard, attendance status (early/on-time/late)
- **Manual entry approval workflow** — Manual entries require admin approval; employees can resubmit denied entries
- **Overtime detection & approval** — Configurable daily (>8h) and weekly (>40h) thresholds, separate overtime approval queue
- **"Today's Team" admin panel** — Live dashboard showing who's working, on break, late, done, or no-show
- **Database safety** — Partial unique indexes (one active clock-in per user, one active break per entry), row-level locking on approvals, transactions for multi-step operations
- **Admin overrides** — Clock in/out/break for other employees, override schedule restrictions
- **Timezone handling** — Consistent Guam timezone throughout, `formatDateISO` shared utility

### Database additions:
- `time_entries`: schedule_id, entry_method, status, clock_in_at, clock_out_at, admin_override, attendance_status, approval_status, approved_by_id, approved_at, approval_note, overtime_status, overtime_approved_by_id, overtime_approved_at, overtime_note
- `time_entry_breaks`: time_entry_id, start_time, end_time, duration_minutes
- Partial unique indexes for active clock-ins and active breaks

---

## Notes for Development (from Cornerstone team)

- Multiple 1099s likely need a has_many relationship instead of a single field/value → **DONE — frontend uses `PayerEntry[]`; backend already supported it**
- Document uploads should be tied directly to the client record or tax return record → **DONE for admin & portal; intake upload still needed**
- Status tracking should be visible on both internal admin/staff dashboard and client-facing portal → **DONE — workflow stages visible in both**
- Time clock logic should be schedule-aware and include an approval override path → **DONE — full implementation with configurable rules**

---

## Future Enhancements (Documented for Later)

### Configurable Task Statuses (Daily Task Board)
Currently the 10 daily task statuses are hardcoded in the model and frontend constants (`not_started`, `in_progress`, `dms_reviewing`, `ready_to_file`, `ready_for_signature`, `completed`, `filed_with_drt`, `filed_with_irs`, `pending_info`, `other`). These match Cornerstone's current workflow and are unlikely to change frequently.

**When to implement:** If Cornerstone requests custom statuses, or if we onboard additional firms with different workflows.

**Implementation approach:**
- Create a `task_statuses` database table (name, label, display_order, color, is_done_status)
- Admin settings UI for managing statuses (add/rename/reorder/archive)
- Update `DailyTask` model to validate against DB statuses instead of a constant
- Update frontend to fetch statuses from API instead of hardcoded `STATUS_OPTIONS`
- Migration to seed current statuses as initial data

### GPS Geofencing for Time Clock (Office-Only Clock In/Out)
Restrict clock-in and clock-out to employees who are physically at the office, similar to warehouse clock-in systems (e.g., Amazon). Uses the browser's Geolocation API so it works on both desktop and mobile.

**When to implement:** When the team is ready to enforce location-based attendance, or if remote clock-in abuse becomes a concern.

**Implementation approach:**

*Admin Settings:*
- New settings: `geofence_enabled` (boolean toggle), `office_latitude`, `office_longitude`, `geofence_radius_meters` (default ~150m)
- Settings UI with a map preview showing the office pin and radius circle
- Option to enter address and geocode to lat/lng, or drop a pin on a map

*Frontend (ClockInOutCard):*
- On clock-in/out attempt (when geofence is enabled), request browser geolocation via `navigator.geolocation.getCurrentPosition()`
- Send employee's `latitude` and `longitude` with the clock-in/out API request
- Handle permission denied gracefully — show a clear message explaining location is required
- Show a loading state while acquiring GPS ("Checking your location...")

*Backend (TimeClockService):*
- Validate distance using the Haversine formula (no external API needed — pure math)
- If distance > configured radius → reject with error: "You must be at the office to clock in (you appear to be ~X meters away)"
- Store `clock_in_latitude` and `clock_in_longitude` on the time entry for audit purposes
- Admin override bypasses geofence check (admins can clock someone in remotely)

*Edge cases to handle:*
- **Location permission denied**: Block clock-in, show instructions on how to enable location in browser settings
- **GPS inaccuracy indoors**: Use a generous radius (~150m minimum) to avoid false rejections; consider allowing a configurable buffer
- **Remote work days**: Admin can either disable geofence per-employee/per-day via a schedule flag, or temporarily disable globally
- **GPS spoofing**: Low risk for a small firm; no additional protection needed beyond standard browser geolocation
- **Admin exemption**: Configurable — admins can optionally be exempt from geofence, or subject to it like everyone else

*Database changes:*
- Add `clock_in_latitude` and `clock_in_longitude` (decimal) columns to `time_entries` for audit trail
- New settings keys: `geofence_enabled`, `office_latitude`, `office_longitude`, `geofence_radius_meters`

### WebSocket Real-Time Updates (Daily Task Board & Beyond)
Currently the Daily Task Board uses 5-second polling for near-real-time updates. This works well for a small team but should be upgraded to proper WebSockets as the team or feature set grows.

**When to implement:** When the team grows beyond ~10 concurrent users, or when we want instant updates across other features (time clock, notifications, client portal status).

**Implementation approach:**
- ActionCable is already loaded in the Rails app (`config/cable.yml` configured for async/dev, solid_cable/production)
- Create a `DailyTasksChannel` that broadcasts on task create/update/delete/reorder
- Frontend subscribes via `@rails/actioncable` npm package
- Replace polling with WebSocket subscription; keep polling as fallback for reconnect
- Extend pattern to other real-time features: time clock "Today's Team", notification badges, portal status updates
