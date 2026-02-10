# PRD: Recurring Client Operations Checklists

**Status:** Proposed - Ready for Technical Review  
**Created:** February 2026  
**Last Updated:** February 2026  
**Owner:** Cornerstone Product + Engineering

---

## 1. Problem Statement

Cornerstone runs recurring operational work for clients (especially payroll clients) that must be completed on strict cycles (biweekly, monthly, quarterly, and ad hoc). Today, this work is coordinated manually across people, messages, and memory, which creates risk:

- Unclear ownership of in-progress items
- Weak visibility into what is done vs pending vs blocked
- Handoffs are hard across staff members
- Limited traceability of who completed operational steps and when
- Repeated work patterns are not standardized

Cornerstone needs a dynamic, configurable, and integrated checklist system that tracks recurring operational work per client, while connecting with existing scheduling, time tracking, and audit logging.

---

## 2. Product Vision

Build a **Recurring Client Operations Checklist System** that acts as a shared operational control layer for the firm:

- Define reusable checklist templates globally
- Assign templates to clients
- Auto-generate checklist cycles (or allow manual creation)
- Track status, ownership, evidence, notes, and timestamps per task
- Expose clear client-level and user-level operational views
- Integrate with existing schedule/time/audit tools

This system must work for payroll flows first, but remain flexible for any recurring accounting operations.

---

## 3. Goals and Non-Goals

### 3.1 Goals

1. Track recurring operational tasks for each client across different cadences
2. Standardize repeatable workflows via admin-configurable global templates
3. Make status and ownership visible to all relevant staff in real time
4. Preserve audit-quality history for every operational update
5. Integrate naturally with existing modules (Schedule, Time Tracking, Activity)
6. Keep UX simple for day-to-day use by non-technical users

### 3.2 Non-Goals (V1)

- Dependency graph enforcement between tasks
- Automation workflows beyond recurrence creation
- Client-facing checklist portal
- Advanced SLA engines and escalation policy builders
- Required file upload storage for evidence (text evidence support can come first)

---

## 4. Key Design Principles

1. **Configurable over hardcoded**: templates, statuses, recurrence, evidence requirement, and defaults are admin-configurable.
2. **Operationally simple**: minimal clicks to update task state and ownership.
3. **Auditable by default**: every meaningful change logs actor + timestamp.
4. **Integrated system, not siloed feature**: checklist actions should connect with existing scheduling and time tracking context.
5. **Mobile-first and desktop-ready**: field usage should be practical during office and on-the-go work.

---

## 5. User Roles and Permissions

### Admin

- Manage global checklist templates and defaults
- Configure statuses and recurrence behavior
- Assign templates to clients
- Manually generate checklist cycles
- Edit any checklist/task instance
- View all operational dashboards and reports

### Employee

- View checklist cycles for assigned/visible clients
- Update task status, notes, and completion details
- Self-assign or claim tasks (if permitted by admin settings)
- Add evidence notes when required
- View personal workload view ("My Tasks")

### Client (future)

- No V1 direct access

---

## 6. Core Concepts

- **Template**: reusable global definition of recurring tasks.
- **Template Task**: a single step in a template (with defaults).
- **Client Assignment**: linkage of a template to a specific client.
- **Cycle (Checklist Instance)**: generated copy for a period (e.g., biweekly payroll cycle).
- **Task Instance**: generated actionable task within a cycle.
- **Evidence Requirement**: per task setting requiring note/evidence before completion.

---

## 7. Primary Use Cases

1. Biweekly payroll operations
2. Monthly bookkeeping close steps
3. Quarterly compliance actions
4. Ad hoc operations checklist for special client events

---

## 8. User Stories

### Template Management (Admin)

- As an admin, I can create a global checklist template once and reuse it across clients.
- As an admin, I can define recurrence cadence and generation behavior for each template.
- As an admin, I can mark certain tasks as requiring evidence before completion.
- As an admin, I can enable/disable template auto-generation and switch to manual generation.

### Client Operations Execution (Admin/Employee)

- As a staff member, I can see all current checklist tasks for a client and their statuses.
- As a staff member, I can mark a task in progress/done/blocked with notes and timestamps.
- As a staff member, I can see who completed each task and when.
- As a staff member, I can quickly identify overdue or blocked items.

### Integrated Workflows

- As a staff member, I can navigate from a task to time tracking to log work.
- As a staff member, I can open schedule context from a task when planning work.
- As an admin, I can see checklist updates in the global Activity stream.

---

## 9. Functional Requirements

### 9.1 Global Template Management

1. Admin can create/edit/archive templates
2. Template fields:
   - Name
   - Description
   - Category (payroll/bookkeeping/compliance/general/custom)
   - Default recurrence settings
   - Auto-generate enabled (boolean)
   - Active/inactive
3. Admin can add, edit, reorder, and archive template tasks
4. Template task fields:
   - Task name
   - Description
   - Default assignee role/user (optional)
   - Due offset rule (optional, relative to cycle start/end)
   - Evidence required (boolean, default false)
   - Active/inactive

### 9.2 Recurrence and Generation

1. Supported recurrence types:
   - Weekly
   - Biweekly
   - Monthly
   - Quarterly
   - Custom interval
2. Generation mode:
   - Auto at period start (default)
   - Manual only
3. Admin can manually generate a cycle for a client/template
4. Duplicate cycle protection for same period + client + template

### 9.3 Client Assignment

1. Admin can assign one or more templates to a client
2. Assignment can override defaults:
   - Assignees
   - Due offsets
   - Evidence requirement
   - Auto/manual generation mode
3. Admin can pause/resume assignment without deleting history

### 9.4 Cycle and Task Execution

1. System creates cycle instances with generated task instances
2. Task status options (admin-configurable; default set below):
   - Not Started
   - In Progress
   - Blocked
   - Done
3. Each task instance supports:
   - Assignee
   - Due date/time
   - Notes
   - Evidence note (required if configured)
   - Completed at/by
4. Task completion validation:
   - If evidence required, cannot mark Done without evidence
5. Reopen task capability (with audit entry)

### 9.5 Views and Navigation

1. **Client Detail > Operations tab**
   - Current cycle summary
   - Task list with statuses and assignees
   - Past cycles history
2. **Operations Board/List page**
   - Filters: client, template, assignee, status, due date window
   - Grouping by client/cycle/status
3. **My Tasks**
   - Assigned tasks across clients, sorted by due urgency
4. **Overdue/Blocked queue**
   - Team-level operational risk view

### 9.6 Integrations

1. **Activity Log**
   - Task status/assignee/note/evidence updates logged
2. **Time Tracking**
   - Task action includes shortcut to log time with linked context
   - Future-ready linkage to store related time entry id(s)
3. **Schedule**
   - Task detail can surface schedule link (optional context action)

---

## 10. Default Operational Starter Templates (Seed Content)

### 10.1 Biweekly Payroll Processing

1. Receive hours/input from client
2. Validate hours/overtime/adjustments
3. Process payroll
4. Internal review/approval
5. Deliver checks / confirm disbursement
6. Drop FIT and related checks to Treasurer of Guam
7. Confirm filing/payment receipts recorded
8. Send payroll completion update to client

### 10.2 Monthly Bookkeeping Close

1. Collect missing docs/transactions
2. Reconcile bank and credit card accounts
3. Post adjusting entries
4. Review financial reports
5. Deliver monthly summary to client

### 10.3 Quarterly Compliance

1. Compile quarter data package
2. Validate filings and payment obligations
3. Submit filings
4. Record confirmation numbers / receipts
5. Client compliance update sent

All of these are admin-editable and not hardcoded after seed.

---

## 11. Data Model (Proposed)

### 11.1 New Tables

#### `operation_templates`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| name | string | required |
| description | text | optional |
| category | string | payroll/bookkeeping/compliance/general/custom |
| recurrence_type | string | weekly/biweekly/monthly/quarterly/custom |
| recurrence_interval | integer | for custom intervals |
| recurrence_anchor | date | start anchor |
| auto_generate | boolean | default true |
| is_active | boolean | default true |
| created_by_id | bigint | FK users |
| created_at/updated_at | timestamps | |

#### `operation_template_tasks`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| operation_template_id | bigint | FK |
| title | string | required |
| description | text | optional |
| position | integer | ordering |
| default_assignee_id | bigint | optional FK users |
| due_offset_value | integer | optional |
| due_offset_unit | string | hours/days |
| due_offset_from | string | cycle_start/cycle_end |
| evidence_required | boolean | default false |
| is_active | boolean | default true |
| created_at/updated_at | timestamps | |

#### `client_operation_assignments`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| client_id | bigint | FK clients |
| operation_template_id | bigint | FK templates |
| auto_generate | boolean | assignment override |
| assignment_status | string | active/paused |
| starts_on | date | optional |
| ends_on | date | optional |
| created_by_id | bigint | FK users |
| created_at/updated_at | timestamps | |

#### `operation_cycles`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| client_id | bigint | FK clients |
| operation_template_id | bigint | FK templates |
| client_operation_assignment_id | bigint | FK assignment |
| period_start | date | required |
| period_end | date | required |
| cycle_label | string | e.g. 2026-02 Payroll Biweekly 1 |
| generation_mode | string | auto/manual |
| status | string | active/completed/cancelled |
| generated_at | datetime | |
| generated_by_id | bigint | optional FK users |
| created_at/updated_at | timestamps | |

Unique index recommendation: `(client_id, operation_template_id, period_start, period_end)`.

#### `operation_tasks`

| Column | Type | Notes |
|---|---|---|
| id | bigint | PK |
| operation_cycle_id | bigint | FK cycle |
| operation_template_task_id | bigint | FK template task |
| client_id | bigint | denormalized for filtering |
| title | string | required |
| description | text | optional |
| position | integer | ordering |
| status | string | not_started/in_progress/blocked/done |
| assigned_to_id | bigint | FK users |
| due_at | datetime | optional |
| started_at | datetime | optional |
| completed_at | datetime | optional |
| completed_by_id | bigint | FK users |
| evidence_required | boolean | snapshot from template/override |
| evidence_note | text | optional/required by rule |
| notes | text | optional |
| linked_time_entry_id | bigint | optional FK time_entries (future-ready) |
| created_at/updated_at | timestamps | |

#### `operation_task_events` (optional but recommended)

Detailed event history for tasks if separate from global audit logs.

---

## 12. API Surface (Proposed)

### Templates (Admin)

- `GET /api/v1/operation_templates`
- `POST /api/v1/operation_templates`
- `PATCH /api/v1/operation_templates/:id`
- `DELETE /api/v1/operation_templates/:id` (soft deactivate)

- `GET /api/v1/operation_templates/:id/tasks`
- `POST /api/v1/operation_templates/:id/tasks`
- `PATCH /api/v1/operation_template_tasks/:id`
- `DELETE /api/v1/operation_template_tasks/:id` (soft deactivate)

### Assignments (Admin)

- `GET /api/v1/clients/:client_id/operation_assignments`
- `POST /api/v1/clients/:client_id/operation_assignments`
- `PATCH /api/v1/client_operation_assignments/:id`

### Cycles

- `GET /api/v1/clients/:client_id/operation_cycles`
- `POST /api/v1/clients/:client_id/operation_cycles/generate` (manual generation)
- `GET /api/v1/operation_cycles/:id`

### Tasks

- `PATCH /api/v1/operation_tasks/:id` (status, assignee, notes, evidence)
- `POST /api/v1/operation_tasks/:id/complete`
- `POST /api/v1/operation_tasks/:id/reopen`

### Team Views

- `GET /api/v1/operations/my_tasks`
- `GET /api/v1/operations/board`
- `GET /api/v1/operations/overdue`

---

## 13. UI/UX Specification

### 13.1 Admin Settings: Operations Templates

- New Settings section: **Operations Templates**
- Left panel: template list
- Right panel:
  - template metadata + recurrence + generation mode
  - task builder list with drag reorder
  - evidence required toggle per task

### 13.2 Client Detail: Operations

- New tab/section: **Operations**
- Components:
  - active cycle card(s)
  - checklist task table/list
  - quick status updates
  - cycle history timeline
  - manual generate button (admin)

### 13.3 Team Operations View

- Filters and grouped list/board for operational tasks
- Saved quick filters:
  - Overdue
  - Blocked
  - Due today
  - My tasks

### 13.4 Task Interaction

- One-click status transitions
- Assignee picker
- Evidence modal if required before completion
- "Log Time" quick action (deep link to time tracking context)

---

## 14. Integration Requirements

### 14.1 Activity/Audit

Each of these emits audit entries:

- Task created
- Status changed
- Assignee changed
- Evidence added/updated
- Task completed/reopened
- Cycle generated (auto/manual)

### 14.2 Time Tracking

- From task: "Log Time" opens time entry form prefilled with:
  - client
  - service type (if available)
  - optional description seed from task title
- Future field linkage: store resulting `time_entry_id` on task

### 14.3 Schedule

- From task: optional "View schedule" action
- Future: suggested shift alignment for due windows

---

## 15. Reporting and KPIs

V1 reporting targets:

- Completion rate by template/client/period
- On-time completion percentage
- Average time to complete cycle
- Blocked task count and aging
- Employee workload (assigned vs completed)

---

## 16. Phased Implementation Plan

### Phase 1: Foundation (MVP)

1. Data model and migrations
2. Template management (admin)
3. Client assignment
4. Manual cycle generation
5. Task status workflow + evidence validation
6. Client operations view
7. Audit events

### Phase 2: Automation + Team Views

1. Auto cycle generation scheduler
2. Team operations board + my tasks + overdue view
3. Activity filter enhancements for operations events
4. Improved due-date and reminder handling

### Phase 3: Deeper Integrations

1. Task-to-time-entry direct linkage and reporting
2. Schedule-aware operational planning
3. Optional dependencies and guarded transitions
4. Advanced reminders/escalations

---

## 17. Acceptance Criteria (MVP)

1. Admin can create a global template with at least 5 tasks.
2. Admin can assign template to a client and set generation mode.
3. Admin can manually generate a cycle for a period.
4. Employee can update task statuses and assignee.
5. Evidence-required tasks cannot be completed without evidence note.
6. Completion stores `completed_at` and `completed_by`.
7. All task updates appear in activity/audit logs.
8. User can open time tracking from task context.
9. Mobile and desktop checklist interactions are usable with standard touch targets.

---

## 18. Testing Plan

### Backend

- Model validations:
  - recurrence settings
  - duplicate cycle prevention
  - evidence-required completion rule
- API tests:
  - template/task CRUD
  - assignment create/update
  - cycle generation (manual)
  - task transitions
- Audit log assertion tests for state changes

### Frontend

- Settings template builder flows
- Client operations execution flows
- Task completion with/without evidence
- Filters and list rendering
- Mobile responsiveness smoke checks

### End-to-End

- Payroll biweekly scenario from cycle generation to completion
- Multi-user update visibility
- Task-to-time logging navigation

---

## 19. Risks and Mitigations

1. **Risk:** Over-complex first release  
   **Mitigation:** Keep dependencies/escalations out of MVP.

2. **Risk:** Recurrence edge cases (month-end, time zones)  
   **Mitigation:** Store anchor and period windows explicitly; add deterministic generator tests.

3. **Risk:** User adoption friction  
   **Mitigation:** Start with default templates and simple status transitions.

4. **Risk:** Data inconsistency across modules  
   **Mitigation:** Standardize audit events and shared client/user references.

---

## 20. Decisions and Clarifications (Confirmed)

1. Templates are **global** and reusable across clients.
2. Admins can configure statuses/rules; system ships with defaults.
3. Recurring generation is configurable:
   - default auto-create at period start,
   - optional manual-only mode.
4. Evidence requirement is configurable per task and defaults to off.
5. Task dependencies are out of V1 and considered later.
6. Deeper "done -> log time" automation is later; V1 supports linked navigation.

---

## 21. Change Log

| Date | Author | Change |
|---|---|---|
| Feb 2026 | AI Assistant | Initial full PRD draft for recurring operations checklists |

