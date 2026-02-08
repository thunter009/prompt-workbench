import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
  await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
})

function mockSuggestFolder(page: import('@playwright/test').Page) {
  return page.route('**/api/suggest-folder', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    const name: string = body.snippet?.name ?? ''

    // Return suggestions based on snippet name for deterministic tests
    if (name.includes('Email')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Email Templates', confidence: 0.9 }],
        }),
      })
    } else if (name.includes('Code')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Code Snippets', confidence: 0.85 }],
        }),
      })
    } else {
      // No suggestion for short/unknown snippets
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [] }),
      })
    }
  })
}

test('opens modal and shows grouped snippets', async ({ page }) => {
  await mockSuggestFolder(page)

  // Seed snippets: 1 unfiled with suggestion, 1 unfiled without suggestion, 1 already in folder
  await page.evaluate(() => {
    const store = window.__snippetStore!
    const { createSnippet, createFolder, moveSnippetsToFolder } = store.getState()
    const longText = 'This is a sufficiently long text for analysis purposes that exceeds thirty characters.'

    createSnippet({ name: 'Email Welcome', text: longText })
    createSnippet({ name: 'Short', text: 'hi' }) // too short, unfiled
    const f = createFolder({ name: 'Existing', orderIndex: 0 })
    const s3 = createSnippet({ name: 'Placed Item', text: longText })
    moveSnippetsToFolder([s3.id], f.id)
  })

  // Click reorg trigger
  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-modal"]')).toBeVisible()

  // Wait for analysis to complete
  await expect(page.locator('[data-testid="reorg-loading"]')).not.toBeVisible({ timeout: 15000 })

  // Suggested section: "Email Welcome" -> "Email Templates"
  const suggestedSection = page.locator('[data-testid="reorg-suggested"]')
  await expect(suggestedSection).toBeVisible()
  await expect(suggestedSection.locator('[data-testid="reorg-suggestion-row"]')).toHaveCount(1)
  await expect(suggestedSection).toContainText('Email Welcome')
  await expect(suggestedSection).toContainText('Email Templates')

  // Unfiled section: "Short" (too short for suggestions)
  const unfiledSection = page.locator('[data-testid="reorg-unfiled"]')
  await expect(unfiledSection).toBeVisible()
  await expect(unfiledSection).toContainText('Short')

  // Well-placed section: "Placed Item"
  const wellPlacedSection = page.locator('[data-testid="reorg-well-placed"]')
  await expect(wellPlacedSection).toBeVisible()
  await expect(wellPlacedSection).toContainText('Placed Item')
})

test('checkbox selection toggles and select/deselect all works', async ({ page }) => {
  await mockSuggestFolder(page)

  await page.evaluate(() => {
    const store = window.__snippetStore!
    const { createSnippet } = store.getState()
    const text = 'This is a sufficiently long text for analysis purposes that exceeds thirty characters.'
    createSnippet({ name: 'Email Draft', text })
    createSnippet({ name: 'Code Review', text })
  })

  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-loading"]')).not.toBeVisible({ timeout: 15000 })

  // Both should be pre-selected (auto-select all suggested)
  const rows = page.locator('[data-testid="reorg-suggestion-row"]')
  await expect(rows).toHaveCount(2)

  // Deselect all
  await page.locator('[data-testid="reorg-toggle-all"]').click()
  // Apply button should be disabled (0 selected)
  const applyBtn = page.locator('[data-testid="reorg-apply"]')
  await expect(applyBtn).toBeDisabled()

  // Select all again
  await page.locator('[data-testid="reorg-toggle-all"]').click()
  await expect(applyBtn).toBeEnabled()

  // Toggle individual row off by clicking the row
  await rows.first().click()
  // Should still have 1 selected
  await expect(applyBtn).toContainText('Apply (1)')
})

test('apply creates folders and moves snippets', async ({ page }) => {
  await mockSuggestFolder(page)

  await page.evaluate(() => {
    const store = window.__snippetStore!
    const { createSnippet } = store.getState()
    const text = 'This is a sufficiently long text for analysis purposes that exceeds thirty characters.'
    createSnippet({ name: 'Email Onboarding', text })
    createSnippet({ name: 'Code Helper', text })
  })

  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-loading"]')).not.toBeVisible({ timeout: 15000 })

  // Apply all suggested moves
  await page.locator('[data-testid="reorg-apply"]').click()

  // Should show done state
  await expect(page.locator('[data-testid="reorg-done"]')).toBeVisible()

  // Close modal
  await page.locator('[data-testid="reorg-close-done"]').click()
  await expect(page.locator('[data-testid="reorg-modal"]')).not.toBeVisible()

  // Verify folders were created and snippets moved
  const state = await page.evaluate(() => {
    const store = window.__snippetStore!
    const { folders, snippets } = store.getState()
    return { folders, snippets }
  })

  // Two new folders should exist
  const folderNames = state.folders.map((f: { name: string }) => f.name)
  expect(folderNames).toContain('Email Templates')
  expect(folderNames).toContain('Code Snippets')

  // Snippets should be in their folders
  const emailFolder = state.folders.find((f: { name: string }) => f.name === 'Email Templates')
  const codeFolder = state.folders.find((f: { name: string }) => f.name === 'Code Snippets')
  const emailSnippet = state.snippets.find((s: { name: string }) => s.name === 'Email Onboarding')
  const codeSnippet = state.snippets.find((s: { name: string }) => s.name === 'Code Helper')

  expect(emailSnippet!.folderId).toBe(emailFolder!.id)
  expect(codeSnippet!.folderId).toBe(codeFolder!.id)
})

test('apply uses existing folder instead of creating duplicate', async ({ page }) => {
  await mockSuggestFolder(page)

  await page.evaluate(() => {
    const store = window.__snippetStore!
    const { createSnippet, createFolder } = store.getState()
    const text = 'This is a sufficiently long text for analysis purposes that exceeds thirty characters.'
    // Pre-create "Email Templates" folder
    createFolder({ name: 'Email Templates', orderIndex: 0 })
    createSnippet({ name: 'Email Follow-up', text })
  })

  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-loading"]')).not.toBeVisible({ timeout: 15000 })

  await page.locator('[data-testid="reorg-apply"]').click()
  await expect(page.locator('[data-testid="reorg-done"]')).toBeVisible()

  // Should NOT have created a duplicate folder
  const folderCount = await page.evaluate(() => {
    const store = window.__snippetStore!
    return store.getState().folders.filter(
      (f: { name: string }) => f.name.toLowerCase() === 'email templates'
    ).length
  })
  expect(folderCount).toBe(1)
})

test('close button dismisses modal', async ({ page }) => {
  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-modal"]')).toBeVisible()
  await page.locator('[data-testid="reorg-modal-close"]').click()
  await expect(page.locator('[data-testid="reorg-modal"]')).not.toBeVisible()
})
