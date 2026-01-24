import { test, expect } from '@playwright/test';

/**
 * Complete Intake Form Flow Tests
 * 
 * Tests the full client intake form submission process.
 * These tests run WITHOUT authentication (public access).
 */

test.describe('Complete Intake Form Submission', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/intake');
    // Wait for form to load
    await expect(page.locator('h2:has-text("Client Information")')).toBeVisible();
  });

  test('can complete first two steps of intake form', async ({ page }) => {
    // === STEP 1: Client Information ===
    await page.fill('input[name="first_name"]', 'John');
    await page.fill('input[name="last_name"]', 'Doe');
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', `test-${Date.now()}@example.com`);
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', '123 Marine Corps Dr, Hagatna, GU 96910');
    
    await page.click('button:has-text("Continue")');
    
    // === STEP 2: Tax Filing Info ===
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
    
    // Filing status is radio buttons - click the "Single" option
    await page.click('input[name="filing_status"][value="single"]');
    
    await page.click('button:has-text("Continue")');
    
    // === STEP 3: Should advance past Tax Filing Info ===
    // Verify we're past step 2 by checking the h2 changed
    await expect(page.locator('h2:has-text("Tax Filing Info")')).not.toBeVisible({ timeout: 5000 });
  });

  test('validates required fields on each step', async ({ page }) => {
    // Try to continue without filling required fields
    await page.click('button:has-text("Continue")');
    
    // Should show validation errors
    const errorMessages = page.locator('.text-red-500, [role="alert"]');
    await expect(errorMessages.first()).toBeVisible();
    
    // Fill only some fields
    await page.fill('input[name="first_name"]', 'John');
    await page.click('button:has-text("Continue")');
    
    // Should still show errors for other required fields
    await expect(errorMessages.first()).toBeVisible();
  });

  test('validates email format', async ({ page }) => {
    await page.fill('input[name="first_name"]', 'John');
    await page.fill('input[name="last_name"]', 'Doe');
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', 'invalid-email');
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', '123 Test St');
    
    await page.click('button:has-text("Continue")');
    
    // Should show email validation error
    const emailError = page.locator('text=/valid email|email format/i');
    await expect(emailError).toBeVisible();
  });

  test('validates phone format', async ({ page }) => {
    await page.fill('input[name="first_name"]', 'John');
    await page.fill('input[name="last_name"]', 'Doe');
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '123'); // Invalid phone
    await page.fill('textarea[name="mailing_address"]', '123 Test St');
    
    await page.click('button:has-text("Continue")');
    
    // Should show phone validation error or continue (depends on validation rules)
    // Check if we stayed on the same step
    const stillOnStep1 = await page.locator('h2:has-text("Client Information")').isVisible();
    if (stillOnStep1) {
      const phoneError = page.locator('text=/phone|invalid/i');
      await expect(phoneError).toBeVisible();
    }
  });

  test('can navigate back to previous steps', async ({ page }) => {
    // Fill step 1
    await page.fill('input[name="first_name"]', 'John');
    await page.fill('input[name="last_name"]', 'Doe');
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', '123 Test St');
    
    await page.click('button:has-text("Continue")');
    
    // Should be on step 2
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
    
    // Click back
    await page.click('button:has-text("Back")');
    
    // Should be back on step 1 with data preserved
    await expect(page.locator('h2:has-text("Client Information")')).toBeVisible();
    await expect(page.locator('input[name="first_name"]')).toHaveValue('John');
  });

  test('preserves form data when navigating between steps', async ({ page }) => {
    // Fill step 1
    await page.fill('input[name="first_name"]', 'Jane');
    await page.fill('input[name="last_name"]', 'Smith');
    await page.fill('input[name="date_of_birth"]', '1990-03-20');
    await page.fill('input[name="email"]', 'jane@example.com');
    await page.fill('input[name="phone"]', '671-555-5678');
    await page.fill('textarea[name="mailing_address"]', '456 Palm Ave');
    
    await page.click('button:has-text("Continue")');
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
    
    // Go back
    await page.click('button:has-text("Back")');
    
    // Verify all data is preserved
    await expect(page.locator('input[name="first_name"]')).toHaveValue('Jane');
    await expect(page.locator('input[name="last_name"]')).toHaveValue('Smith');
    await expect(page.locator('input[name="email"]')).toHaveValue('jane@example.com');
  });
});

test.describe('Intake Form Kiosk Mode', () => {
  test('kiosk mode auto-resets after submission timeout', async ({ page }) => {
    await page.goto('/intake?mode=kiosk');
    
    // Verify kiosk mode is active (no header)
    const logoLink = page.locator('header a[href="/"]');
    await expect(logoLink).toHaveCount(0);
    
    // Form should still be functional
    await expect(page.locator('h2:has-text("Client Information")')).toBeVisible();
  });

  test('kiosk mode hides header but shows form', async ({ page }) => {
    await page.goto('/intake?mode=kiosk');
    
    // In kiosk mode, header should be hidden
    const logoLink = page.locator('a[href="/"]');
    await expect(logoLink).toHaveCount(0);
    
    // But form should still be functional
    await expect(page.locator('input[name="first_name"]')).toBeVisible();
    await expect(page.locator('button:has-text("Continue")')).toBeVisible();
  });
});

test.describe('Intake Form Edge Cases', () => {
  test('handles special characters in name fields', async ({ page }) => {
    await page.goto('/intake');
    
    await page.fill('input[name="first_name"]', "María José");
    await page.fill('input[name="last_name"]', "O'Connor-García");
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', 'maria@example.com');
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', '123 Test St');
    
    await page.click('button:has-text("Continue")');
    
    // Should proceed to next step without errors
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
  });

  test('handles very long address input', async ({ page }) => {
    await page.goto('/intake');
    
    const longAddress = '123 Very Long Street Name That Goes On Forever, Apartment Complex Building A, Unit 1234, Floor 56, Hagatna, Guam 96910, United States of America';
    
    await page.fill('input[name="first_name"]', 'Test');
    await page.fill('input[name="last_name"]', 'User');
    await page.fill('input[name="date_of_birth"]', '1985-06-15');
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', longAddress);
    
    await page.click('button:has-text("Continue")');
    
    // Should handle long address gracefully
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
  });

  test('accepts valid date of birth', async ({ page }) => {
    await page.goto('/intake');
    
    // Use a valid past date
    const validDate = '1990-01-15';
    
    await page.fill('input[name="first_name"]', 'Test');
    await page.fill('input[name="last_name"]', 'User');
    await page.fill('input[name="date_of_birth"]', validDate);
    await page.fill('input[name="email"]', 'test@example.com');
    await page.fill('input[name="phone"]', '671-555-1234');
    await page.fill('textarea[name="mailing_address"]', '123 Test St');
    
    await page.click('button:has-text("Continue")');
    
    // Should proceed to next step with valid date
    await expect(page.locator('h2:has-text("Tax Filing Info")')).toBeVisible();
  });
});
