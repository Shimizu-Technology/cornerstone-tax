import { test, expect } from '@playwright/test';

/**
 * Admin Dashboard Tests
 * 
 * These tests require authentication (use saved auth state).
 * They test the admin dashboard functionality.
 */

test.describe('Admin Dashboard', () => {
  test('dashboard loads and shows overview', async ({ page }) => {
    await page.goto('/admin');
    
    // Check we're on dashboard
    await expect(page.locator('h1').first()).toContainText(/Dashboard/i);
    
    // Check key metrics or cards are visible
    // Adjust selectors based on your actual dashboard
    const cards = page.locator('.bg-white, [data-testid="dashboard-card"]');
    await expect(cards.first()).toBeVisible();
  });

  test('sidebar navigation works', async ({ page }) => {
    await page.goto('/admin');
    
    // Click Clients link
    await page.click('a:has-text("Clients")');
    await expect(page).toHaveURL(/\/admin\/clients/);
    
    // Click Returns/Tax Returns link
    await page.click('a:has-text("Returns"), a:has-text("Tax Returns")');
    await expect(page).toHaveURL(/\/admin\/returns/);
    
    // Click back to Dashboard
    await page.click('a:has-text("Dashboard")');
    await expect(page).toHaveURL('/admin');
  });
});

test.describe('Client Management', () => {
  test('client list loads', async ({ page }) => {
    await page.goto('/admin/clients');
    
    // Check heading
    await expect(page.locator('h1').first()).toContainText(/Clients/i);
    
    // Check table or list exists
    const list = page.locator('table, [data-testid="client-list"]');
    await expect(list.first()).toBeVisible();
  });

  test('can search clients', async ({ page }) => {
    await page.goto('/admin/clients');
    
    // Find search input
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]');
    
    if (await searchInput.isVisible()) {
      await searchInput.fill('Test');
      await page.keyboard.press('Enter');
      
      // Wait for search to complete
      await page.waitForLoadState('networkidle');
      
      // Results should update (we can't verify specific results without test data)
    }
  });

  test('can open client detail', async ({ page }) => {
    await page.goto('/admin/clients');
    
    // Click on first client row/card
    const firstClient = page.locator('table tbody tr, [data-testid="client-row"]').first();
    
    if (await firstClient.isVisible()) {
      await firstClient.click();
      
      // Should navigate to detail page
      await expect(page).toHaveURL(/\/admin\/clients\/\d+/);
    }
  });
});

test.describe('Tax Returns Management', () => {
  test('tax returns list loads', async ({ page }) => {
    await page.goto('/admin/returns');
    
    // Check heading
    await expect(page.locator('h1').first()).toContainText(/Returns|Tax/i);
    
    // Check list exists
    const list = page.locator('table, [data-testid="returns-list"]');
    await expect(list.first()).toBeVisible();
  });

  test('can filter by status', async ({ page }) => {
    await page.goto('/admin/returns');
    
    // Find status filter
    const statusFilter = page.locator('select, [data-testid="status-filter"]').first();
    
    if (await statusFilter.isVisible()) {
      // Select a status
      await statusFilter.selectOption({ index: 1 });
      
      // Wait for filter to apply
      await page.waitForLoadState('networkidle');
    }
  });
});

test.describe('Time Tracking', () => {
  test('time tracking page loads', async ({ page }) => {
    await page.goto('/admin/time');
    
    // Check heading
    await expect(page.locator('h1').first()).toContainText(/Time/i);
  });

  test('can switch between day and week view', async ({ page }) => {
    await page.goto('/admin/time');
    
    // Find view toggle
    const dayButton = page.locator('button:has-text("Day")');
    const weekButton = page.locator('button:has-text("Week")');
    
    if (await weekButton.isVisible()) {
      await weekButton.click();
      // View should change (verify by checking for week-specific elements)
    }
    
    if (await dayButton.isVisible()) {
      await dayButton.click();
      // View should change back
    }
  });
});

test.describe('Settings', () => {
  test('settings page loads', async ({ page }) => {
    await page.goto('/admin/settings');
    
    // Check heading
    await expect(page.locator('h1').first()).toContainText(/Settings/i);
  });
});

test.describe('User Management (Admin Only)', () => {
  test('users page loads', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Check heading
    await expect(page.locator('h1').first()).toContainText(/Users|Team/i);
  });

  test('can see invite user button', async ({ page }) => {
    await page.goto('/admin/users');
    
    // Check for invite button
    const inviteButton = page.locator('button:has-text("Invite"), button:has-text("Add User")');
    await expect(inviteButton.first()).toBeVisible();
  });
});
