import { test, expect, type Page } from '@playwright/test';

async function mockContactSubmission(
  page: Page,
  options: { delayMs?: number; inspect?: (payload: Record<string, string>) => void } = {},
) {
  await page.route('**/api/v1/contact', async (route) => {
    const payload = route.request().postDataJSON() as Record<string, string>;
    options.inspect?.(payload);
    if (options.delayMs) {
      await new Promise((resolve) => setTimeout(resolve, options.delayMs));
    }
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, message: 'Message sent' }),
    });
  });
}

/**
 * Contact Form Tests
 * 
 * Tests the contact form submission and validation.
 * These tests run WITHOUT authentication (public access).
 */

test.describe('Contact Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/contact');
    await expect(page.locator('h1:has-text("Contact")')).toBeVisible();
  });

  test('contact form loads with all required fields', async ({ page }) => {
    // Check all form fields are present
    await expect(page.locator('input[name="name"], input#name')).toBeVisible();
    await expect(page.locator('input[name="email"], input#email')).toBeVisible();
    await expect(page.locator('select[name="subject"], select#subject')).toBeVisible();
    await expect(page.locator('textarea[name="message"], textarea#message')).toBeVisible();
    
    // Check submit button
    await expect(page.locator('button[type="submit"]')).toBeVisible();
  });

  test('displays contact information', async ({ page }) => {
    // Check office location heading is displayed
    await expect(page.locator('h3:has-text("Office Location")')).toBeVisible();
    
    // Check phone section heading is displayed
    await expect(page.locator('h3:has-text("Phone")')).toBeVisible();
    
    // Check phone numbers are displayed as links
    await expect(page.locator('a[href^="tel:"]').first()).toBeVisible();
    
    // Check email is displayed
    await expect(page.locator('a[href^="mailto:"]')).toBeVisible();
    
    // Check business hours section exists
    await expect(page.locator('h3:has-text("Business Hours")')).toBeVisible();
  });

  test('validates required fields before submission', async ({ page }) => {
    // Try to submit empty form
    await page.click('button[type="submit"]');
    
    // Check for browser's native validation or custom error messages
    // The form should not submit and show validation
    const nameInput = page.locator('input[name="name"], input#name');
    
    // Check if field is marked as invalid or error message shows
    const isInvalid = await nameInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });

  test('validates email format', async ({ page }) => {
    await page.fill('input[name="name"], input#name', 'Test User');
    await page.fill('input[name="email"], input#email', 'invalid-email');
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', 'Test message');
    
    await page.click('button[type="submit"]');
    
    // Should show email validation error
    const emailInput = page.locator('input[name="email"], input#email');
    const isInvalid = await emailInput.evaluate((el: HTMLInputElement) => !el.checkValidity());
    expect(isInvalid).toBeTruthy();
  });

  test('can fill and submit contact form successfully', async ({ page }) => {
    await mockContactSubmission(page);

    // Fill all required fields
    await page.fill('input[name="name"], input#name', 'Test User');
    await page.fill('input[name="email"], input#email', `test-${Date.now()}@example.com`);
    
    // Phone is optional but let's fill it
    const phoneInput = page.locator('input[name="phone"], input#phone');
    if (await phoneInput.isVisible()) {
      await phoneInput.fill('671-555-1234');
    }
    
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', 'This is a test message from automated e2e tests.');
    
    // Submit the form
    await page.click('button[type="submit"]');
    
    // Wait for success message
    const successMessage = page.locator('text=/sent|success|thank you/i');
    await expect(successMessage.first()).toBeVisible({ timeout: 10000 });
  });

  test('shows loading state during submission', async ({ page }) => {
    await mockContactSubmission(page, { delayMs: 500 });

    await page.fill('input[name="name"], input#name', 'Test User');
    await page.fill('input[name="email"], input#email', 'test@example.com');
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', 'Test message');
    
    // Click submit and immediately check for loading state
    const submitButton = page.locator('button[type="submit"]');
    await submitButton.click();
    
    // Button should show loading state (disabled or spinner)
    const isDisabled = await submitButton.isDisabled();
    const hasSpinner = await page.locator('button[type="submit"] svg.animate-spin').isVisible().catch(() => false);
    const hasLoadingText = await page.locator('button:has-text("Sending")').isVisible().catch(() => false);
    
    // At least one loading indicator should be present
    expect(isDisabled || hasSpinner || hasLoadingText).toBeTruthy();
  });

  test('can select different subject options', async ({ page }) => {
    const subjectSelect = page.locator('select[name="subject"], select#subject');
    
    // Get all options
    const options = await subjectSelect.locator('option').all();
    expect(options.length).toBeGreaterThan(1);
    
    // Try selecting each option
    for (let i = 1; i < Math.min(options.length, 4); i++) {
      await subjectSelect.selectOption({ index: i });
      const selectedValue = await subjectSelect.inputValue();
      expect(selectedValue).toBeTruthy();
    }
  });

  test('has quick link to intake form', async ({ page }) => {
    // Should have a link to the intake form
    const intakeLink = page.getByRole('link', { name: 'Go to Intake Form' });
    await expect(intakeLink).toBeVisible();
    
    // Click it
    await intakeLink.click();
    
    // Should navigate to intake form
    await expect(page).toHaveURL(/\/intake/);
  });
});

test.describe('Contact Page Information Display', () => {
  test('displays correct business hours', async ({ page }) => {
    await page.goto('/contact');
    
    // Check weekday hours - look for the text pattern
    await expect(page.getByText('Monday – Friday: 10:00 AM – 3:00 PM')).toBeVisible();
    
    // Check weekend hours
    await expect(page.getByText('Saturday – Sunday: Closed')).toBeVisible();
  });

  test('displays phone numbers with click-to-call', async ({ page }) => {
    await page.goto('/contact');
    
    // Check for phone links
    const phoneLinks = page.locator('a[href^="tel:"]');
    const count = await phoneLinks.count();
    expect(count).toBeGreaterThan(0);
    
    // Verify phone format
    const firstPhoneHref = await phoneLinks.first().getAttribute('href');
    expect(firstPhoneHref).toMatch(/tel:\+?1?671/);
  });

  test('displays email with mailto link', async ({ page }) => {
    await page.goto('/contact');
    
    // Check for email link
    const emailLink = page.locator('a[href^="mailto:"]');
    await expect(emailLink.first()).toBeVisible();
    
    // Verify it's a valid email
    const emailHref = await emailLink.first().getAttribute('href');
    expect(emailHref).toMatch(/mailto:.*@.*\..*/);
  });
});

test.describe('Contact Form Edge Cases', () => {
  test('handles special characters in name and message', async ({ page }) => {
    await mockContactSubmission(page);
    await page.goto('/contact');
    
    await page.fill('input[name="name"], input#name', "María O'Connor-García");
    await page.fill('input[name="email"], input#email', 'test@example.com');
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', 'Test with special chars: < > & " \' © ®');
    
    await page.click('button[type="submit"]');
    
    // Should submit successfully or show success
    const successOrProcessing = page.locator('text=/sent|success|sending/i');
    await expect(successOrProcessing.first()).toBeVisible({ timeout: 10000 });
  });

  test('handles very long message', async ({ page }) => {
    await mockContactSubmission(page);
    await page.goto('/contact');
    
    const longMessage = 'This is a very long test message. '.repeat(50);
    
    await page.fill('input[name="name"], input#name', 'Test User');
    await page.fill('input[name="email"], input#email', 'test@example.com');
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', longMessage);
    
    await page.click('button[type="submit"]');
    
    await expect(page.getByRole('heading', { name: 'Message Sent!' })).toBeVisible();
  });

  test('trims whitespace from inputs', async ({ page }) => {
    let submittedPayload: Record<string, string> | undefined;
    await mockContactSubmission(page, {
      inspect: (payload) => { submittedPayload = payload; },
    });
    await page.goto('/contact');
    
    await page.fill('input[name="name"], input#name', '  Test User  ');
    await page.fill('input[name="email"], input#email', '  test@example.com  ');
    await page.selectOption('select[name="subject"], select#subject', { index: 1 });
    await page.fill('textarea[name="message"], textarea#message', '  Test message  ');
    
    await page.click('button[type="submit"]');
    
    await expect(page.getByRole('heading', { name: 'Message Sent!' })).toBeVisible();
    expect(submittedPayload).toMatchObject({
      name: 'Test User',
      email: 'test@example.com',
      message: 'Test message',
    });
  });
});
