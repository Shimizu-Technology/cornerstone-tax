# Operations Checklists Admin Guide

This guide explains how admins and staff use the recurring client operations checklist system in production.

Related docs:

- PRD: `docs/PRD-recurring-client-operations-checklists.md`
- Build plan: `docs/BUILD_PLAN-recurring-client-operations-checklists.md`

---

## Admin Workflow

### 1) Configure global templates

Path: `Admin > Settings > Operations Templates`

For each template:

- Set `Template Name`, `Category`, and `Recurrence`
- Use `Custom` recurrence with `Recurrence Interval` only when non-standard periods are required
- Decide if `Auto-generate cycles at period start` should be on/off
- Add tasks with:
  - `Title` and optional description
  - position/order
  - `Require evidence note on completion` for tasks that need proof
  - optional prerequisites for dependency controls

Notes:

- Templates are global and reusable across clients.
- Deactivating a template keeps historical data but prevents new assignment use.

### 2) Assign templates to clients

Path: `Admin > Clients > [Client] > Operations Checklist > Template Assignments`

- Select an unassigned template
- Keep `Auto-generate` checked for recurring automation
- Click `Assign Template`

Assignment status:

- `active`: participates in cycle generation
- `paused`: retained but excluded from generation

### 3) Generate cycles manually (admin)

Path: `Admin > Clients > [Client] > Operations Checklist > Generate Cycle`

- Choose template
- Set `period_start` and `period_end`
- Click `Generate`

Expected behavior:

- Creates one cycle for that client/template/period
- Creates ordered tasks from active template tasks
- Blocks duplicate periods

### 4) Execute work as staff

Two common views:

- Client-centric: `Admin > Clients > [Client] > Operations Checklist`
- Team-centric: `Admin > Operations`

Staff actions:

- move status (`not_started`, `in_progress`, `blocked`, `done`)
- set assignee, notes, evidence note
- complete/reopen tasks
- use `Log Time` link to create linked time entries

Enforced rules:

- evidence-required tasks cannot complete without evidence note
- tasks with unmet prerequisites cannot move to in-progress/done

### 5) Review activity and audit

Path: `Admin > Activity`

- Set source to `Audit Logs`
- Filter by `Audit Type`:
  - Operations Template
  - Operations Template Task
  - Operations Assignment
  - Operations Cycle
  - Operations Task

Use this for historical accountability (who changed what, and when).

---

## Troubleshooting

### Cycle did not auto-generate

Check all of the following:

1. Template `auto_generate` is enabled
2. Assignment `auto_generate` is enabled
3. Assignment status is `active`
4. Assignment `starts_on`/`ends_on` include the run date
5. Template is active and recurrence config is valid

If still missing:

- run generation manually for same client/period to isolate config vs scheduler issue
- inspect recent audit logs for assignment/template changes

### Manual generation returns duplicate-period error

Reason:

- a cycle already exists for the same client/template/period range

What to do:

- use cycle history and continue execution on existing cycle
- do not create overlapping duplicate periods for same template

### Generate button is disabled on client page

Confirm:

- template is selected
- both start and end dates are set
- end date is on/after start date
- user is admin (manual generation is admin-only)

### Task cannot be marked done

Possible blockers:

- missing evidence note on evidence-required task
- unmet prerequisites (dependent tasks not done)

Fix:

- add evidence note then complete
- complete prerequisite tasks first

### Operations board feels slow with large datasets

Use the built-in controls:

- apply quick filters (`Overdue`, `Due Today`, `Blocked`, `My Tasks Today`)
- narrow by assignee/status
- keep `Include Done` off unless needed

Backend now supports paginated task/cycle responses, so frontend can be extended with next/prev controls if future load grows.

### Linked time entry is missing on task

Checklist:

- confirm time entry was created from task `Log Time` link or with `operation_task_id`
- ensure time entry and task belong to same client
- if entry was deleted, link is intentionally cleared

---

## Operational Best Practices

- Keep templates generic and reusable; avoid client-specific naming in template titles.
- Use evidence-required only for compliance-critical steps to reduce friction.
- Prefer prerequisites for true dependency gates, not simple sequencing preference.
- Review Operations board daily and Activity weekly for audit health.

