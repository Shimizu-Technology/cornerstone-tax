# Future Improvements

A collection of potential enhancements and features to consider for future development.

---

## Security Enhancements

### ✅ Active Record Encryption for Bank Data
**Status:** Implemented

Bank routing and account numbers are encrypted at rest using Rails Active Record Encryption.

**Setup:** Add these to your `.env`:
```bash
ACTIVE_RECORD_ENCRYPTION_PRIMARY_KEY=<your_key>
ACTIVE_RECORD_ENCRYPTION_DETERMINISTIC_KEY=<your_key>
ACTIVE_RECORD_ENCRYPTION_KEY_DERIVATION_SALT=<your_salt>
```

Generate new keys with: `bin/rails db:encryption:init`

---

## Clerk Authentication Enhancements

### Clerk Secret Key Integration
**Priority:** Low | **Effort:** Medium

Adding `CLERK_SECRET_KEY` would enable:

- **Webhooks**: Sync user profile changes from Clerk to our database automatically
- **Session Revocation**: Admin ability to force logout users
- **Backend User Management**: Create/update users via Clerk API
- **Webhook Signature Verification**: Ensure webhooks are legitimate

**When to add:** When we need real-time user sync or admin session management.

### JWT Templates
**Priority:** Low | **Effort:** Low

Custom JWT templates in Clerk can add additional claims to tokens (e.g., user roles, permissions). Currently using default claims which work fine.

---

## Returning Client Handling (Discuss with Cornerstone)

### The Question
When a client fills out an intake form this year and comes back next year, how do we link their new tax return to their existing profile?

### Current Behavior
Each intake form creates:
- A **Client** record (the person's profile)
- A **Tax Return** for the specified year
- **Dependents** linked to the client
- **Income Sources** linked to the tax return

### Options to Discuss

| Option | How it works | Pros | Cons |
|--------|--------------|------|------|
| **A: Auto-match by email** | New intake checks if email exists → links to existing client | Seamless, automatic | Different email = duplicate |
| **B: Admin manual linking** | Each intake creates new record; admin merges if needed | Human judgment, handles edge cases | Extra work for admins |
| **C: Intake-only (no persistent clients)** | Each intake is standalone, no linking | Simplest, no matching needed | No client history across years |

### Recommended: Option A with Manual Override

1. **Auto-match by email**: If same email exists, link new Tax Return to existing Client
2. **Flag for review**: Show "Returning Client?" badge so admin can verify
3. **Manual merge (future)**: If duplicates slip through, admin can merge them later

### Questions for Cornerstone
- Do you need to see a client's history across multiple tax years?
- How often do clients use different emails when returning?
- Would you prefer automatic matching or manual control?
- Do you currently track returning clients in any way?

### Implementation Notes
- Email matching is case-insensitive
- Could extend to match by phone number or name+DOB as fallback
- Merge feature would combine two Client records into one

---

## Client Portal (Phase 7)

### Features to Consider
- Client login with status tracking
- Document upload interface
- Secure messaging with Cornerstone staff
- E-signature for tax documents
- Tax return history view

### Technical Considerations
- Add `client` role to User model (already exists)
- Link User to Client record
- Create separate client-facing routes
- Mobile-optimized interface for document photos

---

## AI Customer Service Chatbot (Phase 8)

### Potential Capabilities
- Answer FAQs about services
- Help with intake form questions
- Provide status updates (with auth)
- Schedule appointments
- Collect basic info before human handoff

### Technical Stack Options
- OpenAI API with custom prompts
- LangChain for complex workflows
- Embed on public website pages

---

## Notifications & Communication

### ⚠️ Resend Domain Verification (Required for Production)
**Status:** Pending - needed before deployment

Currently using Resend's test mode which only allows sending to the account owner's email. To send emails to clients and invited users:

1. Go to [resend.com/domains](https://resend.com/domains)
2. Add your domain (e.g., `cornerstoneguam.com`)
3. Add the DNS records Resend provides
4. Update `MAILER_FROM_EMAIL` to use verified domain (e.g., `noreply@cornerstoneguam.com`)

**Affected features:**
- User invitation emails
- Client status notifications (Phase 8)
- Any automated emails

### Email Templates
- Custom branded email templates via Resend
- Tax return status update emails
- Appointment reminders
- Document request notifications

### SMS Enhancements
- Two-way SMS conversation
- Appointment confirmations
- Urgent document requests

---

## Reporting & Analytics

### Admin Dashboard Enhancements
- Revenue tracking
- Time tracking analytics
- Employee productivity reports
- Client acquisition metrics
- Tax season workload forecasting

### Export Features
- CSV/Excel exports
- PDF report generation
- Integration with accounting software

---

## Document Management

### 📋 Core Document Upload (Phase 7 or Earlier)
**Status:** Planned | **Priority:** High

Currently, the Documents section on Tax Return Detail shows "No documents uploaded yet" with no upload capability. Need to implement:

**Backend:**
- AWS S3 bucket configuration (private bucket)
- `DocumentsController` with:
  - `POST /api/v1/tax_returns/:id/documents` - Upload (pre-signed URL)
  - `GET /api/v1/tax_returns/:id/documents/:id/download` - Download (pre-signed URL)
  - `DELETE /api/v1/tax_returns/:id/documents/:id` - Delete
- Document types: W-2, 1099, ID, prior return, signature, other

**Frontend:**
- File upload component with drag-and-drop
- Progress indicator for uploads
- Document type selection
- View/Download/Delete actions on each document

**Environment Variables Needed:**
```bash
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_REGION=us-east-1
AWS_S3_BUCKET=cornerstone-documents
```

### S3 Enhancements (Future)
- Automatic document categorization
- OCR for uploaded documents
- Document expiration/retention policies
- Bulk download capabilities

### E-Signature Integration (Future)
- DocuSign or similar integration
- In-app signature capture
- Audit trail for signed documents

---

## Performance & Scalability

### Caching
- Redis for session storage
- API response caching
- Background job processing with Sidekiq

### Database
- Read replicas for reporting
- Connection pooling optimization
- Query performance monitoring

---

## UI/Design Improvements (Client Feedback)

### Hero Section Logo
**Priority:** TBD | **Effort:** Low

Client requested: Make the logo larger/more prominent in the hero section (top area with "Your Trusted Partner in Financial Success").

**Options to clarify with client:**
- Add logo above the headline text?
- Replace headline with large logo?
- Logo as background watermark?

### Floating Contact Bar
**Priority:** TBD | **Effort:** Low-Medium

Client requested: Add a floating element at the bottom of the page with phone number and contact info.

**Options to consider:**
- Sticky footer bar (always visible)
- Floating action button (FAB) with phone icon
- Slide-up contact panel
- Mobile vs desktop behavior

**Needs clarification:**
- What info to show? (phone, email, address?)
- Should it be dismissible?
- Show on all pages or just certain ones?

---

## Mobile App (Future Phase)

### React Native App
- Push notifications
- Document camera with auto-crop
- Biometric authentication
- Offline mode for intake forms

---

*Last Updated: January 2026*
