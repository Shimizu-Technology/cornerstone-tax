# Build Plan: Recurring Client Operations Checklists

**Related PRD:** `docs/PRD-recurring-client-operations-checklists.md`  
**Status:** Ready to Execute  
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
- [ ] Add migrations for:
  - [ ] `operation_templates`
  - [ ] `operation_template_tasks`
  - [ ] `client_operation_assignments`
  - [ ] `operation_cycles`
  - [ ] `operation_tasks`
- [ ] Add indexes and uniqueness constraints
- [ ] Add foreign keys and cascade behaviors
- [ ] Update schema and verify migration rollback safety

**Acceptance**
- [ ] Migrations run clean on local DB
- [ ] Duplicate cycle prevention constraint works
- [ ] Basic seed records can be inserted without errors

### Story A2: Add Rails models and validations
- [ ] Create model associations
- [ ] Add validations for recurrence settings
- [ ] Add validation for evidence-required completion rule
- [ ] Add scopes for due/overdue/blocked/my-tasks queries

**Acceptance**
- [ ] Model specs pass for core validations and associations
- [ ] Evidence-required task cannot transition to done without evidence

### Story A3: Seed default templates and tasks
- [ ] Seed biweekly payroll starter template
- [ ] Seed monthly close starter template
- [ ] Seed quarterly compliance starter template
- [ ] Mark all seed data as admin-editable

**Acceptance**
- [ ] New environment has starter templates available
- [ ] Admin can edit/deactivate seeded templates

---

## EPIC B: Template and Assignment APIs (MVP)

### Story B1: Template CRUD APIs
- [ ] `GET /api/v1/operation_templates`
- [ ] `POST /api/v1/operation_templates`
- [ ] `PATCH /api/v1/operation_templates/:id`
- [ ] soft deactivate endpoint

**Acceptance**
- [ ] Admin can create/edit/deactivate templates via API
- [ ] Non-admins are correctly blocked

### Story B2: Template Task CRUD APIs
- [ ] `GET /api/v1/operation_templates/:id/tasks`
- [ ] `POST /api/v1/operation_templates/:id/tasks`
- [ ] `PATCH /api/v1/operation_template_tasks/:id`
- [ ] soft deactivate + reorder support

**Acceptance**
- [ ] Task ordering persists correctly
- [ ] Evidence-required flag is stored and returned

### Story B3: Client assignment APIs
- [ ] `GET /api/v1/clients/:client_id/operation_assignments`
- [ ] `POST /api/v1/clients/:client_id/operation_assignments`
- [ ] `PATCH /api/v1/client_operation_assignments/:id`
- [ ] active/paused behavior

**Acceptance**
- [ ] Admin can attach/detach/pause templates per client
- [ ] Assignment overrides persist and return correctly

---

## EPIC C: Cycle Generation and Task Execution APIs (MVP)

### Story C1: Manual cycle generation
- [ ] `POST /api/v1/clients/:client_id/operation_cycles/generate`
- [ ] Build service object to generate cycle + tasks
- [ ] Prevent duplicate cycle periods

**Acceptance**
- [ ] Manual generation creates cycle with ordered tasks
- [ ] Duplicate generation for same period is blocked

### Story C2: Task state transition APIs
- [ ] `PATCH /api/v1/operation_tasks/:id`
- [ ] `POST /api/v1/operation_tasks/:id/complete`
- [ ] `POST /api/v1/operation_tasks/:id/reopen`
- [ ] Assignee + due date + notes support

**Acceptance**
- [ ] Completed fields (`completed_at`, `completed_by`) are set correctly
- [ ] Reopen clears completion metadata as designed

### Story C3: Audit and activity event emission
- [ ] Emit audit events for all major task/cycle actions
- [ ] Add operations event types to activity filtering if needed

**Acceptance**
- [ ] Status changes appear in Activity log with actor and timestamp
- [ ] Assignment/note/evidence changes are traceable

---

## EPIC D: Admin UI - Operations Template Management (MVP)

### Story D1: Add Settings section for Operations Templates
- [ ] Add navigation tab in Settings
- [ ] Template list view + create/edit panel
- [ ] recurrence + auto/manual generation controls

**Acceptance**
- [ ] Admin can manage templates without API tools
- [ ] Controls are mobile-usable and responsive

### Story D2: Template task builder UI
- [ ] Add/edit/deactivate template tasks
- [ ] Reorder tasks
- [ ] Evidence-required toggle per task

**Acceptance**
- [ ] Reordering reflects in generated task order
- [ ] Evidence-required toggle persists and surfaces correctly

---

## EPIC E: Client Operations UI (MVP)

### Story E1: Add Operations section on Client Detail
- [ ] Show active cycle summary
- [ ] Show task list with status/assignee/due
- [ ] Show cycle history
- [ ] Manual generate action for admins

**Acceptance**
- [ ] Staff can run checklist from client page end-to-end
- [ ] Admin can manually generate new cycles

### Story E2: Task interaction UI
- [ ] Quick status updates
- [ ] assignee updates
- [ ] notes and evidence entry
- [ ] completion guard for evidence-required tasks

**Acceptance**
- [ ] Evidence-required tasks block completion without evidence
- [ ] UI feedback is clear and immediate

### Story E3: Time tracking shortcut from task
- [ ] Add "Log Time" action that deep-links to time entry context
- [ ] Prefill client/service description context where possible

**Acceptance**
- [ ] User can navigate from task to time tracking in one click

---

## EPIC F: Automation and Team Views (Phase 2)

### Story F1: Scheduled auto-generation
- [ ] Create scheduler job for auto generation at period start
- [ ] Respect assignment/template auto-generate toggles
- [ ] Add idempotency safeguards

**Acceptance**
- [ ] Auto cycles generate once per period
- [ ] Manual-only templates do not auto-generate

### Story F2: Operations board/list page
- [ ] Team view with filters
- [ ] Group by client/status/assignee options
- [ ] saved quick filters (overdue, blocked, due today)

**Acceptance**
- [ ] Team can identify overdue and blocked operational work quickly

### Story F3: My Tasks view
- [ ] Per-user assigned task list
- [ ] sorted by urgency
- [ ] due/overdue indicators

**Acceptance**
- [ ] Employee can manage personal operational workload from one place

---

## EPIC G: Deep Integrations and Enhancements (Phase 3)

### Story G1: Task-time entry linkage
- [ ] Store linked `time_entry_id` on task (optional)
- [ ] Show linked time entry summary in task detail

### Story G2: Schedule-aware context
- [ ] Add schedule quick-link and optional suggested shift context

### Story G3: Dependency controls (future)
- [ ] Optional dependency model
- [ ] blocked transitions when prerequisites not done

---

## 4) Cross-Cutting Engineering Tasks

### Backend Quality
- [ ] Request specs for all new endpoints
- [ ] Service specs for cycle generation logic
- [ ] Validation tests for recurrence and evidence rules
- [ ] Authorization checks for admin/staff boundaries

### Frontend Quality
- [ ] Unit tests for key checklist UI components
- [ ] E2E flows:
  - [ ] template create
  - [ ] assignment create
  - [ ] manual cycle generate
  - [ ] task completion with/without evidence
  - [ ] activity log verification

### Performance and Reliability
- [ ] Query optimization and index review for task board filters
- [ ] Pagination for large task/cycle result sets
- [ ] Protect against duplicate generation race conditions

### Documentation
- [ ] Update `README`/admin docs with operations checklist workflows
- [ ] Add troubleshooting section for recurrence and cycle generation

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
- [ ] Add explicit recurrence generator test matrix (month-end, leap year, timezone)

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

