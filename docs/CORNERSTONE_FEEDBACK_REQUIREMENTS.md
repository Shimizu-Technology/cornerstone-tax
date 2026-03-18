# Cornerstone Team — Requested Fixes & Features

**Date:** March 18, 2026
**Source:** Written feedback document from Cornerstone Accounting & Business Services

---

## Recommended Build Order

| Phase | Item | Priority | Effort |
|-------|------|----------|--------|
| 1A | Multiple 1099 Entry Support | Highest | Small |
| 1B | Centralized Document Upload | Highest | Medium |
| 1C | Client Portal with Status Tracking | Highest | Large |
| 2 | Better Dependent Guidance | Medium | Very Small |
| 3 | Time Clock / Employee Attendance Rules (5A–5D) | Lower | Large |

---

## 1. Multiple 1099 Entry Support

### Problem
The intake form currently only allows one 1099 entry per type. Clients with multiple 1099s of the same type (e.g., two 1099-INT forms from different banks) get stuck because there's no way to add more than one payer per 1099 type.

### Root Cause
In the frontend, `form_1099_payer_names` is typed as `Record<string, string>` — a single payer name per 1099 type. The backend and database already support multiple income sources per type.

### What Needs to Change

**Frontend only — no backend changes required.**

| File | Change |
|------|--------|
| `frontend/src/types/intake.ts` | Change `form_1099_payer_names` from `Record<string, string>` to `Record<string, string[]>` |
| `frontend/src/pages/intake/IntakeForm.tsx` | Update `StepIncomeSources` to render multiple payer inputs per 1099 type with "Add Another" and remove buttons (mirror the W-2 employer pattern) |
| `frontend/src/pages/intake/IntakeForm.tsx` | Update `toggle1099Type` to initialize with `['']` instead of clearing |
| `frontend/src/pages/intake/IntakeForm.tsx` | Update `handleSubmit` to flatMap payer arrays into individual income_source entries |

### Backend (no changes)
- `CreateIntakeService` already iterates over `income_sources` array and creates one `IncomeSource` per entry
- `income_sources` table already supports multiple rows per `source_type` per `tax_return`

### Expected Result
A client with 2+ 1099s of the same type can enter all of them without getting stuck.

---

## 2. Centralized Document Upload

### Problem
Clients upload some files through the site but still email other tax documents separately. This splits information across multiple places and makes tracking harder.

### Current State
- Document upload exists on the **admin tax return detail page** only (staff-only)
- S3 presigned upload/download works end-to-end
- Document types supported: W-2, 1099, ID, Prior Return, Other
- `uploaded_by_id` is optional on the Document model (ready for client uploads)

### What Needs to Change

| Area | Change |
|------|--------|
| **Document model** | Add `supporting_documents` to `DOCUMENT_TYPES` |
| **Client-facing upload** | Create a document upload component accessible to clients (ties into Client Portal — Item 3) |
| **Intake form integration** | Consider adding optional document upload step to the intake form |
| **Reusable upload component** | Extract `DocumentUpload` into a shared component usable in admin, client portal, and intake |
| **API authorization** | Add client-scoped document endpoints (client can only see/upload for their own tax returns) |

### Dependencies
- Partially depends on **Item 3 (Client Portal)** for the client-facing upload surface
- Can be started independently by adding upload to the intake form

### Expected Result
All client tax documents stay attached to the client record in one place instead of being split between the site and email.

---

## 3. Client Portal with Status Tracking

### Problem
Clients do not have a clear way to see the status of their return, and staff need a better way to track where each client is in the process.

### Current State
- `User` model already has `role: "client"` with `client_id` linkage
- Clerk auth infrastructure is in place
- Workflow stages are already configurable in the admin
- No client-facing routes, pages, or API endpoints exist

### What Needs to Be Built

#### Backend
| Area | Change |
|------|--------|
| **Client API controller** | New `Api::V1::Portal::*` controllers with client-scoped access |
| **Authorization** | `require_client!` concern — client can only access their own data |
| **Endpoints needed** | `GET /portal/me` (profile), `GET /portal/tax_returns` (my returns + status), `GET /portal/documents` (my documents), `POST /portal/documents` (upload) |
| **Intake continuation** | Endpoint to retrieve/update incomplete intake (future) |

#### Frontend
| Area | Change |
|------|--------|
| **Routes** | `/portal`, `/portal/returns`, `/portal/returns/:id`, `/portal/documents` |
| **Pages** | `PortalDashboard`, `PortalReturnStatus`, `PortalDocuments` |
| **Layout** | `PortalLayout` — simpler than admin, client-friendly |
| **Auth** | Client login flow via Clerk (separate from staff login) |
| **Document upload** | Reuse shared upload component within portal |

#### Suggested Statuses (from Cornerstone team)
These map to configurable workflow stages:
1. Intake Started
2. Waiting on Documents
3. Documents Received
4. In Review
5. In Progress
6. Ready to File
7. Filed
8. Completed
9. Not Moving Forward

### Expected Result
Both staff and clients can see where things stand without searching through messages or email threads. Clients can log in, view return status, see missing documents, and upload files.

---

## 4. Better Dependent Guidance

### Problem
Users are confused about whether they can claim a dependent, especially older children or children in college.

### Current State
The dependent section has one line of helper text: *"Add any dependents you want to claim on your tax return."* No field-level guidance exists.

### What Needs to Change

| File | Change |
|------|--------|
| `frontend/src/pages/intake/IntakeForm.tsx` | Add helper text in the `StepDependents` component explaining college-age dependent eligibility |

### Suggested Wording (from Cornerstone team)
> "You may still be able to claim your child as a dependent even if they are in college, depending on age, student status, support, and residency."

### Expected Result
Less confusion and fewer repeated questions during intake.

---

## 5. Time Clock / Employee Attendance Rules

### Problem
The clock-in and clock-out system needs stricter controls so staff follow schedule rules and overtime is managed properly.

### Current State
- Time tracking is **100% manual entry** — no clock in/out system
- No same-day validation (overlapping entries allowed)
- No schedule-based validation (no link between schedules and time entries in the DB)
- No overtime tracking or approval workflow
- Schedules exist but are only connected to time entries via URL prefill (no DB relationship)

### Sub-Items

#### 5A. Same-Day Clock In/Out Lock
| Area | Change |
|------|--------|
| **Backend validation** | Time entries can only be created/edited for the current day unless admin overrides |
| **Model** | Add `admin_override` boolean to `time_entries` |
| **Controller** | Reject backdated entries from non-admin users |

**Expected result:** No backdated time entries without admin approval.

#### 5B. Schedule-Based Validation
| Area | Change |
|------|--------|
| **Database** | Add `schedule_id` foreign key to `time_entries` |
| **Backend logic** | When creating a time entry, look up the user's schedule for that day |
| **Validation** | Flag entries as early, on-time, late, or over-scheduled-hours |
| **Response data** | Include schedule comparison info in time entry responses |

**Expected result:** The system knows whether an employee is early, on time, late, or going over scheduled hours.

#### 5C. Early Clock-In Approval
| Area | Change |
|------|--------|
| **Approval model** | New `time_entry_approvals` table (or `approval_status` on `time_entries`) |
| **Backend logic** | If `start_time < scheduled_start_time`, require approval |
| **Workflow** | Manager/admin approval flow (approve/deny early clock-in) |
| **UI** | Approval queue in admin dashboard |

**Expected result:** Employees cannot start early unless approved.

#### 5D. Overtime Approval Rule
| Area | Change |
|------|--------|
| **Backend logic** | Track daily (>8h) and weekly (>40h) hours per employee |
| **Approval** | If entry would push employee into overtime, require approval |
| **Request flow** | Employee requests overtime → admin approves → entry allowed |
| **Notification** | Could tie into Cornerstone team chat for approval |

**Expected result:** Overtime is controlled and documented.

### Database Changes Required
```
time_entries:
  + schedule_id (bigint, FK, nullable)
  + admin_override (boolean, default: false)
  + approval_status (string: pending/approved/denied, nullable)
  + approved_by_id (bigint, FK to users, nullable)
  + approved_at (datetime, nullable)
  + overtime_approved (boolean, default: false)
```

Or alternatively, a separate `time_entry_approvals` table for a cleaner audit trail.

### Expected Result
The time clock system has schedule awareness, same-day restrictions, early clock-in approval, and overtime controls.

---

## Notes for Development (from Cornerstone team)

- Multiple 1099s likely need a has_many relationship instead of a single field/value → **Already supported in DB; frontend is the bottleneck**
- Document uploads should be tied directly to the client record or tax return record → **Already tied to tax_return; need client-facing access**
- Status tracking should be visible on both internal admin/staff dashboard and client-facing portal → **Workflow stages exist; need client portal**
- Time clock logic should be schedule-aware and include an approval override path → **Requires significant new backend logic**
