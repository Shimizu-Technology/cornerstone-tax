# Testing Guide

A comprehensive guide for setting up AI-assisted testing (Agent Browser) and automated E2E testing (Playwright) in React + Rails projects.

---

## Table of Contents
1. [Testing Philosophy](#1-testing-philosophy)
2. [The Testing Stack](#2-the-testing-stack)
3. [Agent Browser Setup](#3-agent-browser-setup)
4. [Playwright Setup](#4-playwright-setup)
5. [Test Account & Authentication](#5-test-account--authentication)
6. [Writing E2E Tests](#6-writing-e2e-tests)
7. [Running Tests](#7-running-tests)
8. [AI-Assisted Testing Workflow](#8-ai-assisted-testing-workflow)
9. [Integration with Planning](#9-integration-with-planning)
10. [Common Patterns](#10-common-patterns)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Testing Philosophy

### Right-Sized Testing

Don't aim for 100% coverage. Focus on:

| Priority | What to Test | Why |
|----------|-------------|-----|
| **P0** | Critical user flows | Broken = business impact |
| **P1** | Authentication/authorization | Security critical |
| **P2** | Complex forms/wizards | Easy to break |
| **P3** | Edge cases that have broken before | Prevent regressions |

### The Testing Pyramid (Modified)

```
        ┌─────────────────┐
        │   Manual QA     │  ← You + stakeholders
        ├─────────────────┤
        │  AI Verification │  ← Agent Browser (quick checks)
        ├─────────────────┤
        │    E2E Tests     │  ← Playwright (critical flows)
        ├─────────────────┤
        │   Unit Tests     │  ← Vitest/RSpec (logic-heavy code)
        └─────────────────┘
```

### When to Use Each

| Layer | When | Examples |
|-------|------|----------|
| **Unit Tests** | Pure logic, utilities, calculations | `formatDate()`, model validations |
| **E2E Tests** | Critical user flows, regressions | Login, form submission, checkout |
| **AI Verification** | After making changes, quick sanity check | "Does this page still render?" |
| **Manual QA** | UX review, edge cases, final approval | Before major releases |

---

## 2. The Testing Stack

### Overview

```
┌─────────────────────────────────────────────────────────────┐
│                    Your Application                          │
│     Frontend (React)              Backend (Rails)            │
└──────────────────────┬──────────────────────────────────────┘
                       │
        ┌──────────────┴──────────────┐
        │                             │
        ▼                             ▼
┌───────────────────┐    ┌────────────────────────┐
│   Agent Browser   │    │      Playwright        │
│  (AI Verification)│    │   (Automated E2E)      │
│                   │    │                        │
│  • Quick checks   │    │  • Regression tests    │
│  • Visual verify  │    │  • CI/CD integration   │
│  • Interactive    │    │  • Auth handling       │
└───────────────────┘    └────────────────────────┘
```

### Technology Choices

| Tool | Purpose | Why This One |
|------|---------|--------------|
| **Agent Browser** | AI-assisted browser testing | Designed for AI agents, ref system |
| **Playwright** | E2E test framework | Modern, fast, great auth support |
| **Vitest** | Frontend unit tests | Fast, Vite-native, good DX |
| **RSpec** | Backend unit tests | Ruby standard, expressive |

---

## 3. Agent Browser Setup

[Agent Browser](https://github.com/vercel-labs/agent-browser) is a CLI tool that lets AI agents control a browser.

### Installation

```bash
# Install globally
npm install -g agent-browser

# Or install in project
npm install agent-browser --save-dev
```

### Verify Installation

```bash
agent-browser --version
agent-browser --help
```

### Basic Usage

```bash
# Open a page
agent-browser open http://localhost:5173

# Get page snapshot (AI-readable structure)
agent-browser snapshot -i

# Get snapshot as JSON (for AI parsing)
agent-browser snapshot -i --json

# Click an element (using ref from snapshot)
agent-browser click @e1

# Fill a text field
agent-browser fill @e3 "test@example.com"

# Take a screenshot
agent-browser screenshot

# Get text content
agent-browser get text @e1
```

### The Ref System

Agent Browser uses refs (`@e1`, `@e2`, etc.) to identify elements:

```bash
# 1. Get snapshot with refs
agent-browser snapshot -i
# Output:
# - heading "Welcome" [ref=e1]
# - textbox "Email" [ref=e2]
# - button "Submit" [ref=e3]

# 2. Use refs to interact
agent-browser fill @e2 "test@example.com"
agent-browser click @e3
```

**Why refs are better than CSS selectors:**
- Deterministic (exact element from snapshot)
- No DOM re-query needed
- AI-friendly (snapshot → ref → action)

### Headed Mode (Visual Debugging)

```bash
# Show the browser window
agent-browser open http://localhost:5173 --headed
```

### Authentication with Headers

```bash
# Pass auth headers (scoped to origin)
agent-browser open http://localhost:5173 --headers '{"Authorization": "Bearer <token>"}'
```

### Cursor Integration

Add to your `.cursor/rules/project.mdc`:

```markdown
## AI Testing with Agent Browser

After making frontend changes, verify with:
1. `agent-browser open http://localhost:5173` - Navigate
2. `agent-browser snapshot -i` - Get interactive elements
3. Test the specific change using refs
4. `agent-browser screenshot` - Capture result if needed
```

---

## 4. Playwright Setup

### Installation

```bash
cd frontend
npm init playwright@latest
```

When prompted:
- TypeScript: Yes
- Tests folder: `e2e`
- GitHub Actions: Yes (optional)
- Install browsers: Yes

### Project Structure

```
frontend/
├── e2e/
│   ├── auth.setup.ts       # Login and save session
│   ├── intake-form.spec.ts # Intake form tests
│   ├── login.spec.ts       # Auth tests
│   └── ...
├── playwright.config.ts    # Playwright config
└── playwright/
    └── .auth/              # Saved auth state (gitignored)
```

### Configuration

```typescript
// frontend/playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  
  use: {
    baseURL: 'http://localhost:5173',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },

  projects: [
    // Setup project - runs first, saves auth state
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    
    // Main tests - use saved auth state
    {
      name: 'chromium',
      use: { 
        ...devices['Desktop Chrome'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
    
    // Mobile tests
    {
      name: 'mobile',
      use: { 
        ...devices['iPhone 13'],
        storageState: 'playwright/.auth/user.json',
      },
      dependencies: ['setup'],
    },
  ],

  // Start dev server before tests
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:5173',
    reuseExistingServer: !process.env.CI,
  },
});
```

### Add to .gitignore

```gitignore
# Playwright
/test-results/
/playwright-report/
/blob-report/
/playwright/.cache/
/playwright/.auth/
```

### NPM Scripts

```json
// package.json
{
  "scripts": {
    "test": "playwright test",
    "test:ui": "playwright test --ui",
    "test:headed": "playwright test --headed",
    "test:debug": "playwright test --debug"
  }
}
```

---

## 5. Test Account & Authentication

### Strategy Overview

1. **Create a test user** in your auth system (Clerk)
2. **Sign in once** to create their database record
3. **Assign the correct role** in your database
4. **Store credentials** in your `.env` file
5. **Playwright uses saved session** (no login per test)

### Step 1: Create Test User

**If using an invite-only system (recommended):**
1. First, invite the user through **your app's admin dashboard** (e.g., `/admin/users`)
2. Set their role to **Admin** during invitation
3. Then go to **Clerk Dashboard → Users → + Create user**
4. Use the **same email** you invited
5. Set a password (you'll need this for tests)

**If NOT using invite-only:**
1. Go to Clerk Dashboard → Users
2. Click **"+ Create user"**
3. Fill in:
   - **Email**: `test-admin@yourcompany.com` (can be fake for dev)
   - **Password**: Strong password (you'll need this later)
   - **First Name**: `Test`
   - **Last Name**: `Admin`
4. Click **Create**

### Step 2: Enable "Bypass Client Trust" (Critical!)

By default, Clerk's "Client Trust" feature requires email verification when signing in from a new device. **This will block automated tests.** To disable it for test users:

1. In Clerk Dashboard → Users → Click on your test user
2. Go to the **Settings** tab (next to Profile)
3. Find **"Bypass Client Trust"** and toggle it **ON**
4. This allows the test user to sign in without device verification

> **Why is this needed?** Clerk's Client Trust sends a verification code to the user's email whenever they sign in from a new device/browser. Since test environments are always "new devices," this blocks automated login. Bypassing it for specific test users solves this without reducing security for real users.

### Step 3: Store Credentials in .env

Add the test credentials to your existing `frontend/.env` file (already gitignored):

```bash
# frontend/.env

# ... your existing app config ...
VITE_API_URL=http://localhost:3000
VITE_CLERK_PUBLISHABLE_KEY=pk_test_...

# Test credentials (add these)
TEST_USER_EMAIL=test-admin@yourcompany.com
TEST_USER_PASSWORD=your-password-from-step-1
```

**Note:** You can also use a separate `.env.test` file if you prefer (requires adding `dotenv` to Playwright config).

### Step 4: Sign In Once to Create Database Record

1. Start your local servers:
   ```bash
   # Terminal 1
   cd backend && rails server
   
   # Terminal 2  
   cd frontend && npm run dev
   ```

2. Go to `http://localhost:5173` and sign in with the test user
3. This creates their record in your database

### Step 5: Assign Admin Role

**If using an invite-only system:** Skip this step! When you invited the user through your admin dashboard (Step 1), you already assigned their role. The user record already exists with the correct role, and signing in just links their Clerk ID.

**If NOT using invite-only (auto-create users on sign-in):** Manually assign the role:

```bash
cd backend
rails runner "
  user = User.find_by(email: 'test-admin@yourcompany.com')
  if user
    user.update(role: 'admin')
    puts '✅ User updated to admin!'
  else
    puts '❌ User not found - make sure they signed in first'
  end
"
```

### Step 6: Verify Setup

Your test account is ready when:
- [ ] User exists in Clerk dashboard
- [ ] "Bypass Client Trust" is enabled for the user
- [ ] Credentials are in `frontend/.env`
- [ ] User has signed in at least once
- [ ] User has admin role in database

### Multiple Test Users (Optional)

Start with one admin user. Add more later if needed:

| User | Role | Purpose |
|------|------|---------|
| `test-admin@...` | Admin | Full access testing |
| `test-employee@...` | Employee | Role restriction testing |
| `test-client@...` | Client | Client portal testing |

### Auth Setup Test (Playwright)

```typescript
// frontend/e2e/auth.setup.ts
import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

setup('authenticate', async ({ page }) => {
  // Navigate to login
  await page.goto('/');
  
  // Click sign in (adjust for your Clerk setup)
  await page.click('text=Sign In');
  
  // Wait for Clerk modal/page
  await page.waitForSelector('input[name="identifier"]');
  
  // Fill credentials
  await page.fill('input[name="identifier"]', process.env.TEST_USER_EMAIL!);
  await page.click('button:has-text("Continue")');
  
  // Wait for password field
  await page.waitForSelector('input[type="password"]');
  await page.fill('input[type="password"]', process.env.TEST_USER_PASSWORD!);
  await page.click('button:has-text("Continue")');
  
  // Wait for redirect to dashboard (authenticated state)
  await page.waitForURL('**/admin**');
  
  // Verify we're logged in
  await expect(page.locator('text=Dashboard')).toBeVisible();
  
  // Save auth state
  await page.context().storageState({ path: authFile });
});
```

### Use Auth in Tests

```typescript
// frontend/e2e/dashboard.spec.ts
import { test, expect } from '@playwright/test';

// This test uses the saved auth state automatically (via config)
test('dashboard shows client list', async ({ page }) => {
  await page.goto('/admin');
  
  // Already logged in!
  await expect(page.locator('h1')).toContainText('Dashboard');
});
```

### Alternative: Backend Test Token

For API testing or simpler auth, create a test endpoint:

```ruby
# backend/config/routes.rb (development only!)
if Rails.env.development? || Rails.env.test?
  post '/api/v1/auth/test_login', to: 'auth#test_login'
end
```

```ruby
# backend/app/controllers/api/v1/auth_controller.rb
def test_login
  return head :not_found unless Rails.env.development? || Rails.env.test?
  
  user = User.find_by(email: params[:email])
  if user
    # Generate a test token (your token generation logic)
    token = generate_test_token(user)
    render json: { token: token }
  else
    render json: { error: 'User not found' }, status: :not_found
  end
end
```

---

## 6. Writing E2E Tests

### Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Feature Name', () => {
  test.beforeEach(async ({ page }) => {
    // Setup before each test
    await page.goto('/starting-page');
  });

  test('should do something specific', async ({ page }) => {
    // Arrange - setup state
    
    // Act - perform actions
    await page.click('button:has-text("Submit")');
    
    // Assert - verify results
    await expect(page.locator('.success-message')).toBeVisible();
  });
});
```

### Example: Intake Form Test

```typescript
// frontend/e2e/intake-form.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Client Intake Form', () => {
  test('completes full intake submission', async ({ page }) => {
    // Navigate to intake form
    await page.goto('/intake');
    
    // Step 1: Client Information
    await page.fill('[name="firstName"]', 'John');
    await page.fill('[name="lastName"]', 'Doe');
    await page.fill('[name="email"]', 'john.doe@example.com');
    await page.fill('[name="phone"]', '671-555-1234');
    await page.click('button:has-text("Next")');
    
    // Step 2: Tax Filing Info
    await page.selectOption('[name="taxYear"]', '2025');
    await page.click('label:has-text("Single")');
    await page.click('button:has-text("Next")');
    
    // ... continue through steps ...
    
    // Final step: Authorization
    await page.check('[name="confirmAccuracy"]');
    await page.fill('[name="signature"]', 'John Doe');
    await page.click('button:has-text("Submit")');
    
    // Verify success
    await expect(page).toHaveURL(/\/intake\/success/);
    await expect(page.locator('text=Thank you')).toBeVisible();
  });

  test('shows validation errors for required fields', async ({ page }) => {
    await page.goto('/intake');
    
    // Try to proceed without filling required fields
    await page.click('button:has-text("Next")');
    
    // Verify errors shown
    await expect(page.locator('text=First name is required')).toBeVisible();
    await expect(page.locator('text=Last name is required')).toBeVisible();
  });

  test('kiosk mode hides navigation', async ({ page }) => {
    await page.goto('/intake?mode=kiosk');
    
    // Navigation should not be visible
    await expect(page.locator('nav')).not.toBeVisible();
    
    // Form should still work
    await expect(page.locator('text=Client Information')).toBeVisible();
  });
});
```

### Example: Admin Dashboard Test

```typescript
// frontend/e2e/admin-dashboard.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Admin Dashboard', () => {
  test('displays client list', async ({ page }) => {
    await page.goto('/admin/clients');
    
    // Should see clients table
    await expect(page.locator('table')).toBeVisible();
    
    // Search should work
    await page.fill('[placeholder*="Search"]', 'John');
    await page.keyboard.press('Enter');
    
    // Results should filter
    await expect(page.locator('table tbody tr')).toHaveCount(1);
  });

  test('can change tax return status', async ({ page }) => {
    await page.goto('/admin/returns');
    
    // Click on first return
    await page.click('table tbody tr:first-child');
    
    // Change status
    await page.selectOption('[name="status"]', 'in_preparation');
    
    // Verify change saved
    await expect(page.locator('text=Status updated')).toBeVisible();
  });
});
```

### Mobile Testing

```typescript
// frontend/e2e/mobile.spec.ts
import { test, expect, devices } from '@playwright/test';

test.use(devices['iPhone 13']);

test('mobile navigation works', async ({ page }) => {
  await page.goto('/');
  
  // Hamburger menu should be visible on mobile
  await expect(page.locator('[aria-label="Menu"]')).toBeVisible();
  
  // Click menu
  await page.click('[aria-label="Menu"]');
  
  // Navigation links should appear
  await expect(page.locator('text=About')).toBeVisible();
});
```

---

## 7. Running Tests

### Playwright Commands

```bash
# Run all tests
npm test

# Run with UI (visual test runner)
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed

# Run specific test file
npx playwright test intake-form.spec.ts

# Run tests matching name
npx playwright test -g "intake"

# Debug mode (step through)
npm run test:debug

# Update snapshots
npx playwright test --update-snapshots

# Generate HTML report
npx playwright show-report
```

### Agent Browser Commands

```bash
# Start your dev server first
npm run dev

# Then in another terminal:
agent-browser open http://localhost:5173
agent-browser snapshot -i
agent-browser click @e1
```

### CI Integration (GitHub Actions)

```yaml
# .github/workflows/test.yml
name: Tests

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          
      - name: Install dependencies
        run: |
          cd frontend
          npm ci
          
      - name: Install Playwright browsers
        run: |
          cd frontend
          npx playwright install --with-deps
          
      - name: Start backend
        run: |
          cd backend
          bundle install
          rails db:setup
          rails server &
        env:
          RAILS_ENV: test
          
      - name: Run Playwright tests
        run: |
          cd frontend
          npm test
        env:
          TEST_USER_EMAIL: ${{ secrets.TEST_USER_EMAIL }}
          TEST_USER_PASSWORD: ${{ secrets.TEST_USER_PASSWORD }}
          
      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: failure()
        with:
          name: playwright-report
          path: frontend/playwright-report/
```

---

## 8. AI-Assisted Testing Workflow

### After Making a Change

When the AI makes a code change, it should verify it works:

```markdown
## AI Testing Checklist

After modifying frontend code:
1. Ensure dev server is running (`npm run dev`)
2. Navigate to the affected page
3. Verify the change works:
   - `agent-browser open http://localhost:5173/affected-page`
   - `agent-browser snapshot -i` - check structure
   - Interact with changed elements
   - `agent-browser screenshot` if visual verification needed
4. Report findings to user
```

### Example AI Verification Session

```bash
# AI modifies the intake form, then verifies:

$ agent-browser open http://localhost:5173/intake
# ✓ Navigated to intake form

$ agent-browser snapshot -i
# - heading "Client Information" [ref=e1]
# - textbox "First Name" [ref=e2]
# - textbox "Last Name" [ref=e3]
# - button "Next" [ref=e4]

$ agent-browser fill @e2 "Test"
# ✓ Filled "Test" into First Name

$ agent-browser fill @e3 "User"
# ✓ Filled "User" into Last Name

$ agent-browser click @e4
# ✓ Clicked Next button

$ agent-browser snapshot -i
# - heading "Tax Filing Information" [ref=e1]
# ✓ Form advanced to step 2 - change verified!
```

### Cursor Rules for AI Testing

Add to `.cursor/rules/project.mdc`:

```markdown
## Testing After Changes

When modifying frontend code:
1. If dev server is running, use agent-browser to verify
2. Navigate to affected page
3. Test the specific change
4. Report what was tested and results

When modifying backend code:
1. Use `rails runner` or curl to test endpoint
2. Verify response matches expectations

Before marking a task complete:
1. Verify the change works (browser or API test)
2. Note what was tested in your response
```

---

## 9. Integration with Planning

### PRD Testing Section

Add to your PRD template:

```markdown
## Testing Requirements

### Critical User Flows (E2E Coverage)

| Flow | Priority | Test File |
|------|----------|-----------|
| Client intake form (complete) | P0 | `intake-form.spec.ts` |
| Admin login → dashboard | P0 | `auth.spec.ts` |
| Status change workflow | P1 | `workflow.spec.ts` |
| Document upload | P1 | `documents.spec.ts` |

### Test Accounts

| Email | Role | Purpose |
|-------|------|---------|
| test-admin@example.com | Admin | Full access testing |
| test-employee@example.com | Employee | Role-based testing |
| test-client@example.com | Client | Portal testing |

### Test Data Requirements

- [ ] Seed 5 test clients with varied data
- [ ] Seed sample documents for upload tests
- [ ] Seed all workflow stages
```

### BUILD_PLAN Testing Tasks

Add testing tasks to each phase:

```markdown
## Phase 3: Intake Form

### 3.1 Build
- [ ] Create form wizard
- [ ] Implement validation
- [ ] Add kiosk mode

### 3.2 Testing
- [ ] E2E: Complete form submission
- [ ] E2E: Validation error display
- [ ] E2E: Kiosk mode functionality
- [ ] AI: Mobile layout verification
- [ ] AI: Touch target sizes (44px+)
```

### Test Checklist Template

```markdown
## Pre-Deploy Test Checklist

### E2E Tests (Automated)
- [ ] `npm test` passes
- [ ] All critical flows green

### AI Verification
- [ ] Intake form works on mobile
- [ ] Admin dashboard loads
- [ ] Login/logout works

### Manual QA
- [ ] Stakeholder review
- [ ] Edge cases tested
- [ ] Performance acceptable
```

---

## 10. Common Patterns

### Wait for Network Idle

```typescript
// Wait for all network requests to complete
await page.waitForLoadState('networkidle');
```

### Wait for API Response

```typescript
// Wait for specific API call
const responsePromise = page.waitForResponse('**/api/v1/clients');
await page.click('button:has-text("Load Clients")');
await responsePromise;
```

### Handle Modals

```typescript
// Wait for modal to appear
await page.click('button:has-text("Open Modal")');
await page.waitForSelector('[role="dialog"]');

// Interact with modal content
await page.fill('[role="dialog"] input', 'value');
await page.click('[role="dialog"] button:has-text("Save")');

// Wait for modal to close
await expect(page.locator('[role="dialog"]')).not.toBeVisible();
```

### Handle Toasts/Notifications

```typescript
// Wait for success toast
await expect(page.locator('.toast-success')).toBeVisible();
await expect(page.locator('.toast-success')).toContainText('Saved');
```

### File Upload

```typescript
// Upload a file
await page.setInputFiles('input[type="file"]', 'path/to/test-file.pdf');

// Verify upload succeeded
await expect(page.locator('text=test-file.pdf')).toBeVisible();
```

### Drag and Drop (Kanban)

```typescript
// Drag card to new column
const card = page.locator('.kanban-card:has-text("John Doe")');
const targetColumn = page.locator('.kanban-column:has-text("In Review")');
await card.dragTo(targetColumn);
```

---

## 11. Troubleshooting

### Tests Flaky/Failing Intermittently

**Cause:** Race conditions, timing issues

**Fix:**
```typescript
// Bad - might click before element ready
await page.click('button');

// Good - wait for element
await page.waitForSelector('button:has-text("Submit")');
await page.click('button:has-text("Submit")');

// Better - use locator with auto-wait
await page.locator('button:has-text("Submit")').click();
```

### Auth State Not Persisting

**Cause:** Storage state not saved correctly

**Fix:**
1. Check `playwright/.auth/` exists
2. Verify setup test runs first (`dependencies: ['setup']`)
3. Check `.gitignore` isn't blocking auth folder creation

### Slow Tests

**Cause:** Network waiting, too many retries

**Fix:**
```typescript
// Increase timeout for slow operations
test('slow operation', async ({ page }) => {
  test.setTimeout(60000); // 60 seconds
  
  // Or for specific action
  await page.click('button', { timeout: 10000 });
});
```

### Can't Find Elements

**Cause:** Element not visible, wrong selector

**Fix:**
```bash
# Debug with Playwright inspector
npx playwright test --debug

# Or use codegen to record selectors
npx playwright codegen http://localhost:5173
```

### Agent Browser Connection Issues

**Cause:** Daemon not running or port conflict

**Fix:**
```bash
# Kill existing daemon
agent-browser kill

# Start fresh
agent-browser open http://localhost:5173
```

---

## Quick Reference

### Agent Browser Commands

```bash
agent-browser open <url>           # Navigate
agent-browser snapshot -i          # Get elements with refs
agent-browser snapshot -i --json   # JSON output for AI
agent-browser click @e1            # Click element
agent-browser fill @e1 "text"      # Type text
agent-browser screenshot           # Capture screen
agent-browser --headed open <url>  # Show browser window
```

### Playwright Commands

```bash
npm test                    # Run all tests
npm run test:ui            # Visual test runner
npm run test:headed        # See browser
npx playwright codegen     # Record test
npx playwright show-report # View results
```

### Checklist

```
Setup:
□ agent-browser installed globally
□ Playwright installed in frontend
□ Test account created in Clerk
□ "Bypass Client Trust" enabled for test user
□ .env with test credentials (gitignored)
□ Auth setup test written
□ playwright.config.ts configured

Per Feature:
□ E2E test for happy path
□ E2E test for validation/errors
□ AI verification after changes
□ Mobile test if applicable
```

---

*Last updated: January 2026*
