# Employee termination and legacy recovery

## Normal offboarding

Use **Users → Team → Terminate**. Termination blocks sign-in and removes the person from operational assignment, scheduling, clock, and “who is working” lists. The profile, time entries, schedules, approvals, audit history, and payroll reporting remain intact. A terminated profile can be reactivated by an administrator.

Do not delete a user row or clear foreign keys. `User` blocks hard deletion so historical records cannot be orphaned again.

The effective termination date is optional because some legacy records do not contain authoritative offboarding dates. Leave it blank rather than estimating it. The action timestamp and administrator are always recorded.

## Recovering a legacy hard-deleted employee

The recovery task is deliberately explicit and dry-run first. It requires the authoritative Clerk ID and email, an exact list of preserved time-entry and schedule IDs, and the expected hour total. It refuses active or conflicting users, missing IDs, duplicate IDs, different owners, or a total-hours mismatch.

```bash
bin/rails employment:recover_legacy_deleted_employee \
  EMAIL='employee@example.com' \
  CLERK_ID='user_...' \
  FIRST_NAME='First' \
  LAST_NAME='Last' \
  TIME_ENTRY_IDS='1,2,3' \
  SCHEDULE_IDS='4,5' \
  EXPECTED_HOURS='24.0'
```

Review the dry-run output, take a database backup, then run the same command with `APPLY=true`. Supply `TERMINATION_EFFECTIVE_ON=YYYY-MM-DD` only when an authoritative date exists. `TERMINATION_REASON` is optional.

After applying, verify:

- the profile appears under terminated team members;
- the account cannot authenticate;
- the time entries and schedules have the recovered `user_id`;
- the expected hours appear in the historical hours report and payroll time-summary output;
- operational selectors do not offer the terminated employee.
