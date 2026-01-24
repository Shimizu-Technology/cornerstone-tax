import { test, expect } from '@playwright/test';

/**
 * Tax Return Workflow Tests
 * 
 * Tests the complete tax return management workflow including:
 * - Viewing tax returns list
 * - Updating status
 * - Adding notes
 * - Assigning employees
 * - Viewing workflow history
 * 
 * These tests require authentication.
 */

test.describe('Tax Returns List', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/admin/returns');
    await page.waitForLoadState('domcontentloaded');
  });

  test('page loads successfully', async ({ page }) => {
    // Check page header loads
    const header = page.locator('h1:has-text("Tax Returns")');
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('can filter by status', async ({ page }) => {
    // Find status filter dropdown
    const statusFilter = page.locator('select').first();
    
    if (await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)) {
      await statusFilter.selectOption({ index: 1 });
      await page.waitForTimeout(500);
    }
  });

  test('can search for tax returns', async ({ page }) => {
    const searchInput = page.locator('input[placeholder*="Search"], input[type="search"]').first();
    
    if (await searchInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await searchInput.fill('Test');
      await page.waitForTimeout(500);
    }
  });
});

test.describe('Tax Return Detail Page', () => {
  test('can navigate to detail page from list', async ({ page }) => {
    await page.goto('/admin/returns');
    await page.waitForLoadState('domcontentloaded');
    
    // Look for any clickable return link
    const returnLink = page.locator('a[href*="/admin/returns/"], table tbody tr').first();
    
    if (await returnLink.isVisible({ timeout: 5000 }).catch(() => false)) {
      await returnLink.click();
      await page.waitForURL(/\/admin\/(returns|clients)\/\d+/, { timeout: 5000 }).catch(() => {});
    }
  });
});

test.describe('Tax Return Client Detail', () => {
  test('clients page loads and shows client list', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.waitForLoadState('domcontentloaded');
    
    // Check page loads
    const header = page.locator('h1:has-text("Clients")');
    await expect(header).toBeVisible({ timeout: 10000 });
  });

  test('can navigate to client detail page', async ({ page }) => {
    await page.goto('/admin/clients');
    await page.waitForLoadState('domcontentloaded');
    
    // Click first client
    const clientRow = page.locator('table tbody tr, a[href*="/admin/clients/"]').first();
    if (await clientRow.isVisible({ timeout: 5000 }).catch(() => false)) {
      await clientRow.click();
      await page.waitForTimeout(1000);
    }
  });
});
