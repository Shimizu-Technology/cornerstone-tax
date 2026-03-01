# Build Plan: Recurring Client Operations Checklists

**Related PRD:** `docs/PRD-recurring-client-operations-checklists.md`  
**Status:** In Progress - Epic A Started  
**Last Updated:** February 2026

---

## 1) Execution Overview

This build plan converts the PRD into implementation-ready work items with:

- Epics
- Stories
- Technical tasks
- Dependencies
- Acceptance checks

Recommended delivery model:

- **Phase 1 (MVP):** Foundation + client execution + audit integration
- **Phase 2:** Auto-generation + team operational views
- **Phase 3:** Deeper integrations and advanced workflow controls

---

## 2) Milestones

| Milestone | Scope | Target Outcome |
|---|---|---|
| M1 | Data + APIs + Admin template management | Templates and assignments are fully manageable |
| M2 | Cycle/task execution + client operations UI | Staff can run recurring checklists end-to-end |
| M3 | Automation + team views | Operational control board for day-to-day management |
| M4 | Deep integration + hardening | Tight integration with time/schedule and production readiness |

---

## 3) Epic Breakdown

## EPIC A: Data Model and Backend Foundation (MVP)

### Story A1: Create core schema
- [x] Add migrations for:
  - [x] `operation_templates`
  - [x] `operation_template_tasks`
  - [x] `client_operation_assignments`
  - [x] `operation_cycles`
  - [x] `operation_tasks`
- [x] Add indexes and uniqueness constraints
- [x] Add foreign keys and cascade behaviors
- [x] Update schema and verify migration rollback safety

**Acceptance**
- [x] Migrations run clean on local DB
- [x] Duplicate cycle prevention constraint works
- [x] Basic seed records can be inserted without errors

### Story A2: Add Rails models and validations
- [x] Create model associations
- [x] Add validations for recurrence settings
- [x] Add validation for evidence-required completion rule
- [x] Add scopes for due/overdue/blocked/my-tasks queries

**Acceptance**
- [x] Model specs pass for core validations and associations
- [x] Evidence-required task cannot transition to done without evidence

### Story A3: Seed default templates and tasks
- [x] Seed biweekly payroll starter template
- [x] Seed monthly close starter template
- [x] Seed quarterly compliance starter template
- [x] Mark all seed data as admin-editable

**Acceptance**
- [x] New environment has starter templates available
- [x] Admin can edit/deactivate seeded templates

---

## EPIC B: Template and Assignment APIs (MVP)

### Story B1: Template CRUD APIs
- [x] `GET /api/v1/operation_templates`
- [x] `POST /api/v1/operation_templates`
- [x] `PATCH /api/v1/operation_templates/:id`
- [x] soft deactivate endpoint

**Acceptance**
- [x] Admin can create/edit/deactivate templates via API
- [x] Non-admins are correctly blocked

### Story B2: Template Task CRUD APIs
- [x] `GET /api/v1/operation_templates/:id/tasks`
- [x] `POST /api/v1/operation_templates/:id/tasks`
- [x] `PATCH /api/v1/operation_template_tasks/:id`
- [x] soft deactivate + reorder support

**Acceptance**
- [x] Task ordering persists correctly
- [x] Evidence-required flag is stored and returned

### Story B3: Client assignment APIs
- [x] `GET /api/v1/clients/:client_id/operation_assignments`
- [x] `POST /api/v1/clients/:client_id/operation_assignments`
- [x] `PATCH /api/v1/client_operation_assignments/:id`
- [x] active/paused behavior

**Acceptance**
- [x] Admin can attach/detach/pause templates per client
- [x] Assignment overrides persist and return correctly

---

## EPIC C: Cycle Generation and Task Execution APIs (MVP)

### Story C1: Manual cycle generation
- [x] `POST /api/v1/clients/:client_id/operation_cycles/generate`
- [x] Build service object to generate cycle + tasks
- [x] Prevent duplicate cycle periods

**Acceptance**
- [x] Manual generation creates cycle with ordered tasks
- [x] Duplicate generation for same period is blocked

### Story C2: Task state transition APIs
- [x] `PATCH /api/v1/operation_tasks/:id`
- [x] `POST /api/v1/operation_tasks/:id/complete`
- [x] `POST /api/v1/operation_tasks/:id/reopen`
- [x] Assignee + due date + notes support

**Acceptance**
- [x] Completed fields (`completed_at`, `completed_by`) are set correctly
- [x] Reopen clears completion metadata as designed

### Story C3: Audit and activity event emission
- [x] Emit audit events for all major task/cycle actions
- [x] Add operations event types to activity filtering if needed

**Acceptance**
- [x] Status changes appear in Activity log with actor and timestamp
- [x] Assignment/note/evidence changes are traceable

---

## EPIC D: Admin UI - Operations Template Management (MVP)

### Story D1: Add Settings section for Operations Templates
- [x] Add navigation tab in Settings
- [x] Template list view + create/edit panel
- [x] recurrence + auto/manual generation controls

**Acceptance**
- [x] Admin can manage templates without API tools
- [x] Controls are mobile-usable and responsive

### Story D2: Template task builder UI
- [x] Add/edit/deactivate template tasks
- [x] Reorder tasks
- [x] Evidence-required toggle per task

**Acceptance**
- [x] Reordering reflects in generated task order
- [x] Evidence-required toggle persists and surfaces correctly

---

## EPIC E: Client Operations UI (MVP)

### Story E1: Add Operations section on Client Detail
- [x] Show active cycle summary
- [x] Show task list with status/assignee/due
- [x] Show cycle history
- [x] Manual generate action for admins

**Acceptance**
- [x] Staff can run checklist from client page end-to-end
- [x] Admin can manually generate new cycles

### Story E2: Task interaction UI
- [x] Quick status updates
- [x] assignee updates
- [x] notes and evidence entry
- [x] completion guard for evidence-required tasks

**Acceptance**
- [x] Evidence-required tasks block completion without evidence
- [x] UI feedback is clear and immediate

### Story E3: Time tracking shortcut from task
- [x] Add "Log Time" action that deep-links to time entry context
- [x] Prefill client/service description context where possible

**Acceptance**
- [x] User can navigate from task to time tracking in one click

---

## EPIC F: Automation and Team Views (Phase 2)

### Story F1: Scheduled auto-generation
- [x] Create scheduler job for auto generation at period start
- [x] Respect assignment/template auto-generate toggles
- [x] Add idempotency safeguards

**Acceptance**
- [x] Auto cycles generate once per period
- [x] Manual-only templates do not auto-generate

### Story F2: Operations board/list page
- [x] Team view with filters
- [x] Group by client/status/assignee options
- [x] saved quick filters (overdue, blocked, due today)

**Acceptance**
- [x] Team can identify overdue and blocked operational work quickly

### Story F3: My Tasks view
- [x] Per-user assigned task list
- [x] sorted by urgency
- [x] due/overdue indicators

**Acceptance**
- [x] Employee can manage personal operational workload from one place

---

## EPIC G: Deep Integrations and Enhancements (Phase 3)

### Story G1: Task-time entry linkage
- [x] Store linked `time_entry_id` on task (optional)
- [x] Show linked time entry summary in task detail

### Story G2: Schedule-aware context
- [x] Add schedule quick-link and optional suggested shift context

### Story G3: Dependency controls (future)
- [x] Optional dependency model
- [x] blocked transitions when prerequisites not done

---

## 4) Cross-Cutting Engineering Tasks

### Backend Quality
- [x] Request specs for all new endpoints
- [x] Service specs for cycle generation logic
- [x] Validation tests for recurrence and evidence rules
- [x] Authorization checks for admin/staff boundaries

### Frontend Quality
- [x] Unit tests for key checklist UI components
- [x] E2E flows:
  - [x] template create
  - [x] assignment create
  - [x] manual cycle generate
  - [x] task completion with/without evidence
  - [x] activity log verification

### Performance and Reliability
- [x] Query optimization and index review for task board filters
- [x] Pagination for large task/cycle result sets
- [x] Protect against duplicate generation race conditions

### Documentation
- [x] Update `README`/admin docs with operations checklist workflows
- [x] Add troubleshooting section for recurrence and cycle generation

---

## 5) Suggested Delivery Sequence

1. EPIC A
2. EPIC B
3. EPIC C
4. EPIC D
5. EPIC E
6. MVP validation checkpoint
7. EPIC F
8. EPIC G

---

## 6) MVP Go/No-Go Checklist

- [ ] Data model stable and migrated in all environments
- [ ] Admin can configure global templates and tasks
- [ ] Client assignment works
- [ ] Manual cycle generation works
- [ ] Staff can execute checklist tasks end-to-end
- [ ] Evidence-required validation enforced
- [ ] Activity/audit logging verified
- [ ] Time tracking link from task works
- [ ] Responsive UX verified on desktop + mobile

---

## 7) Risks and Mitigation Tasks

### Risk: Recurrence edge cases
- [x] Add explicit recurrence generator test matrix (month-end, leap year, timezone)

### Risk: Adoption friction
- [ ] Provide default templates and short onboarding copy

### Risk: Data drift between modules
- [ ] Enforce consistent client/user IDs and event logging contracts

---

## 8) Ticket Naming Convention (Recommended)

- `CST-OPS-EPIC-A`: Data foundation
- `CST-OPS-###`: Story/task IDs per work item

Example:
- `CST-OPS-101` Create operation_templates migration
- `CST-OPS-118` Add manual cycle generation endpoint
- `CST-OPS-143` Build client operations task list UI

---

## 9) Definition of Done (Per Ticket)

- [ ] Functional requirement implemented
- [ ] Tests added/updated and passing
- [ ] Audit logging covered if applicable
- [ ] Mobile and desktop behavior validated
- [ ] No major lint/type issues introduced
- [ ] PR notes include user impact and verification steps

