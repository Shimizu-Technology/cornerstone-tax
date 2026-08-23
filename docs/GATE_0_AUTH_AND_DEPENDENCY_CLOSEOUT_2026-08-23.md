# Gate 0: Authentication and Frontend Dependency Closeout

**Date:** August 23, 2026  
**Scope:** Cornerstone Tax portions of Payroll Gate 0 items G0-16 and G0-22  
**Status:** Implemented and locally verified; deployment verification remains required after merge

## Why this work is part of Gate 0

Cornerstone Tax contains public marketing and intake routes alongside staff administration and the client portal. Before this change, omitting `VITE_CLERK_PUBLISHABLE_KEY` disabled Clerk and allowed every protected frontend route to render. That behavior was useful locally but unsafe in a production build because a configuration mistake became an authentication bypass.

The frontend lockfile also resolved 30 known vulnerabilities: 1 low, 12 moderate, 14 high, and 3 critical. The affected dependency graph included Clerk, React Router, Vite, Vitest, Rollup, and PostHog packages. A sellable and trustworthy product cannot treat either production authentication configuration or known critical dependencies as optional cleanup.

## Implemented boundary

- Public marketing and intake routes remain available without Clerk.
- `/admin` and `/portal` fail closed in production when the Clerk key is empty or left as a placeholder.
- The no-auth bypass remains available only in Vite development mode.
- Authentication configuration rules are centralized and covered by unit tests.
- The frontend dependency lockfile resolves to audited compatible versions with zero known vulnerabilities.
- React 19 lint findings exposed by the updated toolchain were corrected without changing product permissions or business workflows.
- Public browser tests now follow the current `/intake` service selection and `/intake/personal` form flow rather than assuming the form is the first screen.
- Contact fields marked as required now enforce native browser validation, submitted values are trimmed, and browser tests intercept the contact API instead of sending real test messages.

## Verification evidence

The local closeout gate requires all of the following:

```bash
cd frontend
npm ci
npm run lint
npm test
npm run build
npm audit --audit-level=low

# Against the production build preview, without a Clerk key:
PLAYWRIGHT_BASE_URL=http://127.0.0.1:4191 \
  npx playwright test \
  --project=public --project=public-mobile
```

Local result on August 23, 2026:

- ESLint: clean
- Vitest: 28 passed
- TypeScript and Vite production build: passed
- npm audit at low threshold: 0 vulnerabilities
- Playwright public coverage: 72 passed across desktop and mobile, including contact, intake, kiosk, navigation, and responsive cases
- Manual production-build verification: `/` remained public; `/admin` and `/portal` displayed only the fail-closed configuration screen

## Deployment closeout

Merge approval and clean local evidence close the code portion only. The item becomes operationally closed after the `main` deployment succeeds and an operator verifies:

1. the production environment has the intended `VITE_CLERK_PUBLISHABLE_KEY`;
2. staff can authenticate into `/admin` and role restrictions still apply;
3. a client can authenticate into `/portal` and sees only assigned data;
4. signed-out users cannot access either protected surface;
5. public marketing and intake routes remain available.

Record the deployed commit, deployment URL, timestamp, and verifier in the release evidence. Do not substitute a PR score or successful build for this runtime check.

## Non-goals

This closeout does not merge Cornerstone Tax into Payroll, change product boundaries, add multitenancy, or replace Clerk. Payroll remains the payroll calculation and ledger authority; Cornerstone Tax remains the tax-practice workflow product and a time-summary source under the versioned Payroll contract.
