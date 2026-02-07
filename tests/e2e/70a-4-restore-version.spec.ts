import { test, expect } from '@playwright/test'

async function seedStoreWithVersions(page: import('@playwright/test').Page) {
  return await page.evaluate(() => {
    const snippetStore = window.__snippetStore
    const versionStore = window.__versionStore
    if (!snippetStore || !versionStore) throw new Error('Stores not exposed')

    const { createSnippet, selectSnippet } = snippetStore.getState()
    const snippet = createSnippet({ name: 'Restore Test', text: 'current text after edits', tags: [] })

    // Seed versions with explicit timestamps to ensure stable sort order
    const now = Date.now()
    const versions = versionStore.getState().versions
    const newVersions = [
      ...versions,
      { id: 'v1-old', snippetId: snippet.id, text: 'original version text', createdAt: now - 3000 },
      { id: 'v2-mid', snippetId: snippet.id, text: 'second version text', createdAt: now - 2000 },
      { id: 'v3-new', snippetId: snippet.id, text: 'current text after edits', createdAt: now - 1000 },
    ]
    versionStore.setState({ versions: newVersions })
    localStorage.setItem('prompt-workbench-versions', JSON.stringify(newVersions))

    selectSnippet(snippet.id)
    return snippet.id
  })
}

test.describe('US-4: One-click Restore', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore && !!window.__versionStore, { timeout: 5000 })
  })

  test('restore button shows confirmation dialog', async ({ page }) => {
    await seedStoreWithVersions(page)
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')
    await expect(entries).toHaveCount(3)

    // Hover and click restore on oldest version (index 2)
    await entries.nth(2).hover()
    await entries.nth(2).locator('[data-testid="version-restore-btn"]').click()

    // Confirmation dialog should appear
    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).toBeVisible()
    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).toContainText('Restore version?')
    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).toContainText('original version text')
  })

  test('cancel button dismisses confirmation', async ({ page }) => {
    await seedStoreWithVersions(page)
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')
    await entries.nth(2).hover()
    await entries.nth(2).locator('[data-testid="version-restore-btn"]').click()

    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).toBeVisible()

    // Cancel
    await page.locator('[data-testid="restore-cancel-btn"]').click()
    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).not.toBeVisible()
  })

  test('confirming restore updates snippet text', async ({ page }) => {
    const snippetId = await seedStoreWithVersions(page)
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')

    // Restore oldest version
    await entries.nth(2).hover()
    await entries.nth(2).locator('[data-testid="version-restore-btn"]').click()
    await page.locator('[data-testid="restore-confirm-btn"]').click()

    // Dialog should close
    await expect(page.locator('[data-testid="restore-confirm-dialog"]')).not.toBeVisible()

    // Verify snippet text was updated
    const text = await page.evaluate((id) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const snippet = store.getState().snippets.find((s: { id: string }) => s.id === id)
      return snippet?.text
    }, snippetId)

    expect(text).toBe('original version text')
  })

  test('restore creates a new version (preserves history)', async ({ page }) => {
    const snippetId = await seedStoreWithVersions(page)
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')
    const initialCount = await entries.count()

    // Restore oldest version
    await entries.nth(2).hover()
    await entries.nth(2).locator('[data-testid="version-restore-btn"]').click()
    await page.locator('[data-testid="restore-confirm-btn"]').click()

    // Wait for debounced version save (2s debounce + buffer)
    await page.waitForTimeout(2500)

    // Recount versions - should have one more from the auto-save of restored text
    const newCount = await page.evaluate((id) => {
      const store = window.__versionStore
      if (!store) throw new Error('Store not exposed')
      return store.getState().getVersionsForSnippet(id).length
    }, snippetId)

    expect(newCount).toBe(initialCount + 1)
  })
})
