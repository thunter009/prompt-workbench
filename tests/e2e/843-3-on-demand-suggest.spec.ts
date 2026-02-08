import { test, expect } from '@playwright/test'

const LONG_TEXT = 'This is a long enough snippet text that should trigger the folder suggestion mechanism after the debounce timer fires'
const SHORT_TEXT = 'Too short'

test.describe('On-Demand Suggest Folder (US-3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('clicking suggest button opens popover with folder suggestions and confidence', async ({ page }) => {
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [
            { folder: 'Email Templates', confidence: 0.92 },
            { folder: 'Code Snippets', confidence: 0.75 },
          ],
        }),
      })
    })

    // Seed snippet
    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Test Snippet', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    // Click the suggest button
    const suggestBtn = page.locator('[data-testid="folder-suggest-button"]')
    await expect(suggestBtn).toBeVisible({ timeout: 5000 })
    await suggestBtn.click()

    // Popover should appear
    const popover = page.locator('[data-testid="folder-suggest-popover"]')
    await expect(popover).toBeVisible({ timeout: 10000 })

    // Should show suggestion items with folder names and confidence
    const items = page.locator('[data-testid="folder-suggest-popover-item"]')
    await expect(items).toHaveCount(2)
    await expect(items.nth(0)).toContainText('Email Templates')
    await expect(items.nth(0)).toContainText('92%')
    await expect(items.nth(1)).toContainText('Code Snippets')
    await expect(items.nth(1)).toContainText('75%')
  })

  test('clicking a popover suggestion assigns folder and closes popover', async ({ page }) => {
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'DevOps', confidence: 0.88 }],
        }),
      })
    })

    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Deploy Script', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    await page.locator('[data-testid="folder-suggest-button"]').click()

    const popover = page.locator('[data-testid="folder-suggest-popover"]')
    await expect(popover).toBeVisible({ timeout: 10000 })

    // Click suggestion
    await page.locator('[data-testid="folder-suggest-popover-item"]').first().click()

    // Popover closes
    await expect(popover).not.toBeVisible()

    // Folder created and snippet assigned
    const state = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { folders, snippets } = store.getState()
      return { folders, snippets }
    })

    const devOpsFolder = state.folders.find((f: { name: string }) => f.name === 'DevOps')
    expect(devOpsFolder).toBeTruthy()

    const snippet = state.snippets.find((s: { name: string }) => s.name === 'Deploy Script')
    expect(snippet?.folderId).toBe(devOpsFolder?.id)
  })

  test('popover shows current folder name and suggest button works even with folder assigned', async ({ page }) => {
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Better Folder', confidence: 0.95 }],
        }),
      })
    })

    // Seed snippet with folder
    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet, selectSnippet } = store.getState()
      const folder = createFolder({ name: 'My Folder', orderIndex: 0 })
      const s = createSnippet({ name: 'Filed Snippet', text, folderId: folder.id })
      selectSnippet(s.id)
    }, LONG_TEXT)

    // Current folder should show
    const folderLabel = page.locator('[data-testid="folder-current"]')
    await expect(folderLabel).toContainText('My Folder')

    // Suggest button should still work (on-demand ignores currentFolderId)
    await page.locator('[data-testid="folder-suggest-button"]').click()
    const popover = page.locator('[data-testid="folder-suggest-popover"]')
    await expect(popover).toBeVisible({ timeout: 10000 })

    const items = page.locator('[data-testid="folder-suggest-popover-item"]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Better Folder')
  })

  test('popover close button dismisses it', async ({ page }) => {
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'TestFolder', confidence: 0.8 }],
        }),
      })
    })

    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Close Test', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    await page.locator('[data-testid="folder-suggest-button"]').click()
    const popover = page.locator('[data-testid="folder-suggest-popover"]')
    await expect(popover).toBeVisible({ timeout: 10000 })

    // Close
    await page.locator('[data-testid="folder-suggest-popover-close"]').click()
    await expect(popover).not.toBeVisible()
  })
})
