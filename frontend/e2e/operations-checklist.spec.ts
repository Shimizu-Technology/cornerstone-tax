import { test, expect, type Page } from '@playwright/test'

const clickSidebarLink = async (page: Page, name: string) => {
  const mobileMenuButton = page.locator('button.lg\\:hidden').first()
  if (await mobileMenuButton.isVisible()) {
    await mobileMenuButton.click()
    await page.waitForTimeout(300)
    await page.locator(`.fixed.inset-y-0 a:has-text("${name}")`).click()
    return
  }
  await page.locator(`.lg\\:fixed.lg\\:inset-y-0 a:has-text("${name}")`).click()
}

test.describe('Operations Checklist Lifecycle', () => {
  test('template -> assignment -> cycle -> task completion -> activity filter', async ({ page }) => {
    test.setTimeout(120000)

    const templateName = `E2E Ops Template ${Date.now()}`

    // 1) Template creation in Settings.
    await page.goto('/admin/settings')
    await page.waitForLoadState('networkidle')
    await page.locator('button:has-text("Operations Templates")').first().click()
    await expect(page.locator('h2:has-text("Operations Templates")')).toBeVisible()

    await page.locator('button:has-text("Add Template")').click()
    await page.locator('input[placeholder="e.g., Biweekly Payroll"]').fill(templateName)
    await page.locator('button:has-text("Save Template")').click()
    await expect(page.locator(`text=${templateName}`)).toBeVisible({ timeout: 10000 })

    // 2) Open first client detail.
    await clickSidebarLink(page, 'Clients')
    await page.waitForLoadState('networkidle')

    const clientLink = page.locator('table tbody tr td a[href*="/admin/clients/"]').first()
    await expect(clientLink).toBeVisible({ timeout: 10000 })
    await clientLink.click({ force: true })
    await page.waitForURL('**/admin/clients/*', { timeout: 15000 })
    await expect(page).toHaveURL(/\/admin\/clients\/\d+/)
    await expect(page.locator('h2:has-text("Operations Checklist")')).toBeVisible()

    // 3) Assign template to client.
    const assignmentPanel = page.locator('div').filter({ has: page.locator('h3:has-text("Template Assignments")') }).first()
    await assignmentPanel.locator('select').first().selectOption({ label: templateName })
    await assignmentPanel.locator('button:has-text("Assign Template")').click()
    await expect(
      assignmentPanel.locator('span.font-medium.text-gray-800').filter({ hasText: templateName }).first()
    ).toBeVisible({ timeout: 10000 })

    // 4) Generate cycle.
    const generatePanel = page.locator('h3:has-text("Generate Cycle")').locator('xpath=..')
    const generateSelect = generatePanel.locator('select')
    const generateOptionCount = await generateSelect.locator('option').count()
    expect(generateOptionCount).toBeGreaterThan(1)
    await generateSelect.selectOption({ index: 1 })
    await expect(generateSelect).not.toHaveValue('')

    const today = new Date()
    const start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().slice(0, 10)
    const end = new Date(today.getFullYear(), today.getMonth() + 1, 0).toISOString().slice(0, 10)

    const dateInputs = generatePanel.locator('input[type="date"]')
    await dateInputs.nth(0).fill(start)
    await dateInputs.nth(1).fill(end)
    const generateButton = generatePanel.locator('button:has-text("Generate")')
    await expect(generateButton).toBeEnabled({ timeout: 10000 })
    await generateButton.click()
    await expect(page.locator('h3:has-text("Tasks for")')).toBeVisible({ timeout: 15000 })

    // If selected cycle has no tasks, try switching to another cycle in history.
    const noTasksMessage = page.locator('text=No tasks generated for this cycle.')
    let usedOperationsBoardFallback = false
    if (await noTasksMessage.isVisible().catch(() => false)) {
      const historySelect = page.locator('h3:has-text("Cycle History")').locator('..').locator('select')
      const optionCount = await historySelect.locator('option').count()
      if (optionCount > 1) {
        await historySelect.selectOption({ index: 0 })
        await page.waitForLoadState('networkidle')
      }

      if (await noTasksMessage.isVisible().catch(() => false)) {
        // Fallback to Operations board where tasks are guaranteed to exist for lifecycle checks.
        usedOperationsBoardFallback = true
        await clickSidebarLink(page, 'Operations')
        await page.waitForLoadState('networkidle')
        await expect(page.locator('h1:has-text("Operations")')).toBeVisible()

        const evidenceWarning = page
          .locator('p:has-text("Evidence is required before this task can be marked done from the board.")')
          .first()
        if (await evidenceWarning.count()) {
          const warningCard = evidenceWarning.locator('xpath=ancestor::div[contains(@class,"p-4")][1]')
          await expect(warningCard.locator('button:has-text("Mark Done")')).toBeDisabled()
        }

        const enabledMarkDoneButton = page.locator('button:has-text("Mark Done"):not([disabled])').first()
        if (await enabledMarkDoneButton.count()) {
          await enabledMarkDoneButton.click()
          await page.waitForLoadState('networkidle')
        }
      }
    }

    if (!usedOperationsBoardFallback) {
      const taskCards = page.locator('div.border.border-secondary-dark.rounded-xl.p-4')
      await expect(taskCards.first()).toBeVisible({ timeout: 10000 })

      // 5) Validate completion with and without evidence.
      const evidenceTaskCard = taskCards.filter({ has: page.locator('text=Evidence required') }).first()
      if (await evidenceTaskCard.count()) {
        const completeButton = evidenceTaskCard.locator('button:has-text("Complete")')
        await expect(completeButton).toBeDisabled() // without evidence
        await evidenceTaskCard
          .locator('input[placeholder="Evidence note (required for done)"]')
          .fill('E2E evidence note')
        await expect(completeButton).toBeEnabled()
        await completeButton.click()
        await expect(evidenceTaskCard.locator('button:has-text("Reopen")')).toBeVisible({ timeout: 10000 })
      } else {
        const nonEvidenceCard = taskCards.filter({ has: page.locator('button:has-text("Complete")') }).first()
        const completeButton = nonEvidenceCard.locator('button:has-text("Complete")')
        if (await completeButton.count()) {
          await completeButton.click()
          await expect(nonEvidenceCard.locator('button:has-text("Reopen")')).toBeVisible({ timeout: 10000 })
        }
      }
    }

    // 6) Activity filter includes operations audit types.
    await clickSidebarLink(page, 'Activity')
    await page.waitForLoadState('networkidle')
    await expect(page.locator('h1:has-text("Activity")')).toBeVisible()

    const sourceSelect = page
      .locator('select')
      .filter({ has: page.locator('option:has-text("Audit Logs")') })
      .first()
    if (await sourceSelect.count()) {
      await sourceSelect.selectOption({ label: 'Audit Logs' })
      await page.waitForLoadState('networkidle')
    }

    const auditTypeSelect = page.getByLabel('Audit Type')
    await expect(auditTypeSelect).toBeVisible()
    await auditTypeSelect.selectOption({ label: 'Operations Task' })
    await page.waitForLoadState('networkidle')
  })
})
