# PRD: Client Services & Task-Level Time Tracking

**Status:** ✅ Approved - Ready for Implementation  
**Created:** January 2026  
**Last Updated:** January 2026

---

## 1. Problem Statement

Currently, the system treats all clients as "tax return clients" who go through the intake form and have tax returns associated with them. However, Cornerstone also provides **ongoing services** like payroll processing for business clients who:
- Don't necessarily have a tax return
- Need regular time tracked against them
- Require more granular task-level tracking ("What specific task was done?")

Employees need to accurately track time by client AND by specific task to understand where time is being spent.

---

## 2. Goals

### Primary Goals
1. Support different client types (tax clients, payroll clients, bookkeeping clients, etc.)
2. Allow quick creation of service-only clients (no intake form required)
3. Enable granular time tracking at the task level
4. Maintain clean data for future reporting and billing

### Non-Goals (Out of Scope)
- Workflow tracking for non-tax services (future enhancement)
- Automated billing/invoicing based on time
- Client portal access for service clients

---

## 2.5 What's Configurable

Everything is admin-configurable. No hardcoding of business-specific data.

| Item | Configurable? | Where |
|------|---------------|-------|
| Service Types | ✅ Yes | Admin Settings |
| Tasks per Service | ✅ Yes | Admin Settings |
| Service names/descriptions | ✅ Yes | Admin Settings |
| Task names/descriptions | ✅ Yes | Admin Settings |
| Display order | ✅ Yes | Drag or arrows |
| Active/Inactive status | ✅ Yes | Soft delete |

**Seed data** is provided as a starting point based on the Cornerstone website, but admins can modify everything.

---

## 3. User Stories

### Client Management
- [ ] As an admin, I can create a client without going through the full intake form
- [ ] As an admin, I can assign service types to a client (e.g., Payroll, Tax Prep, Bookkeeping)
- [ ] As an admin, I can configure the list of available service types
- [ ] As an admin, I can view and filter clients by service type

### Time Tracking
- [ ] As an employee, I can select a client when logging time (including non-tax clients)
- [ ] As an employee, I can select the service type I was working on
- [ ] As an employee, I can select a specific task within that service
- [ ] As an admin, I can configure tasks for each service type
- [ ] As an admin, I can see time reports broken down by service and task

---

## 4. Data Model Changes

### New Tables

#### `service_types`
Admin-configurable list of services offered.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| name | string | Service name (e.g., "Payroll") |
| description | text | Optional description |
| color | string | Optional color for UI |
| is_active | boolean | Soft delete |
| position | integer | Sort order |
| created_at | timestamp | |
| updated_at | timestamp | |

**Default seed data (from Cornerstone website + internal):**
1. Tax Preparation & Planning
2. Accounting & Bookkeeping
3. Payroll & Compliance
4. Financial Statement Preparation
5. Business Advisory & Consulting
6. QuickBooks & Cloud Accounting
7. General/Administrative *(for internal work, meetings, misc)*

> **Note:** These are fully configurable by admins. They can add, edit, delete, or reorder as needed.

#### `service_tasks`
Tasks within each service type.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| service_type_id | integer | FK to service_types |
| name | string | Task name (e.g., "Payroll Processing") |
| description | text | Optional description |
| is_active | boolean | Soft delete |
| position | integer | Sort order within service |
| created_at | timestamp | |
| updated_at | timestamp | |

**Default seed data (from Cornerstone website features):**

- **Tax Preparation & Planning:**
  - Individual tax returns (Form 1040)
  - Business tax returns (1120, 1120S, 1065)
  - Guam and federal tax filing
  - Tax planning and strategy
  - Prior year returns and amendments

- **Accounting & Bookkeeping:**
  - Monthly bookkeeping
  - Account reconciliation
  - General ledger maintenance
  - Chart of accounts setup
  - Clean-up and catch-up services

- **Payroll & Compliance:**
  - Payroll processing
  - Payroll tax filings
  - W-2 and 1099 preparation
  - New hire reporting
  - Compliance monitoring

- **Financial Statement Preparation:**
  - Balance sheets
  - Income statements
  - Cash flow statements
  - Custom financial reports
  - Trend analysis

- **Business Advisory & Consulting:**
  - Business entity selection
  - Financial planning
  - Cash flow management
  - Growth strategy
  - Exit planning

- **QuickBooks & Cloud Accounting:**
  - QuickBooks setup and training
  - Data migration
  - Cloud accounting solutions
  - Software integration
  - Ongoing support

- **General/Administrative:**
  - Team meeting
  - Training
  - Administrative work
  - Client communication
  - Other

> **Note:** These are fully configurable by admins. They can add, edit, delete, or reorder tasks within each service.

#### `client_service_types` (Join Table)
Associates clients with their service types.

| Column | Type | Description |
|--------|------|-------------|
| id | integer | Primary key |
| client_id | integer | FK to clients |
| service_type_id | integer | FK to service_types |
| created_at | timestamp | |

### Modified Tables

#### `clients` (Existing)
Add new columns:

| Column | Type | Description |
|--------|------|-------------|
| client_type | string | 'individual' or 'business' (for quick filtering) |
| business_name | string | Already exists, ensure it's used |
| is_service_only | boolean | True if created without intake (no tax return) |

#### `time_entries` (Existing)
Add new columns:

| Column | Type | Description |
|--------|------|-------------|
| service_type_id | integer | FK to service_types (optional) |
| service_task_id | integer | FK to service_tasks (optional) |

---

## 5. UI/UX Changes

### Phase 1: Client Services

#### Admin Settings Page
- New section: "Service Types"
  - List all service types
  - Add/Edit/Delete service types
  - Reorder via drag or arrows

#### Client List Page
- Add filter by service type
- Show service type badges on client cards/rows

#### Quick Add Client Modal
- New simplified form for service clients:
  - Client Type: Individual / Business
  - First Name, Last Name
  - Business Name (if business)
  - Email, Phone
  - Service Types (multi-select checkboxes)
  - Notes
- Does NOT create a tax return
- Accessible from Clients page header

#### Existing Client Detail
- Add "Services" section showing assigned service types
- Ability to add/remove service types

#### Time Entry Form
- Add optional "Service" dropdown (after client selection)
- Filtered to client's assigned services, or show all if no client selected

### Phase 2: Task-Level Tracking

#### Admin Settings Page
- Within each Service Type, manage tasks:
  - List tasks for selected service
  - Add/Edit/Delete tasks
  - Reorder tasks

#### Time Entry Form
- Add optional "Task" dropdown (after service selection)
- Filtered to selected service's tasks
- Quick-add if common task not listed

#### Reports Enhancement
- Group by service type
- Group by task
- Filter by service/task

---

## 6. Implementation Plan

### Phase 1A: Database & Backend ✅ COMPLETE
- [x] Create migrations for new tables
- [x] Create models with associations
- [x] Add seed data for default service types
- [x] Create API endpoints:
  - `GET/POST/PATCH/DELETE /api/v1/admin/service_types`
  - `GET /api/v1/service_types` (for dropdowns)
  - `PATCH /api/v1/clients/:id` (add service associations)
- [x] Update time_entries controller to accept service_type_id

### Phase 1B: Admin Settings UI ✅ COMPLETE
- [x] Add "Service Types" section to Settings page
- [x] CRUD interface for service types
- [x] Reordering support

### Phase 1C: Client Management UI ✅ COMPLETE
- [x] Quick Add Client modal with service types
- [x] Client list filtering by service type
- [x] Client detail: show/edit services

### Phase 1D: Time Tracking UI ✅ COMPLETE
- [x] Add service dropdown to time entry form
- [x] Update time entry display to show service
- [x] Reports show hours by service

### Phase 2A: Task Management ✅ COMPLETE (included in Phase 1)
- [x] Create service_tasks migration
- [x] API endpoints for tasks
- [x] Settings UI for managing tasks per service

### Phase 2B: Task Time Tracking (Future)
- [ ] Add task dropdown to time entry form
- [ ] Filter tasks by selected service
- [ ] Update displays/reports

---

## 7. Open Questions

### Answered
1. **Should payroll clients have workflow tracking?**
   - Not initially, but design for future addition

2. **Multiple clients per time entry?**
   - No - keep one client per entry for clean reporting

3. **Are service types configurable?**
   - Yes, fully configurable by admins (add, edit, delete, reorder)

4. **Are tasks configurable?**
   - Yes, fully configurable by admins within each service type

5. **Default service types - are these good?**
   - Using the 6 services from the Cornerstone website (see seed data above)

### Decided: Mandatory Fields for Time Entries

| Field | Required? | Notes |
|-------|-----------|-------|
| Date | ✅ Yes | Already required |
| Start Time | ✅ Yes | Already required |
| End Time | ✅ Yes | Already required |
| Client | ❌ No | Optional - employee might do internal/admin work |
| Service Type | ⚠️ Conditional | **Required IF client is selected** - need to know what service you did for them |
| Task | ❌ No | Optional for now - can make required later once team is used to the system |
| Description | ❌ No | Optional free text for additional context |
| Break | ❌ No | Optional |

> **Rationale:** If you're logging time for a client, we need to know what service it was for (reporting, billing). But if you're doing internal work (team meeting, training, admin), no client/service needed.

### Confirmed
1. **Should we migrate existing time entries to have a service type?**
   - ✅ No - leave historical entries as-is (null service_type_id)
   - UI will gracefully handle null by showing "—" or "No service"
   - Only 1 entry exists on production, not worth migrating

2. **Client visibility - should service-only clients appear in the main Clients list?**
   - ✅ Yes - with a visual indicator (badge/icon) and filter option

3. **Add a catch-all service type?**
   - ✅ Yes - add "General/Administrative" as a 7th service type
   - Useful for internal work, meetings, training, misc tasks

---

## 8. Success Metrics

- Employees can track time against payroll/service clients
- Admins can see breakdown of time by service type
- Quick client creation takes < 30 seconds
- No disruption to existing tax return workflow

---

## 9. Change Log

| Date | Author | Changes |
|------|--------|---------|
| Jan 2026 | AI Assistant | Initial draft |
| Jan 2026 | AI Assistant | Added configurability section, updated seed data from website, confirmed all open questions |
| Jan 31, 2026 | AI Assistant | Phase 1 Implementation Complete - Backend, Admin Settings, Client Management, Time Tracking all done |

