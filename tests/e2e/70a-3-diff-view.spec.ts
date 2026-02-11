import { test, expect } from '@playwright/test'

async function seedStoreWithVersions(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const snippetStore = window.__snippetStore
    const versionStore = window.__versionStore
    if (!snippetStore || !versionStore) throw new Error('Stores not exposed')

    const { createSnippet, selectSnippet } = snippetStore.getState()
    const snippet = createSnippet({ name: 'Test Snippet', text: 'line one\nline two\nline three', tags: [] })

    // Seed versions with explicit timestamps for stable sort order
    const now = Date.now()
    const versions = versionStore.getState().versions
    const newVersions = [
      ...versions,
      { id: 'v1-old', snippetId: snippet.id, text: 'original text\nfirst version', createdAt: now - 3000 },
      { id: 'v2-mid', snippetId: snippet.id, text: 'original text\nfirst version\nadded line', createdAt: now - 2000 },
      { id: 'v3-new', snippetId: snippet.id, text: 'modified text\nfirst version\nadded line\nanother line', createdAt: now - 1000 },
    ]
    versionStore.setState({ versions: newVersions })
    localStorage.setItem('prompt-workbench-versions', JSON.stringify(newVersions))

    selectSnippet(snippet.id)
  })
}

test.describe('US-3: Diff View', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore && !!window.__versionStore, { timeout: 5000 })
    await seedStoreWithVersions(page)
  })

  test('opens version history sidebar and shows versions', async ({ page }) => {
    await page.locator('[data-testid="history-toggle-btn"]').click()
    await expect(page.locator('[data-testid="version-history-sidebar"]')).toBeVisible()

    const entries = page.locator('[data-testid="version-entry"]')
    await expect(entries).toHaveCount(3)
  })

  test('selecting version shows inline diff in editor pane', async ({ page }) => {
    await page.locator('[data-testid="history-toggle-btn"]').click()

    // Click the oldest version (last in list = index 2)
    const entries = page.locator('[data-testid="version-entry"]')
    await entries.nth(2).click()

    // Inline diff should appear in editor area with CodeMirror merge view
    await expect(page.locator('.cm-mergeView, .cm-merge-revert')).toBeVisible({ timeout: 5000 })
  })

  test('compare button lets you diff any two versions', async ({ page }) => {
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')

    // Select first version (newest)
    await entries.nth(0).click()

    // Click compare on second version - need to hover to show the button
    await entries.nth(1).hover()
    await entries.nth(1).locator('[data-testid="version-compare-btn"]').click()

    // Should show inline diff in editor pane
    await expect(page.locator('.cm-mergeView, .cm-merge-revert')).toBeVisible({ timeout: 5000 })

    // Should show "(compare)" text on the compare target
    await expect(entries.nth(1)).toContainText('compare')
  })

  test('unified/split toggle switches diff layout', async ({ page }) => {
    await page.locator('[data-testid="history-toggle-btn"]').click()

    const entries = page.locator('[data-testid="version-entry"]')
    await entries.nth(2).click()

    // Wait for diff to load
    await expect(page.locator('.cm-mergeView, .cm-merge-revert')).toBeVisible({ timeout: 5000 })

    // Click split view button (Columns2 icon)
    await page.locator('button[title="Split view"]').click()

    // Should show side-by-side merge view
    await expect(page.locator('.cm-mergeView')).toBeVisible({ timeout: 5000 })
  })
})
