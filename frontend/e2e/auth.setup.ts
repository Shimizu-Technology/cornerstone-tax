import { test as setup, expect } from '@playwright/test';

const authFile = 'playwright/.auth/user.json';

/**
 * Authentication Setup
 * 
 * This test runs FIRST and saves the authenticated session.
 * All other tests reuse this session (no login per test).
 * 
 * Prerequisites:
 * 1. Create a test user in Clerk dashboard
 * 2. Add credentials to .env.test (gitignored):
 *    TEST_USER_EMAIL=test-admin@yourcompany.com
 *    TEST_USER_PASSWORD=your-secure-password
 * 3. Make sure the test user has the correct role in your app
 */

setup('authenticate', async ({ page }) => {
  const email = process.env.TEST_USER_EMAIL;
  const password = process.env.TEST_USER_PASSWORD;
  
  // Skip auth if no credentials provided
  if (!email || !password) {
    console.log('⚠️ No test credentials found. Skipping auth setup.');
    console.log('   Set TEST_USER_EMAIL and TEST_USER_PASSWORD in .env.test');
    
    // Save empty auth state so other tests can still run (for public pages)
    await page.context().storageState({ path: authFile });
    return;
  }

  console.log(`🔐 Authenticating as ${email}...`);

  // Navigate to the app
  await page.goto('/');
  
  // Look for sign in button (adjust selector for your app)
  // Common patterns for Clerk:
  const signInButton = page.locator('button:has-text("Sign In"), a:has-text("Sign In"), [data-testid="sign-in-button"]').first();
  
  if (await signInButton.isVisible()) {
    await signInButton.click();
  } else {
    // Maybe already on a page that requires auth
    await page.goto('/admin');
  }
  
  // Wait for Clerk sign-in form
  // Clerk uses an iframe or modal - adjust based on your setup
  await page.waitForSelector('input[name="identifier"], input[type="email"]', { timeout: 10000 });
  
  // Fill email
  await page.fill('input[name="identifier"], input[type="email"]', email);
  
  // Click continue (Clerk's two-step flow)
  const continueButton = page.locator('button:has-text("Continue")').first();
  if (await continueButton.isVisible()) {
    await continueButton.click();
  }
  
  // Wait for password field
  await page.waitForSelector('input[type="password"]', { timeout: 5000 });
  await page.fill('input[type="password"]', password);
  
  // Click sign in
  const signInSubmit = page.locator('button:has-text("Continue"), button:has-text("Sign in")').first();
  await signInSubmit.click();
  
  // Wait for redirect to authenticated area
  await page.waitForURL('**/admin**', { timeout: 15000 });
  
  // Verify we're logged in
  await expect(page.locator('text=Dashboard, h1:has-text("Dashboard")').first()).toBeVisible({ timeout: 10000 });
  
  console.log('✅ Authentication successful!');
  
  // Save auth state for other tests
  await page.context().storageState({ path: authFile });
});
