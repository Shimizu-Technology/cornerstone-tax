# Cornerstone Accounting & Business Services
## Product Requirements Document (PRD)

**Version:** 1.0  
**Last Updated:** January 19, 2026  
**Status:** Draft - Pending Client Confirmation

---

## Table of Contents
1. [Guiding Principles](#guiding-principles)
2. [Executive Summary](#executive-summary)
3. [Business Information](#business-information)
4. [Project Overview](#project-overview)
5. [Technical Architecture](#technical-architecture)
6. [User Roles & Permissions](#user-roles--permissions)
7. [Feature Specifications](#feature-specifications)
8. [Database Schema](#database-schema)
9. [Notification System](#notification-system)
10. [Phase Roadmap](#phase-roadmap)
11. [Questions for Cornerstone](#questions-for-cornerstone)

---

## Guiding Principles

These principles guide all design and development decisions:

### 1. Mobile-First, Responsive Always
- **Every feature** must work seamlessly on mobile and desktop from day one
- Mobile is not an afterthought or "Phase 2" - it's built into every task
- Minimum 44x44px touch targets for all interactive elements
- Responsive layouts that adapt naturally to screen size
- Test on real devices, not just browser resize

### 2. Ease of Use Over Feature Richness
- The easier it is to use, the more people will actually use it
- Prioritize intuitive flows over powerful-but-complex features
- If a user needs instructions, we've already failed
- Reduce clicks, reduce friction, reduce cognitive load
- When in doubt, simplify

### 3. Do It Right, Not Quick
- Prefer proper solutions over bandaid fixes
- Build for the long run, not just "make it work now"
- Invest in good architecture upfront to avoid technical debt
- If cutting corners now creates problems later, don't cut corners
- This is a business they'll use for years - build it like it

### 4. User Empathy
- **Cornerstone staff** - busy during tax season, need efficiency
- **Clients** - may not be tech-savvy, need clarity and simplicity
- **Walk-ins** - filling form on iPad, need large touch targets and patience
- Design for the least technical user, not the most technical

---

## Executive Summary

Cornerstone Accounting & Business Services needs a unified digital platform to:
1. **Present their business online** - Professional website explaining services
2. **Digitize client intake** - Replace paper forms with digital submission
3. **Track tax return workflow** - Full visibility into each return's progress with audit trail
4. **Employee time tracking** - Replace spreadsheets with integrated solution
5. **Automate transmittal creation** - AI-powered document generation (future phase)
6. **Customer service chatbot** - RAG-based assistant for client questions (future phase)

---

## Business Information

### Company Details
| Field | Value |
|-------|-------|
| **Company Name** | Cornerstone Accounting |
| **Full Description** | Full-service accounting and advisory firm |
| **Address** | 130 Aspinall Ave, Suite 202, Hagatna, GU |
| **Phone** | (671) 482-8671 / (671) 828-8591 |
| **Email** | dmshimizucpa@gmail.com |
| **Location** | Guam |

### Owner
| Field | Value |
|-------|-------|
| **Name** | Dafne Mansapit Shimizu, CPA, MPA |
| **Title** | Owner / Certified Public Accountant |
| **Background** | Decades of experience in accounting, taxation, and financial leadership across both public and private sectors |

### Tagline
> "We believe accounting is more than numbers—it's about people, goals, and informed decision-making."

### Mission Statement
> Our mission is to provide dependable, high-quality accounting and advisory services that bring clarity, confidence, and peace of mind to our clients' financial lives.

### Vision Statement
> Our vision is to be a trusted cornerstone for individuals and businesses—recognized for excellence, integrity, and meaningful client relationships.

### Core Values
- **Integrity**
- **Accuracy**
- **Client Partnership**
- **Responsiveness**
- **Education**

### Services Offered
1. Accounting and bookkeeping services
2. Tax preparation and proactive tax planning
3. Payroll and compliance support
4. Financial statement preparation and analysis
5. Business advisory and consulting services
6. QuickBooks and cloud-based accounting solutions

### Company Story / About
> Cornerstone Accounting is a full-service accounting and advisory firm dedicated to helping individuals, entrepreneurs, and businesses build strong financial foundations. Just as a cornerstone supports and stabilizes a structure, we provide the clarity, accuracy, and guidance our clients need to make confident financial decisions and plan for long-term success.

> Cornerstone Accounting goes beyond compliance. We provide reliable accounting, tax, and advisory services designed to meet our clients where they are—whether they are starting a business, growing operations, or navigating complex financial and tax matters.

### How We Help Our Clients
> We believe accounting should empower, not overwhelm. Our approach is hands-on, collaborative, and tailored to each client's unique needs. We translate financial data into clear insights so clients can stay compliant, improve cash flow, and plan strategically.

### Branding
| Element | Notes |
|---------|-------|
| **Logo** | To be provided by client |
| **Primary Colors** | Warm/neutral palette - beige, cream, browns |
| **Accent Color** | Light pink (subtle, not dominant) |
| **Style** | Professional, warm, approachable |

### Domain
- **Status:** Needs to be purchased
- **Selected:** `cornerstoneguam.com` (or similar)
- **Other options considered:** 
  - `cornerstoneaccountingguam.com`
  - `cornerstoneabs.com`

---

## Project Overview

### Goals
1. Modernize client intake process for tax season
2. Provide full visibility into tax return workflow
3. Create audit trail for compliance and accountability
4. Simplify employee time tracking
5. Establish professional web presence

### Target Users

| User Type | Description | Count |
|-----------|-------------|-------|
| **Admin** | Business owner/manager, full access | 1-2 |
| **Employee** | Tax preparers, reviewers | 3-4 |
| **Client** | Customers submitting tax returns | Many |

### Success Metrics
- [ ] Paperless intake process
- [ ] All employees using digital time tracking
- [ ] Full audit trail on every tax return
- [ ] Reduced time looking for return status

---

## Technical Architecture

### Overview
```
┌─────────────────────────────────────────────────────────────────────────┐
│                         Frontend (React + Vite)                         │
│                           Hosted on Netlify                             │
├─────────────────────────────────────────────────────────────────────────┤
│  PUBLIC              │  CLIENT PORTAL        │  ADMIN DASHBOARD         │
│  • Marketing pages   │  • View return status │  • Workflow management   │
│  • Intake form       │  • Upload documents   │  • Time tracking         │
│  • Contact info      │  • Messages           │  • Transmittal maker     │
└──────────┬───────────┴──────────┬────────────┴────────────┬─────────────┘
           │                      │                         │
           ▼                      ▼                         ▼
┌─────────────────────────────────────────────┐   ┌─────────────────────┐
│           Rails API (Main Backend)          │   │  FastAPI (AI)       │
│              Hosted on Render               │   │  Hosted on Render   │
├─────────────────────────────────────────────┤   ├─────────────────────┤
│  • Auth (Clerk)                             │   │  • Transmittal AI   │
│  • Clients / Tax Returns CRUD               │   │  • Chat interface   │
│  • Workflow & Audit Trail                   │   │  • PDF generation   │
│  • Time Entries                             │   │  • (Future chatbot) │
│  • Documents (S3)                           │   │                     │
│  • Notifications (Resend, ClickSend)        │   │                     │
└──────────────────────┬──────────────────────┘   └──────────┬──────────┘
                       │                                      │
                       ▼                                      ▼
              ┌─────────────────────────────────────────────────────┐
              │              PostgreSQL (Neon)                      │
              │         Shared database for both services           │
              └─────────────────────────────────────────────────────┘
```

### Tech Stack

| Layer | Technology | Purpose |
|-------|------------|---------|
| **Frontend** | React + Vite + Tailwind CSS | User interface |
| **Main Backend** | Ruby on Rails (API mode) | CRUD, workflow, business logic |
| **AI Backend** | Python + FastAPI | Transmittal AI, chatbot |
| **Database** | PostgreSQL (Local dev, Neon prod) | Data storage (shared) |
| **Authentication** | Clerk | User management, SSO |
| **File Storage** | AWS S3 (private) | Document uploads |
| **Email** | Resend | Transactional emails |
| **SMS** | ClickSend | Text notifications |
| **Frontend Hosting** | Netlify | Auto-deploy on push |
| **Backend Hosting** | Render | Rails + FastAPI services |

### Shared Database Pattern

Both Rails and FastAPI connect to the same PostgreSQL database:

1. **Rails manages schema** - All migrations run through Rails
2. **FastAPI mirrors schema** - SQLAlchemy models match Rails tables
3. **Both can read/write** - Direct database access, no inter-service API calls
4. **Single source of truth** - Consistent data across services

**Development (Local PostgreSQL):**
```bash
# No DATABASE_URL needed - uses local PostgreSQL
# Database name: cornerstone_development
```

**Production (Neon PostgreSQL):**
```bash
# Both services use the same Neon connection string
DATABASE_URL=postgresql://user:password@ep-xxx.neon.tech/cornerstone_db
```

### Repository Structure

```
cornerstone-tax/
├── frontend/                      # React (Vite + Tailwind)
│   ├── src/
│   │   ├── components/
│   │   │   ├── ui/                # Reusable UI components
│   │   │   ├── forms/             # Form components
│   │   │   └── layouts/           # Page layouts
│   │   ├── pages/
│   │   │   ├── public/            # Marketing site
│   │   │   │   ├── Home.tsx
│   │   │   │   ├── About.tsx
│   │   │   │   ├── Services.tsx
│   │   │   │   └── Contact.tsx
│   │   │   ├── intake/            # Client intake form
│   │   │   │   └── IntakeForm.tsx
│   │   │   ├── portal/            # Client portal (Phase 2+)
│   │   │   │   ├── Dashboard.tsx
│   │   │   │   └── Documents.tsx
│   │   │   └── admin/             # Employee dashboard
│   │   │       ├── Dashboard.tsx
│   │   │       ├── Clients.tsx
│   │   │       ├── ClientDetail.tsx
│   │   │       ├── Workflow.tsx
│   │   │       ├── TimeTracking.tsx
│   │   │       └── Transmittals.tsx
│   │   ├── hooks/
│   │   ├── lib/
│   │   │   ├── api.ts             # API client
│   │   │   └── utils.ts
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   └── vite.config.ts
│
├── backend/                       # Rails API
│   ├── app/
│   │   ├── controllers/
│   │   │   ├── application_controller.rb
│   │   │   └── api/
│   │   │       └── v1/
│   │   │           ├── clients_controller.rb
│   │   │           ├── tax_returns_controller.rb
│   │   │           ├── documents_controller.rb
│   │   │           ├── time_entries_controller.rb
│   │   │           ├── workflow_events_controller.rb
│   │   │           └── users_controller.rb
│   │   ├── models/
│   │   │   ├── user.rb
│   │   │   ├── client.rb
│   │   │   ├── dependent.rb
│   │   │   ├── tax_return.rb
│   │   │   ├── income_source.rb
│   │   │   ├── document.rb
│   │   │   ├── workflow_event.rb
│   │   │   ├── time_entry.rb
│   │   │   ├── transmittal.rb
│   │   │   └── notification.rb
│   │   ├── services/
│   │   │   ├── clerk_service.rb
│   │   │   ├── s3_service.rb
│   │   │   └── notification_service.rb
│   │   └── jobs/
│   │       ├── send_email_job.rb
│   │       └── send_sms_job.rb
│   ├── config/
│   ├── db/
│   │   ├── migrate/
│   │   └── schema.rb
│   ├── Gemfile
│   └── .env
│
├── ai-service/                    # FastAPI for AI features
│   ├── app/
│   │   ├── main.py
│   │   ├── config.py
│   │   ├── database.py
│   │   ├── routers/
│   │   │   ├── transmittals.py
│   │   │   └── chat.py            # Future chatbot
│   │   ├── services/
│   │   │   ├── llm_service.py     # OpenAI integration
│   │   │   └── pdf_service.py     # PDF generation
│   │   └── models/
│   │       ├── transmittal.py     # SQLAlchemy models
│   │       └── client.py
│   ├── requirements.txt
│   └── .env
│
├── PRD.md                         # This document
└── README.md
```

---

## User Roles & Permissions

### Role Definitions

| Role | Description |
|------|-------------|
| **Admin** | Business owner/manager with full system access |
| **Employee** | Tax preparer or reviewer with operational access |
| **Client** | Customer who submitted an intake form |

### Permission Matrix

| Feature | Admin | Employee | Client |
|---------|-------|----------|--------|
| View all clients | ✅ | ✅ | ❌ |
| View own return status | ✅ | ✅ | ✅ |
| Create/edit clients | ✅ | ✅ | ❌ |
| Change return status | ✅ | ✅ | ❌ |
| Assign returns to employees | ✅ | ❌ | ❌ |
| View all time entries | ✅ | ❌ | ❌ |
| Log own time entries | ✅ | ✅ | ❌ |
| Upload documents | ✅ | ✅ | ✅ |
| View audit trail | ✅ | ✅ | ❌ |
| Manage users | ✅ | ❌ | ❌ |
| Generate transmittals | ✅ | ✅ | ❌ |
| View reports | ✅ | ❌ | ❌ |

---

## Feature Specifications

### 1. Public Website

**Purpose:** Present the business professionally online

**Pages:**
| Page | Content |
|------|---------|
| **Home** | Hero section, brief intro, services overview, CTA |
| **About** | Company story, team, mission/values |
| **Services** | Detailed service descriptions |
| **Contact** | Contact form, address, phone, email, map |

**Design Notes:**
- Warm, professional aesthetic
- Beige/cream primary with brown and light pink accents
- Mobile-responsive
- Clear CTAs for intake form

---

### 2. Client Intake Form

**Purpose:** Replace paper intake form with digital submission

**Access Methods:**

| Method | URL | Use Case |
|--------|-----|----------|
| **Public Online** | `/intake` | Client fills out at home before visit |
| **iPad Kiosk** | `/intake?mode=kiosk` | Walk-in clients fill out in office |
| **Admin Entry** | Dashboard → New Client | Staff enters data from paper form |

**iPad Kiosk Mode Features:**
- Same form, tablet-optimized layout
- Larger touch targets (min 48x48px)
- No navigation header (full-screen experience)
- After submission:
  - Shows success message
  - 15-second countdown to auto-reset
  - "Start New Form" button for next client
- Optional: Use iPad's Guided Access to lock to this page

**Admin Manual Entry:**
- **Quick-Create** (Dashboard): Basic info only, fill details later
- **Full Form**: Admin uses intake form on behalf of client

**Form Sections:**

#### Section 1: Client Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| First Name | Text | ✅ | |
| Last Name | Text | ✅ | |
| Date of Birth | Date | ✅ | |
| Email | Email | ✅ | For notifications |
| Phone Number | Phone | ✅ | |
| Mailing Address | Textarea | ✅ | |

#### Section 2: Tax Filing Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Tax Year | Select | ✅ | Default: 2025 |
| Filing Status | Radio | ✅ | Married, Single, HOH, Other |
| Is New Client? | Checkbox | | |
| Has Prior Year Return Copy? | Checkbox | | |
| Changes from Prior Year | Textarea | | "New job, new dependent, got married, etc." |

#### Section 3: Income Information
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| W-2 Employers | Repeatable | | List of employer names |
| 1099 Forms | Checkboxes | | Types: MISC, INT, DIV, NEC, R, SSA |
| Retirement Forms From | Repeatable | | List of institutions |

#### Section 4: Special Questions
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Denied EIC/ACTC/HOH by IRS? | Radio | | Yes/No |
| If yes, what year? | Number | Conditional | |
| Crypto transactions in 2025? | Radio | | "Receive, sell, exchange, dispose" |

#### Section 5: Spouse Information (if Married)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Spouse Full Name | Text | Conditional | |
| Spouse DOB | Date | Conditional | |

#### Section 6: Dependents (Repeatable)
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Dependent Name | Text | | |
| DOB | Date | | |
| Relationship | Text | | |
| Months Lived with You | Number | | 0-12 |
| Full-Time Student? | Checkbox | | |
| Disabled? | Checkbox | | |
| Can be claimed by another? | Checkbox | | |

#### Section 7: Refund Preference
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Refund Method | Radio | | Check / Direct Deposit |
| Routing Number | Text | Conditional | If direct deposit |
| Account Number | Text | Conditional | If direct deposit, encrypted |
| Account Type | Radio | Conditional | Checking / Savings |

#### Section 8: Authorization
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Confirmation Checkbox | Checkbox | ✅ | "I confirm information is accurate..." |
| Electronic Signature | Text | ✅ | Typed name |
| Date | Date | ✅ | Auto-filled |

**Submission Flow:**
1. Client fills out form
2. Form validates all required fields
3. Submission creates Client + TaxReturn records
4. Notification sent to admin/employees
5. Client receives confirmation email

---

### 3. Admin Dashboard - Workflow Management

**Purpose:** Track all tax returns through the preparation process

**Workflow Stages:**
| Stage | Description | Triggers |
|-------|-------------|----------|
| `intake_received` | Client submitted intake form | Automatic on submission |
| `documents_pending` | Waiting for documents | Manual status change |
| `in_preparation` | Tax preparer working on return | Manual assignment |
| `in_review` | Supervisor reviewing | Manual status change |
| `ready_to_sign` | Waiting for client signature | **Sends notification** |
| `filing` | Being submitted to IRS | Manual status change |
| `ready_for_pickup` | Complete, awaiting pickup | **Sends notification** |
| `complete` | Archived/closed | Manual status change |

**Dashboard Views:**

1. **Kanban Board** - Drag-and-drop cards between status columns
2. **List View** - Sortable/filterable table of all returns
3. **Client Detail** - Full info, documents, audit trail for single client

**Audit Trail:**
Every action is logged with:
- Who performed the action (user)
- What changed (event type, old value, new value)
- When it happened (timestamp)
- Optional description/notes

---

### 4. Document Upload

**Purpose:** Clients and employees can upload tax documents

**Supported Documents:**
- W-2 forms
- 1099 forms (various types)
- Prior year returns
- ID documents
- Other supporting documents

**Implementation:**
1. Frontend requests pre-signed URL from Rails
2. Frontend uploads directly to S3
3. Rails saves S3 key to database
4. Viewing generates time-limited signed URL

**Security:**
- Private S3 bucket (no public access)
- Pre-signed URLs expire after 1 hour
- Upload URLs expire after 15 minutes

---

### 5. Time Tracking

**Purpose:** Replace spreadsheet-based time tracking

**Time Entry Fields:**
| Field | Type | Required | Notes |
|-------|------|----------|-------|
| Date | Date | ✅ | |
| Hours | Decimal | ✅ | e.g., 1.5 |
| Category | Select | ✅ | See categories below |
| Client | Select | | Optional association |
| Tax Return | Select | | Optional association |
| Description | Textarea | | What was done |

**Categories (TBD - needs confirmation):**
- Tax Preparation
- Client Consultation
- Document Review
- Administrative
- Training
- Other

**Views:**
- **Daily Log** - Quick entry for today
- **Weekly View** - See/edit the week
- **Reports** - Totals by employee, client, category

---

### 6. Transmittal Generator (Phase 4)

**Purpose:** AI-powered creation of transmittal documents

**Approach:** Chat-based interface (similar to Invoice Maker)

**Features:**
- Conversational creation ("Create a transmittal for John Smith...")
- Auto-populate from client data
- PDF generation
- Save to database
- Link to tax return

**Tech:** FastAPI + OpenAI + PDF generation library

---

### 7. Client Portal (Future)

**Purpose:** Clients can log in to view their return status

**Features:**
- View return status
- Upload additional documents
- Receive messages from preparers
- Download completed return

---

### 8. Customer Service Chatbot (Future)

**Purpose:** Answer common client questions

**Approach:** RAG-based chatbot

**Knowledge Base:**
- Business hours and location
- Service descriptions
- Tax deadlines
- Document requirements
- General tax FAQs

---

## Database Schema

### Entity Relationship Diagram

```
┌─────────────┐     ┌──────────────┐     ┌─────────────────┐
│   Users     │     │   Clients    │────<│   Dependents    │
│  (Clerk)    │     │              │     └─────────────────┘
└──────┬──────┘     └──────┬───────┘
       │                   │
       │    ┌──────────────┴───────────────┐
       │    │                              │
       ▼    ▼                              ▼
┌──────────────────┐              ┌────────────────┐
│   Tax Returns    │─────────────<│ Income Sources │
│   (workflow)     │              └────────────────┘
└────────┬─────────┘
         │
    ┌────┴────┬──────────────┬─────────────┐
    ▼         ▼              ▼             ▼
┌────────┐ ┌───────────┐ ┌───────────┐ ┌─────────────┐
│Documents│ │ Workflow  │ │Transmittals│ │Notifications│
│  (S3)  │ │  Events   │ │           │ │             │
└────────┘ │(audit log)│ └───────────┘ └─────────────┘
           └───────────┘

┌─────────────────┐
│  Time Entries   │ (links to user, optionally client/tax_return)
└─────────────────┘
```

### Configurable Settings

To support flexibility without code changes, these items are **admin-configurable**:

#### workflow_stages (Configurable)
```sql
CREATE TABLE workflow_stages (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,           -- e.g., "In Preparation"
  slug VARCHAR NOT NULL UNIQUE,    -- e.g., "in_preparation"
  description TEXT,                -- Optional help text
  position INTEGER NOT NULL,       -- Order in workflow (1, 2, 3...)
  color VARCHAR,                   -- For UI display (e.g., "#3B82F6")
  notify_client BOOLEAN DEFAULT FALSE,  -- Trigger notification on entry?
  is_active BOOLEAN DEFAULT TRUE,  -- Can be disabled without deleting
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default stages (seeded on setup)
-- 1: intake_received, 2: documents_pending, 3: in_preparation,
-- 4: in_review, 5: ready_to_sign, 6: filing, 7: ready_for_pickup, 8: complete
```

#### time_categories (Configurable)
```sql
CREATE TABLE time_categories (
  id SERIAL PRIMARY KEY,
  name VARCHAR NOT NULL,           -- e.g., "Tax Preparation"
  description TEXT,
  is_active BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Default categories (seeded on setup)
-- Tax Preparation, Client Consultation, Document Review, Administrative, Training
```

**Benefits of this approach:**
- Admins can add/edit/disable workflow stages without developer involvement
- Admins can create custom time tracking categories
- Stages can be reordered by changing `position`
- Soft-delete via `is_active` flag preserves historical data
- `notify_client` flag controls which stages trigger notifications

### Table Definitions

#### users
```sql
CREATE TABLE users (
  id SERIAL PRIMARY KEY,
  clerk_id VARCHAR NOT NULL UNIQUE,
  email VARCHAR NOT NULL,
  first_name VARCHAR,
  last_name VARCHAR,
  role VARCHAR DEFAULT 'client',  -- admin, employee, client
  phone VARCHAR,
  client_id INTEGER REFERENCES clients(id),  -- only for role='client'
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### clients
```sql
CREATE TABLE clients (
  id SERIAL PRIMARY KEY,
  
  -- Basic Info
  first_name VARCHAR NOT NULL,
  last_name VARCHAR NOT NULL,
  date_of_birth DATE,
  email VARCHAR,
  phone VARCHAR,
  mailing_address TEXT,
  
  -- Filing Info
  filing_status VARCHAR,  -- married, single, hoh, other
  is_new_client BOOLEAN DEFAULT TRUE,
  has_prior_year_return BOOLEAN DEFAULT FALSE,
  changes_from_prior_year TEXT,
  
  -- Spouse Info
  spouse_name VARCHAR,
  spouse_dob DATE,
  
  -- Special Questions
  denied_eic_actc BOOLEAN DEFAULT FALSE,
  denied_eic_actc_year INTEGER,
  has_crypto_transactions BOOLEAN DEFAULT FALSE,
  
  -- Bank Info (encrypted)
  bank_routing_number_encrypted VARCHAR,
  bank_account_number_encrypted VARCHAR,
  bank_account_type VARCHAR,  -- checking, savings
  wants_direct_deposit BOOLEAN DEFAULT FALSE,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### dependents
```sql
CREATE TABLE dependents (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  name VARCHAR NOT NULL,
  date_of_birth DATE,
  relationship VARCHAR,
  months_lived_with_client INTEGER,
  is_student BOOLEAN DEFAULT FALSE,
  is_disabled BOOLEAN DEFAULT FALSE,
  can_be_claimed_by_other BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### tax_returns
```sql
CREATE TABLE tax_returns (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  tax_year INTEGER NOT NULL,
  
  -- References configurable workflow_stages table
  workflow_stage_id INTEGER REFERENCES workflow_stages(id),
  
  assigned_to_id INTEGER REFERENCES users(id),
  reviewed_by_id INTEGER REFERENCES users(id),
  
  notes TEXT,
  completed_at TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  
  UNIQUE(client_id, tax_year)
);
```

#### income_sources
```sql
CREATE TABLE income_sources (
  id SERIAL PRIMARY KEY,
  tax_return_id INTEGER NOT NULL REFERENCES tax_returns(id),
  source_type VARCHAR,  -- w2, 1099_misc, 1099_int, 1099_div, retirement
  payer_name VARCHAR,
  notes TEXT,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### workflow_events
```sql
CREATE TABLE workflow_events (
  id SERIAL PRIMARY KEY,
  tax_return_id INTEGER NOT NULL REFERENCES tax_returns(id),
  user_id INTEGER REFERENCES users(id),  -- null if system-generated
  event_type VARCHAR NOT NULL,
  -- event_types: status_changed, assigned, note_added, document_uploaded, 
  --              document_deleted, client_notified, reviewed, etc.
  
  old_value VARCHAR,
  new_value VARCHAR,
  description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW()
);
```

#### documents
```sql
CREATE TABLE documents (
  id SERIAL PRIMARY KEY,
  tax_return_id INTEGER NOT NULL REFERENCES tax_returns(id),
  uploaded_by_id INTEGER REFERENCES users(id),  -- null if client uploaded
  
  document_type VARCHAR,  -- w2, 1099, id, prior_return, other
  filename VARCHAR NOT NULL,
  s3_key VARCHAR NOT NULL,
  content_type VARCHAR,
  file_size INTEGER,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### time_entries
```sql
CREATE TABLE time_entries (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL REFERENCES users(id),
  client_id INTEGER REFERENCES clients(id),
  tax_return_id INTEGER REFERENCES tax_returns(id),
  
  work_date DATE NOT NULL,
  hours DECIMAL(4,2) NOT NULL,
  
  -- References configurable time_categories table
  time_category_id INTEGER REFERENCES time_categories(id),
  
  description TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### transmittals
```sql
CREATE TABLE transmittals (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  tax_return_id INTEGER REFERENCES tax_returns(id),
  created_by_id INTEGER NOT NULL REFERENCES users(id),
  
  transmittal_number VARCHAR,
  date DATE,
  items JSONB,  -- Array of items being transmitted
  notes TEXT,
  status VARCHAR DEFAULT 'draft',  -- draft, sent, acknowledged
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

#### notifications
```sql
CREATE TABLE notifications (
  id SERIAL PRIMARY KEY,
  client_id INTEGER NOT NULL REFERENCES clients(id),
  tax_return_id INTEGER REFERENCES tax_returns(id),
  
  notification_type VARCHAR,  -- email, sms
  template VARCHAR,           -- ready_to_sign, ready_for_pickup, documents_needed
  recipient VARCHAR,          -- email or phone
  status VARCHAR DEFAULT 'pending',  -- pending, sent, failed
  content TEXT,
  sent_at TIMESTAMP,
  error_message TEXT,
  
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## Notification System

### Triggers

| Event | Email | SMS | Template |
|-------|-------|-----|----------|
| Intake form submitted | ✅ | ❌ | `intake_confirmation` |
| Documents requested | ✅ | ✅ | `documents_needed` |
| Return ready to sign | ✅ | ✅ | `ready_to_sign` |
| Return filed | ✅ | ❌ | `return_filed` |
| Return ready for pickup | ✅ | ✅ | `ready_for_pickup` |

### Implementation

**Email:** Resend API
**SMS:** ClickSend API

**Background Jobs:**
- Notifications queued as background jobs
- Retry on failure
- Status tracked in notifications table

---

## Phase Roadmap

### Phase 1: Foundation (Week 1-2)
**Goal:** Get core functionality live for tax season

| Feature | Priority | Status |
|---------|----------|--------|
| Project setup (Rails + React + DB) | P0 | ✅ |
| Database schema & models | P0 | ✅ |
| Public website (Home, About, Services, Contact) | P1 | ✅ |
| Clerk authentication | P0 | ⬜ |
| Client intake form (online + kiosk mode) | P0 | ⬜ |
| Admin quick-create client | P0 | ⬜ |
| Admin dashboard - client list | P0 | ⬜ |
| Basic workflow tracking (status changes) | P0 | ⬜ |
| Audit trail (workflow events) | P0 | ⬜ |

### Phase 2: Enhanced Workflow (Week 3-4)
**Goal:** Full workflow management and notifications

| Feature | Priority | Status |
|---------|----------|--------|
| Kanban board view | P1 | ⬜ |
| Return assignment to employees | P1 | ⬜ |
| Document upload (S3) | P1 | ⬜ |
| Email notifications | P1 | ⬜ |
| SMS notifications | P2 | ⬜ |

### Phase 3: Time Tracking (Week 5)
**Goal:** Replace spreadsheet time tracking

| Feature | Priority | Status |
|---------|----------|--------|
| Time entry CRUD | P1 | ⬜ |
| Daily/weekly views | P1 | ⬜ |
| Reports | P2 | ⬜ |

### Phase 4: Transmittal Maker (Week 6-7)
**Goal:** AI-powered transmittal generation

| Feature | Priority | Status |
|---------|----------|--------|
| FastAPI service setup | P1 | ⬜ |
| Chat interface | P1 | ⬜ |
| OpenAI integration | P1 | ⬜ |
| PDF generation | P1 | ⬜ |

### Phase 5: Client Portal (Future)
**Goal:** Self-service for clients

| Feature | Priority | Status |
|---------|----------|--------|
| Client login | P2 | ⬜ |
| View return status | P2 | ⬜ |
| Document upload | P2 | ⬜ |
| Messaging | P3 | ⬜ |

### Phase 6: AI Chatbot (Future)
**Goal:** Customer service automation

| Feature | Priority | Status |
|---------|----------|--------|
| RAG knowledge base | P3 | ⬜ |
| Chat widget | P3 | ⬜ |
| FAQ automation | P3 | ⬜ |

---

## Questions for Cornerstone

### Status: Resolved or Deferred

| Item | Decision | Notes |
|------|----------|-------|
| **Logo** | ⏳ Get later | Will obtain from client, start without it |
| **Brand guidelines** | ✅ Skip | No formal guidelines, we'll design based on warm/neutral palette |
| **Workflow stages** | ✅ Default + Configurable | Use proposed 8 stages, make admin-configurable |
| **Notifications** | ⏳ Phase 2 | Implement later, not blocking |
| **Time tracking categories** | ✅ Configurable | Admins can add/edit categories |
| **Business hours** | ✅ Placeholder | Easy to update later |
| **Domain** | ⏳ Later | Will be `cornerstoneguam.com` or similar |
| **Client portal** | ⏳ Future | Architecture will support it, implement later |
| **About content** | ✅ Complete | All content provided |

### Still Need (Can Get Anytime)

1. **Logo** - High-res PNG with transparent background
2. **Employee list** - Names and emails for account setup
3. **Transmittal example** - For Phase 4
4. **Business hours** - For contact page (using placeholder for now)

---

## Appendix

### A. Guam-Specific Considerations

- **Time Zone:** ChST (Chamorro Standard Time, UTC+10)
- **Tax Authority:** Guam Department of Revenue and Taxation (may file with both Guam and IRS)
- **Phone Format:** Area code 671

### B. Security Considerations

- All sensitive data (bank info) encrypted at rest
- Pre-signed S3 URLs for document access
- Clerk handles authentication security
- HTTPS everywhere
- Environment variables for all secrets

### C. Mobile Responsiveness

Per Guiding Principle #1, all features must be optimized for both mobile and desktop **from day one**:

**Layout:**
- Responsive grid system (mobile stack, desktop side-by-side)
- Hamburger menu for mobile navigation
- Responsive tables → card view on mobile
- Full-width forms on mobile, constrained on desktop

**Touch Targets:**
- Minimum 44x44px for all interactive elements
- 48x48px for primary actions (submit buttons, etc.)
- Adequate spacing between touch targets

**Forms:**
- Large input fields on mobile
- Native date/select pickers where appropriate
- Clear validation messages
- Sticky submit button on long forms

**Testing:**
- Test on real iOS and Android devices
- Test on tablet (iPad kiosk mode)
- Chrome DevTools responsive mode for quick checks

---

*Document created: January 19, 2026*  
*Next review: After Cornerstone meeting*
