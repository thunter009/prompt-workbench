import { test, expect } from '@playwright/test'

const LONG_TEXT = 'This is a long enough snippet text that should trigger the folder suggestion mechanism after the debounce timer fires'

test.describe('Auto-Suggest Folder (US-2)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('suggestion pills appear after debounce and clicking assigns to new folder', async ({ page }) => {
    // Mock the suggest-folder API to return controlled suggestions
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

    // Seed a snippet without a folder
    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Test Email', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    // Wait for debounce (2s) + network + render
    const suggestionsContainer = page.locator('[data-testid="folder-suggestions"]')
    await expect(suggestionsContainer).toBeVisible({ timeout: 10000 })

    // Verify suggestion pills rendered
    const pills = page.locator('[data-testid="folder-suggestion-pill"]')
    await expect(pills).toHaveCount(2)
    await expect(pills.nth(0)).toContainText('Email Templates')
    await expect(pills.nth(1)).toContainText('Code Snippets')

    // First pill should be a new folder (data-existing=false)
    await expect(pills.nth(0)).toHaveAttribute('data-existing', 'false')

    // Click first pill to assign
    await pills.nth(0).click()

    // Pills should disappear after assignment
    await expect(suggestionsContainer).not.toBeVisible()

    // Verify folder was created and snippet was moved
    const state = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { folders, snippets } = store.getState()
      return { folders, snippets }
    })

    const emailFolder = state.folders.find((f: { name: string }) => f.name === 'Email Templates')
    expect(emailFolder).toBeTruthy()

    const snippet = state.snippets.find((s: { name: string }) => s.name === 'Test Email')
    expect(snippet?.folderId).toBe(emailFolder?.id)
  })

  test('clicking pill for existing folder moves snippet without creating new folder', async ({ page }) => {
    // Seed an existing folder
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createFolder({ name: 'Existing Folder', orderIndex: 0 })
    })

    // Mock API to suggest the existing folder
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Existing Folder', confidence: 0.95 }],
        }),
      })
    })

    // Seed snippet
    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Move Me', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    // Wait for suggestion pills
    const pills = page.locator('[data-testid="folder-suggestion-pill"]')
    await expect(pills.first()).toBeVisible({ timeout: 10000 })

    // Should show existing folder badge (data-existing=true)
    await expect(pills.first()).toHaveAttribute('data-existing', 'true')

    // Click to assign
    await pills.first().click()

    // Verify snippet moved to existing folder (not a duplicate)
    const state = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { folders, snippets } = store.getState()
      return { folders, snippets }
    })

    const matchingFolders = state.folders.filter((f: { name: string }) => f.name === 'Existing Folder')
    expect(matchingFolders).toHaveLength(1) // No duplicate created

    const snippet = state.snippets.find((s: { name: string }) => s.name === 'Move Me')
    expect(snippet?.folderId).toBe(matchingFolders[0].id)
  })

  test('dismiss button hides suggestion pills', async ({ page }) => {
    await page.route('**/api/suggest-folder', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Dismissed', confidence: 0.8 }],
        }),
      })
    })

    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const s = createSnippet({ name: 'Dismiss Test', text })
      selectSnippet(s.id)
    }, LONG_TEXT)

    const container = page.locator('[data-testid="folder-suggestions"]')
    await expect(container).toBeVisible({ timeout: 10000 })

    // Click dismiss
    await page.locator('[data-testid="folder-suggestions-dismiss"]').click()

    // Should hide
    await expect(container).not.toBeVisible()
  })

  test('no suggestions when snippet already has a folder', async ({ page }) => {
    let apiCalled = false
    await page.route('**/api/suggest-folder', async (route) => {
      apiCalled = true
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [] }),
      })
    })

    // Seed snippet already in a folder
    await page.evaluate((text) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet, selectSnippet } = store.getState()
      const folder = createFolder({ name: 'Has Folder', orderIndex: 0 })
      const s = createSnippet({ name: 'Already Filed', text, folderId: folder.id })
      selectSnippet(s.id)
    }, LONG_TEXT)

    // Wait past the debounce period
    await page.waitForTimeout(3000)

    // No suggestions should appear
    const container = page.locator('[data-testid="folder-suggestions"]')
    await expect(container).not.toBeVisible()

    // API should not have been called
    expect(apiCalled).toBe(false)
  })
})
