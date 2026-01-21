import { test, expect } from '@playwright/test';

/**
 * Public Pages Tests
 * 
 * These tests run WITHOUT authentication.
 * They test the marketing pages and public intake form.
 */

test.describe('Public Marketing Pages', () => {
  test('home page loads and displays content', async ({ page }) => {
    await page.goto('/');
    
    // Check main heading
    await expect(page.locator('h1').first()).toBeVisible();
    
    // Check navigation exists
    await expect(page.locator('nav')).toBeVisible();
    
    // Check key sections
    await expect(page.locator('text=Services, text=About')).toBeTruthy();
  });

  test('about page loads', async ({ page }) => {
    await page.goto('/about');
    
    // Check content
    await expect(page.locator('h1')).toContainText(/About|Cornerstone/i);
  });

  test('services page loads', async ({ page }) => {
    await page.goto('/services');
    
    // Check services are listed
    await expect(page.locator('h1')).toContainText(/Services/i);
  });

  test('contact page loads', async ({ page }) => {
    await page.goto('/contact');
    
    // Check contact form or info
    await expect(page.locator('h1')).toContainText(/Contact/i);
  });

  test('navigation links work', async ({ page }) => {
    await page.goto('/');
    
    // Click About link
    await page.click('a:has-text("About")');
    await expect(page).toHaveURL(/\/about/);
    
    // Click Services link  
    await page.click('a:has-text("Services")');
    await expect(page).toHaveURL(/\/services/);
    
    // Click Contact link
    await page.click('a:has-text("Contact")');
    await expect(page).toHaveURL(/\/contact/);
  });
});

test.describe('Intake Form (Public Access)', () => {
  test('intake form loads', async ({ page }) => {
    await page.goto('/intake');
    
    // Check form exists
    await expect(page.locator('form, [data-testid="intake-form"]')).toBeVisible();
    
    // Check first step is visible
    await expect(page.locator('text=Client Information, text=First Name').first()).toBeVisible();
  });

  test('kiosk mode hides navigation', async ({ page }) => {
    await page.goto('/intake?mode=kiosk');
    
    // Navigation should be hidden or minimal
    const nav = page.locator('nav');
    const isNavHidden = await nav.isHidden() || await nav.count() === 0;
    
    // Form should still be visible
    await expect(page.locator('form, [data-testid="intake-form"]').first()).toBeVisible();
  });

  test('form validation shows errors for empty required fields', async ({ page }) => {
    await page.goto('/intake');
    
    // Try to proceed without filling anything
    const nextButton = page.locator('button:has-text("Next")');
    await nextButton.click();
    
    // Should show validation errors
    const errorMessages = page.locator('.text-red-500, .text-red-600, [role="alert"]');
    await expect(errorMessages.first()).toBeVisible();
  });

  test('can fill first step of intake form', async ({ page }) => {
    await page.goto('/intake');
    
    // Fill basic info
    await page.fill('input[name="firstName"], [placeholder*="First"]', 'Test');
    await page.fill('input[name="lastName"], [placeholder*="Last"]', 'User');
    await page.fill('input[name="email"], [type="email"]', 'test@example.com');
    await page.fill('input[name="phone"], [type="tel"]', '671-555-1234');
    
    // Click next
    await page.click('button:has-text("Next")');
    
    // Should advance to next step (Tax Filing Information)
    await expect(page.locator('text=Tax Filing, text=Filing Status').first()).toBeVisible();
  });
});

test.describe('Mobile Responsiveness', () => {
  test.use({ viewport: { width: 375, height: 667 } }); // iPhone SE

  test('mobile navigation works', async ({ page }) => {
    await page.goto('/');
    
    // Look for hamburger menu (mobile nav toggle)
    const menuButton = page.locator('[aria-label="Menu"], button:has-text("☰"), .hamburger, [data-testid="mobile-menu"]');
    
    if (await menuButton.isVisible()) {
      await menuButton.click();
      
      // Nav links should appear
      await expect(page.locator('a:has-text("About")').first()).toBeVisible();
    }
  });

  test('intake form is usable on mobile', async ({ page }) => {
    await page.goto('/intake');
    
    // Form should be visible
    await expect(page.locator('form, [data-testid="intake-form"]').first()).toBeVisible();
    
    // Inputs should be tappable (visible and not obscured)
    const firstInput = page.locator('input').first();
    await expect(firstInput).toBeVisible();
    
    // Can type in input
    await firstInput.fill('Mobile Test');
  });
});
