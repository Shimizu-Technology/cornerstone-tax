# Cornerstone Accounting - Build Plan

## Overview

This document outlines the step-by-step plan to build the Cornerstone platform.  
Reference the PRD.md for detailed specifications.

---

## Current Status

**Last Updated:** January 20, 2026

| Phase | Status | Notes |
|-------|--------|-------|
| Phase 1: Foundation | ✅ Complete | Project setup, DB schema, models, Clerk frontend done |
| Phase 2: Public Website | ✅ Complete | All 4 marketing pages built |
| Phase 3: Intake Form | ✅ Complete | Multi-step form with kiosk mode |
| Phase 4: Admin Dashboard | ✅ Complete | Layout, clients, auth, user management (invite-only) |
| Phase 5: Workflow Tracking | ✅ Complete | Tax returns, status changes, audit trail, activity page |
| Phase 6: Time Tracking | ✅ Complete | Entries, categories, day/week views, admin reports |
| Phase 7: Document Upload | ✅ Complete | S3 integration, drag-and-drop UI, download/delete |
| Phase 8: Notifications | 🔄 Partial | Resend email setup complete, SMS pending |
| Phase 9: Transmittal Maker | ⬜ Not Started | |
| Phase 10: Polish & Deploy | ✅ Complete | Deployed to Netlify + Render + Neon |

### Production URLs
- **Frontend:** https://cornerstone-accounting.tax (Netlify)
- **Backend:** https://cornerstone-tax-backend.onrender.com (Render)
- **Database:** Neon PostgreSQL (production)

### Local Development
- **Frontend:** http://localhost:5173 (Vite dev server)
- **Backend:** http://localhost:3000 (Rails API server)
- **Database:** Local PostgreSQL (`backend_development`)

### Services Configured
- **Clerk Production:** ✅ 5/5 DNS records verified
- **Resend Email:** ✅ Domain verified, invitation emails working
- **SSL/HTTPS:** ✅ Let's Encrypt via Netlify

### Next Steps
1. Build Phase 7: Document Upload (S3)
2. Complete Phase 8: Notifications (SMS via ClickSend)
3. Build Phase 9: Transmittal Maker (AI)

---

## Phase 1: Foundation (Week 1) ✅ COMPLETE

### 1.1 Project Setup ✅
- [x] Create monorepo structure (`frontend/`, `backend/`, `ai-service/`)
- [x] Initialize Rails API (`rails new backend --api --database=postgresql`)
- [x] Initialize React app (`npm create vite@latest frontend -- --template react-ts`)
- [x] Set up Tailwind CSS in frontend
- [x] Create `.env.example` files for both services
- [x] Set up local PostgreSQL database (Neon for production)
- [x] Configure database connection in Rails
- [x] Configure CORS for frontend

### 1.2 Authentication (Clerk)
- [x] Create Clerk application
- [x] Install Clerk SDK in frontend (`@clerk/clerk-react`)
- [x] Add ClerkProvider to main.tsx
- [x] Add auth buttons to Header (SignInButton, UserButton)
- [x] Create `users` table (migration created)
- [ ] Set up Clerk JWT verification in Rails
- [ ] Create sync webhook
- [ ] Implement `authenticate_user!` in ApplicationController
- [ ] Set up role-based access (admin, employee, client)

### 1.3 Database Schema ✅
- [x] Create migration: `workflow_stages` (configurable)
- [x] Create migration: `time_categories` (configurable)
- [x] Create migration: `users`
- [x] Create migration: `clients`
- [x] Create migration: `dependents`
- [x] Create migration: `tax_returns`
- [x] Create migration: `income_sources`
- [x] Create migration: `workflow_events`
- [x] Create migration: `documents`
- [x] Create migration: `time_entries`
- [x] Create migration: `notifications`
- [x] Create migration: `transmittals`
- [x] Create seed file for default workflow stages
- [x] Create seed file for default time categories
- [x] Run migrations and seeds

### 1.4 Rails Models & Relationships ✅
- [x] Create all models with validations
- [x] Set up associations (belongs_to, has_many)
- [x] Add scopes for common queries
- [ ] Test models in Rails console

---

## Phase 2: Public Website (Week 1-2) ✅ COMPLETE

### 2.1 Frontend Structure ✅
- [x] Set up React Router
- [x] Create layout components (Header, Footer)
- [x] Create responsive navigation (hamburger for mobile)
- [x] Set up Tailwind theme (colors, fonts)

### 2.2 Marketing Pages ✅
- [x] **Home Page**
  - Hero section with tagline
  - Services overview (cards)
  - Call-to-action buttons
  - Why Choose Us section
- [x] **About Page**
  - Company story
  - Mission/Vision/Values
  - Owner bio (Dafne Mansapit Shimizu, CPA, MPA)
- [x] **Services Page**
  - Detailed service descriptions
  - All 6 services listed
- [x] **Contact Page**
  - Contact form (name, email, subject, message)
  - Address, phone, email display
  - Business hours
  - [ ] Google Maps embed (optional - can add later)

### 2.3 Responsive Testing
- [ ] Test all pages on mobile (375px)
- [ ] Test all pages on tablet (768px)
- [ ] Test all pages on desktop (1280px+)
- [ ] Verify touch targets are 44px+

---

## Phase 3: Client Intake Form (Week 2) ✅ COMPLETE

### 3.1 Backend API ✅
- [x] `POST /api/v1/intake` - Submit intake form
- [x] `GET /api/v1/workflow_stages` - Get available stages
- [x] Create `CreateIntakeService` for form processing
- [x] Auto-create TaxReturn with initial stage
- [x] Log WorkflowEvent on creation

### 3.2 Intake Form UI ✅
- [x] Create multi-step form wizard (8 steps)
- [x] **Section 1**: Client Information (name, DOB, contact, address)
- [x] **Section 2**: Tax Filing Info (year, status, new client, prior return)
- [x] **Section 3**: Income Sources (W-2s, 1099s)
- [x] **Section 4**: Special Questions (EIC/ACTC, crypto)
- [x] **Section 5**: Spouse Info (conditional on married - auto-skipped if not)
- [x] **Section 6**: Dependents (repeatable section)
- [x] **Section 7**: Direct Deposit / Refund Preference
- [x] **Section 8**: Authorization (checkbox + signature)

### 3.3 Form Features ✅
- [x] Client-side validation (required fields, email format)
- [x] Server-side validation (Rails model validations)
- [x] Error display (inline per field)
- [x] Success confirmation page
- [x] Mobile-optimized layout (responsive design)

### 3.4 Kiosk Mode ✅
- [x] `?mode=kiosk` URL parameter handling
- [x] Remove navigation header in kiosk mode
- [x] Auto-reset form after submission (15 sec countdown)
- [x] "Start New Form" button
- [x] Larger touch targets for tablet (56px min height)

---

## Phase 4: Admin Dashboard - Core (Week 2-3) ✅ COMPLETE

### 4.1 Dashboard Layout ✅
- [x] Admin layout with sidebar/nav
- [x] Responsive sidebar (collapsible on mobile)
- [x] Protected routes (require Clerk auth)
- [x] Role checking (admin/employee/staff)

### 4.2 Client List ✅
- [x] `GET /api/v1/clients` - List all clients with search/filter/pagination
- [x] Table view with columns: Name, Contact, Status, Assigned To, Date
- [x] Search functionality
- [x] Pagination
- [x] Card view on mobile

### 4.3 Client Detail View ✅
- [x] `GET /api/v1/clients/:id` - Single client details
- [x] Display all client information
- [x] Show associated tax return(s) with income sources
- [x] Current workflow stage badge
- [x] Dependents list
- [x] Audit trail / workflow events
- [x] Edit client info (modal) with audit logging
- [x] Edit tax return notes with audit logging

### 4.4 Admin Quick-Create ✅
- [x] "New Client" button opens quick-create modal
- [x] Quick-create modal with basic fields (name, email, phone, filing status, tax year)
- [x] Backend creates client + tax return + workflow event automatically
- [x] Navigates to client detail page after creation

### 4.5 Protected Routes & Auth ✅
- [x] Created ProtectedRoute component
- [x] Admin routes wrapped with ProtectedRoute
- [x] When Clerk is not configured, allows access (dev mode)
- [x] When Clerk is configured, requires sign-in
- [x] Role checking (staff = admin or employee)

### 4.6 User Management (Invite-Only) ✅
- [x] Invite-only system (no auto-create for random signups)
- [x] `GET /api/v1/admin/users` - List all users
- [x] `POST /api/v1/admin/users` - Invite user by email
- [x] `PATCH /api/v1/admin/users/:id` - Update user role
- [x] `DELETE /api/v1/admin/users/:id` - Remove user
- [x] Admin UI: Users page with invite modal
- [x] Pending vs Active status display
- [x] First user auto-created as admin

---

## Phase 5: Workflow Tracking (Week 3) ✅ COMPLETE

### 5.1 Backend API ✅
- [x] `GET /api/v1/tax_returns` - List returns with filters
- [x] `PATCH /api/v1/tax_returns/:id` - Update status
- [x] `POST /api/v1/tax_returns/:id/assign` - Assign to employee
- [x] `GET /api/v1/workflow_events` - Global audit trail with pagination/filters

### 5.2 Workflow Views ✅
- [x] **List View**: Table of all returns with filters
- [ ] **Kanban View**: Drag-and-drop columns by stage (future improvement)
- [x] Stage badges with colors
- [x] Quick status change dropdown
- [x] Employee assignment dropdown

### 5.3 Audit Trail ✅
- [x] Auto-log all status changes (who, when, old→new)
- [x] Auto-log assignments
- [x] Display timeline on client detail page
- [x] Include timestamps and user names
- [x] Global Activity page with filters

### 5.4 Admin Settings (Workflow Stages) ✅
- [x] `GET /api/v1/admin/workflow_stages` - List stages
- [x] `POST /api/v1/admin/workflow_stages` - Create stage
- [x] `PATCH /api/v1/admin/workflow_stages/:id` - Edit stage
- [x] `DELETE /api/v1/admin/workflow_stages/:id` - Soft delete (deactivate)
- [x] Admin UI for managing stages (Settings page)
- [x] Reorder stages

---

## Phase 6: Time Tracking (Week 4) ✅ COMPLETE

### 6.1 Backend API ✅
- [x] `GET /api/v1/time_entries` - List entries (with filters)
- [x] `POST /api/v1/time_entries` - Create entry
- [x] `PATCH /api/v1/time_entries/:id` - Update entry
- [x] `DELETE /api/v1/time_entries/:id` - Delete entry
- [x] `GET /api/v1/time_categories` - List categories

### 6.2 Time Entry UI ✅
- [x] Quick entry form (date, hours, category, description)
- [x] Optional: Link to client/tax return
- [x] Daily view (today's entries)
- [x] Weekly view (calendar-style)
- [x] Edit/delete existing entries

### 6.3 Admin Settings (Categories) ✅
- [x] Admin UI for managing time categories (in Settings page)
- [x] Add/edit/disable categories

### 6.4 Reports (Admin Only) ✅
- [x] Summary by employee
- [x] Summary by category
- [x] Summary by client
- [x] Date range filtering
- [ ] Export to CSV (optional - future improvement)

### 6.5 Audit Logging ✅
- [x] `audit_logs` table for polymorphic activity tracking
- [x] Auto-log time entry create/update/delete events
- [x] Display audit logs in Activity page alongside workflow events
- [x] Filter by activity type (Workflow Events vs Time Tracking)
- [x] Visibility polish: Hide employee filter/column for non-admins

---

## Phase 7: Document Upload (Week 4-5) ✅ COMPLETE

### 7.1 S3 Setup ✅
- [x] Create private S3 bucket (cornerstone-accounting-documents, ap-southeast-2)
- [x] Configure CORS for direct upload
- [x] Set up IAM credentials
- [x] Add AWS SDK to Rails (aws-sdk-s3 gem)

### 7.2 Backend API ✅
- [x] `POST /api/v1/tax_returns/:id/documents/presign` - Get upload URL
- [x] `POST /api/v1/tax_returns/:id/documents` - Register uploaded document
- [x] `GET /api/v1/documents/:id/download` - Get signed download URL
- [x] `DELETE /api/v1/documents/:id` - Delete document

### 7.3 Upload UI ✅
- [x] File picker component
- [x] Drag-and-drop zone
- [x] Upload progress indicator
- [x] Document type selector (W-2, 1099, ID, etc.)
- [x] Success/error feedback
- [x] Smooth inline refresh (no page reload)

### 7.4 Document List ✅
- [x] Display documents on tax return detail page
- [x] Download links (signed URLs)
- [x] Delete option (with confirmation)
- [x] Upload date, file size, and who uploaded

---

## Phase 8: Notifications (Week 5)

### 8.1 Email (Resend)
- [ ] Set up Resend account
- [ ] Create email templates
- [ ] `IntakeConfirmationEmail`
- [ ] `DocumentsNeededEmail`
- [ ] `ReadyToSignEmail`
- [ ] `ReadyForPickupEmail`
- [ ] Create `SendEmailJob` background job

### 8.2 SMS (ClickSend)
- [ ] Set up ClickSend account
- [ ] Create SMS service
- [ ] Create `SendSmsJob` background job
- [ ] SMS templates for key notifications

### 8.3 Notification Triggers
- [ ] Check `notify_client` flag on workflow stage change
- [ ] Send appropriate notification based on stage
- [ ] Log notification in `notifications` table
- [ ] Handle failures gracefully

---

## Phase 9: Transmittal Maker (Week 6-7)

### 9.1 FastAPI Setup
- [ ] Initialize FastAPI project in `ai-service/`
- [ ] Set up SQLAlchemy with shared database
- [ ] Create models matching Rails schema
- [ ] Configure OpenAI client
- [ ] Set up environment variables

### 9.2 Chat Interface
- [ ] `POST /api/chat` - Send message, get AI response
- [ ] Conversational transmittal creation
- [ ] Context retention within session
- [ ] Parse client data from database

### 9.3 Transmittal Generation
- [ ] Define transmittal template structure
- [ ] AI extracts/generates content from conversation
- [ ] Save transmittal to database
- [ ] Link to client/tax return

### 9.4 PDF Export
- [ ] Generate PDF from transmittal data
- [ ] Professional template design
- [ ] Download endpoint

### 9.5 Frontend Integration
- [ ] Add Transmittals section to admin dashboard
- [ ] Chat UI component
- [ ] Transmittal list/history
- [ ] View/download generated transmittals

---

## Phase 10: Polish & Deploy (Week 7-8)

### 10.1 Automated Testing ✅
- [x] Set up Playwright for E2E tests
- [x] Configure test projects (desktop, mobile, public)
- [x] Create test account in Clerk (with Bypass Client Trust)
- [x] Authentication setup test (login flow)
- [x] Public pages tests (home, about, services, contact, intake)
- [x] Admin dashboard tests (navigation, client list, tax returns)
- [ ] Set up Vitest for frontend unit tests
- [ ] Set up RSpec for backend unit tests
- [ ] Add tests to CI pipeline (GitHub Actions)

### 10.2 Manual Testing
- [ ] Test all flows end-to-end manually
- [ ] Test on real mobile devices
- [ ] Test iPad kiosk mode
- [ ] Test with multiple users/roles
- [ ] Fix any bugs found

### 10.3 Performance
- [ ] Add database indexes where needed
- [ ] Optimize slow queries
- [ ] Lazy load images
- [ ] Compress assets

### 10.4 Deployment ✅
- [x] Deploy frontend to Netlify (https://cornerstone-accounting.tax)
- [x] Deploy Rails API to Render
- [ ] Deploy FastAPI to Render (when Phase 9 ready)
- [x] Set up environment variables
- [x] Configure custom domain
- [x] Set up SSL certificates (Let's Encrypt)

### 10.5 Monitoring
- [ ] Set up error tracking (Sentry or similar)
- [ ] Set up uptime monitoring
- [ ] Create admin health check endpoint

---

## Future Phases (Post-Launch)

### Client Portal
- [ ] Client login (Clerk)
- [ ] View own return status
- [ ] Upload documents
- [ ] Message staff

### AI Chatbot
- [ ] RAG knowledge base setup
- [ ] Chat widget on public site
- [ ] FAQ automation
- [ ] Business hours/services queries

### Enhancements
- [ ] Dashboard analytics/reports
- [ ] Bulk operations
- [ ] Email templates customization
- [ ] Mobile app (React Native)

---

## Timeline Summary

| Phase | Focus | Duration |
|-------|-------|----------|
| 1 | Foundation (setup, auth, schema) | Week 1 |
| 2 | Public Website | Week 1-2 |
| 3 | Client Intake Form | Week 2 |
| 4 | Admin Dashboard Core | Week 2-3 |
| 5 | Workflow Tracking | Week 3 |
| 6 | Time Tracking | Week 4 |
| 7 | Document Upload | Week 4-5 |
| 8 | Notifications | Week 5 |
| 9 | Transmittal Maker | Week 6-7 |
| 10 | Polish & Deploy | Week 7-8 |

**Total estimated time: 6-8 weeks** for full feature set

---

## Getting Started

To begin, we'll start with **Phase 1.1: Project Setup**:

1. Create the folder structure
2. Initialize Rails API
3. Initialize React frontend
4. Set up database connection

Ready to start? Let's go! 🚀
