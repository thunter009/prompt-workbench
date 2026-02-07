import { test, expect } from '@playwright/test'

async function seedStore(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const store = window.__snippetStore
    if (!store) throw new Error('Store not exposed on window')
    const { createSnippet } = store.getState()

    createSnippet({ name: 'React Guide', text: 'react content', tags: ['react', 'frontend'] })
    createSnippet({ name: 'Vue Guide', text: 'vue content', tags: ['vue', 'frontend'] })
    createSnippet({ name: 'Node API', text: 'node content', tags: ['node', 'backend'] })
    createSnippet({ name: 'Untagged', text: 'no tags', tags: [] })
  })
}

test.describe('Tag Filtering', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="tag-filter"]', { timeout: 5000 })
  })

  test('shows tag pills for all unique tags', async ({ page }) => {
    const pills = page.locator('[data-testid="tag-pill"]')
    await expect(pills).toHaveCount(5) // backend, frontend, node, react, vue (sorted)
    // Verify sorted order
    await expect(pills.nth(0)).toHaveText('backend')
    await expect(pills.nth(4)).toHaveText('vue')
  })

  test('click tag pill filters snippets (OR mode)', async ({ page }) => {
    // Click "react" tag
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()

    // Should show only React Guide
    const rows = page.locator('[data-testid="snippet-row"]')
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('React Guide')
  })

  test('OR mode: multiple tags show union', async ({ page }) => {
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()
    await page.locator('[data-testid="tag-pill"][data-tag="node"]').click()

    const rows = page.locator('[data-testid="snippet-row"]')
    await expect(rows).toHaveCount(2)
  })

  test('AND mode: multiple tags show intersection', async ({ page }) => {
    // Select two tags that overlap on one snippet
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()
    await page.locator('[data-testid="tag-pill"][data-tag="frontend"]').click()

    // Default is OR — should show React Guide + Vue Guide (both have frontend or react)
    const rowsOr = page.locator('[data-testid="snippet-row"]')
    await expect(rowsOr).toHaveCount(2)

    // Switch to AND
    await page.locator('[data-testid="tag-filter-mode"]').click()
    await expect(page.locator('[data-testid="tag-filter-mode"]')).toHaveText('ALL')

    // Only React Guide has both "react" AND "frontend"
    const rowsAnd = page.locator('[data-testid="snippet-row"]')
    await expect(rowsAnd).toHaveCount(1)
    await expect(rowsAnd.first()).toContainText('React Guide')
  })

  test('clear button removes all tag filters', async ({ page }) => {
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)

    await page.locator('[data-testid="tag-filter-clear"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(4)
  })

  test('deselecting a tag removes it from filter', async ({ page }) => {
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)

    // Click again to deselect
    await page.locator('[data-testid="tag-pill"][data-tag="react"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(4)
  })
})
