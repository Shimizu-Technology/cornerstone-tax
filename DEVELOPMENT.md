# Development Guide — Cornerstone Tax

> **Project:** Cornerstone Tax (monorepo: backend + frontend)
> **Backend Stack:** Ruby 3.3.4 · Rails 8.1.1 · PostgreSQL · Clerk auth
> **Frontend Stack:** React · Vite · TypeScript · Tailwind · Clerk auth
> **Plane Board:** TBD (Shimizu Technology workspace)

---

## Quick Start

### Backend
```bash
cd backend
bundle install
rails db:create db:migrate db:seed
cp .env.example .env   # Add Clerk keys
rails s -p 3000
```

### Frontend
```bash
cd frontend
npm install
cp .env.example .env   # Add Clerk key + API URL
npm run dev             # → http://localhost:5173
```

---

## Gate Scripts

**This is a monorepo — each side has its own gate.**

### Backend Gate
```bash
./backend/scripts/gate.sh
```
Runs:
1. **RSpec tests** — 8 tests
2. **RuboCop lint** — style/correctness checks
3. **Brakeman security scan** — static analysis

### Frontend Gate
```bash
./frontend/scripts/gate.sh
```
Runs:
1. **Vitest** — 5 unit tests
2. **ESLint** — linting checks
3. **TypeScript check** — type errors fail the gate
4. **Vite build** — production build must succeed

❌ Both gates must pass before creating a PR. No exceptions.

### Pre-Existing Issues (Known Debt)

These exist in the codebase and are **not** blockers for new PRs:
- **119 RuboCop offenses** (backend) — being cleaned up incrementally
- **30 ESLint errors** (frontend) — being cleaned up incrementally

The gate scripts account for these. New code must not introduce *additional* issues.

---

## Development Commands

### Backend

| Task | Command |
|------|---------|
| Install deps | `cd backend && bundle install` |
| Start server | `cd backend && rails s -p 3000` |
| Run tests | `cd backend && bundle exec rspec` |
| Run linter | `cd backend && bundle exec rubocop` |
| Security scan | `cd backend && bundle exec brakeman` |
| Run gate | `./backend/scripts/gate.sh` |
| Rails console | `cd backend && rails c` |
| DB setup | `cd backend && rails db:create db:migrate db:seed` |

### Frontend

| Task | Command |
|------|---------|
| Install deps | `cd frontend && npm install` |
| Start dev server | `cd frontend && npm run dev` |
| Build for prod | `cd frontend && npm run build` |
| Type check | `cd frontend && npx tsc --noEmit` |
| Lint | `cd frontend && npx eslint .` |
| Run unit tests | `cd frontend && npx vitest run` |
| Run gate | `./frontend/scripts/gate.sh` |

---

## Project-Specific Rules

This project has Cursor rules in `.cursor/rules/`:

| File | Covers |
|------|--------|
| `project.mdc` | Overall project conventions |
| `backend.mdc` | Backend architecture & patterns |
| `frontend.mdc` | Frontend architecture & patterns |
| `testing.mdc` | Testing strategy & conventions |
| `database.mdc` | Database schema & migrations |
| `ai-service.mdc` | AI service integration |

Read the relevant rule files before working on a specific area.

---

## Closed-Loop Development Workflow

We use a "close the loop" approach where agents verify their own work before human review:

### Three Gates

1. **Sub-Agent Gate (automated)** — Both `./backend/scripts/gate.sh` AND `./frontend/scripts/gate.sh` must pass
2. **Jerry Visual QA (real browser)** — Navigate pages, take screenshots, verify flows work
3. **Leon Final Review (human)** — Review PR + screenshots, approve/reject

Leon shifts from "test everything" to "approve verified work." The gate scripts are the first line of defense — no PR without green gates.

### Branch Strategy

- All feature work branches from `staging`
- All PRs target `staging` (never `main` directly)
- `main` only gets updated when Leon approves merging staging
- Feature branches: `feature/<TICKET-ID>-description`

```bash
git checkout staging && git pull
git checkout -b feature/CST-5-add-tax-calculator
```

### PR Process

- **Title:** `CST-5: Add tax calculation engine`
- **Body includes:** what changed, which gates passed, screenshots
- After creating PR:
  1. Move Plane ticket to **QA / Testing**
  2. Add PR link to the ticket

### Ticket Tracking

Plane board is not yet set up for this project. When created, it will be under the Shimizu Technology workspace.

---

## Architecture Notes

- **Monorepo:** Backend and frontend live in the same repo under `backend/` and `frontend/`
- **Auth:** Clerk on both sides (backend verifies JWTs, frontend uses React SDK)
- **Both services need to run** for full local development (backend on 3000, frontend on 5173)
