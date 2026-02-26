# Cornerstone Accounting Platform

A unified digital platform for Cornerstone Accounting & Business Services (Guam).

## Quick Start

### Prerequisites
- Ruby 3.3+
- Node.js 18+
- PostgreSQL 14+

### 1. Clone and Install

```bash
# Backend
cd backend
bundle install
rails db:create db:migrate db:seed

# Frontend
cd ../frontend
npm install
```

### 2. Environment Setup

**Backend** (`backend/.env`):
```bash
# Clerk Authentication
CLERK_JWKS_URL=https://your-app.clerk.accounts.dev/.well-known/jwks.json

# Active Record Encryption (generate with: bin/rails db:encryption:init)
ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=<your_key>
ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=<your_key>
ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=<your_salt>
```

**Frontend** (`frontend/.env`):
```bash
VITE_CLERK_PUBLISHABLE_KEY=pk_test_xxxxx
VITE_API_URL=http://localhost:3000
```

### 3. Run Development Servers

```bash
# Terminal 1 - Backend (runs on port 3000)
cd backend
rails server

# Terminal 2 - Frontend (runs on port 5173)
cd frontend
npm run dev
```

Visit: http://localhost:5173

---

## Project Structure

```
cornerstone-tax/
├── backend/          # Rails API
├── frontend/         # React + Vite
├── PRD.md           # Product Requirements Document
├── BUILD_PLAN.md    # Development phases and progress
└── FUTURE_IMPROVEMENTS.md  # Planned enhancements
```

---

## Tech Stack

| Layer | Technology |
|-------|------------|
| Frontend | React, Vite, Tailwind CSS |
| Backend | Ruby on Rails (API mode) |
| Database | PostgreSQL |
| Auth | Clerk |
| File Storage | AWS S3 (planned) |
| Email | Resend (planned) |
| SMS | ClickSend (planned) |

---

## Authentication

Uses Clerk for authentication with JWT verification.

**Flow:**
1. User signs in via Clerk on frontend
2. Frontend includes JWT token in API requests
3. Backend verifies token using Clerk's public keys (JWKS)
4. User record created/updated in database automatically

**Roles:**
- `admin` - Full access (first user becomes admin)
- `employee` - Workflow and time tracking access
- `client` - View own tax returns (future)

---

## Security

### Bank Data Encryption
Bank routing and account numbers are encrypted at rest using Rails Active Record Encryption.

Generate keys:
```bash
cd backend
bin/rails db:encryption:init
```

Add the generated keys to your `.env` file.

---

## API Endpoints

### Public (No Auth)
- `POST /api/v1/intake` - Submit client intake form
- `GET /api/v1/workflow_stages` - List workflow stages

### Protected (Requires Auth)
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/me` - Get current user (alternate for Clerk email payload)
- `GET /api/v1/clients` - List clients
- `GET /api/v1/clients/:id` - Get client detail
- `POST /api/v1/clients` - Create client (quick create)
- `GET /api/v1/tax_returns` - List tax returns
- `PATCH /api/v1/tax_returns/:id` - Update tax return

---

## Development Notes

### Running Without Clerk (Dev Mode)
If `VITE_CLERK_PUBLISHABLE_KEY` is not set, the frontend runs without authentication. Useful for quick local testing.

### Database Seeds
```bash
cd backend
rails db:seed
```
Creates default workflow stages and time categories.

---

## Documentation

- `docs/PRD-recurring-client-operations-checklists.md` - Product requirements for recurring operations checklists
- `docs/BUILD_PLAN-recurring-client-operations-checklists.md` - Build phases and completion tracking
- `docs/OPERATIONS_CHECKLISTS_ADMIN_GUIDE.md` - Admin workflow + troubleshooting for recurrence and cycle generation
- `docs/TESTING_GUIDE.md` - Testing and verification guidance
- `.cursor/rules/` - AI assistant context rules
