import { test, expect } from '@playwright/test'

/**
 * Seed folders and snippets into the Zustand store via window.__snippetStore
 */
async function seedStore(page: import('@playwright/test').Page) {
  await page.evaluate(() => {
    const store = window.__snippetStore
    if (!store) throw new Error('Store not exposed on window')

    const { createFolder, createSnippet } = store.getState()

    // Create parent folder (returns Folder with generated id)
    const parent = createFolder({ name: 'Parent Folder', orderIndex: 0 })
    // Create child (nested) folder under parent
    const child = createFolder({ name: 'Child Folder', parentId: parent.id, orderIndex: 0 })
    // Create empty folder
    createFolder({ name: 'Empty Folder', orderIndex: 1 })

    // Create snippets inside parent folder
    createSnippet({ name: 'Snippet A', text: 'content a', folderId: parent.id })
    createSnippet({ name: 'Snippet B', text: 'content b', folderId: parent.id })

    // Create snippet inside child folder
    createSnippet({ name: 'Snippet C', text: 'content c', folderId: child.id })

    // Create unfiled snippet (no folderId)
    createSnippet({ name: 'Unfiled Snippet', text: 'unfiled content' })
  })
}

test.describe('Folder Tree Display (US-1)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    // Wait for app to fully mount (header renders "Prompt Workbench")
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    // Wait for store to be exposed on window
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    // Wait for React to re-render with seeded data
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })
  })

  test('folder renders with chevron', async ({ page }) => {
    const folderRows = page.locator('[data-testid="folder-row"]')
    await expect(folderRows.first()).toBeVisible()

    // Chevron icon present
    const chevron = folderRows.first().locator('[data-testid="folder-chevron"]')
    await expect(chevron).toBeVisible()
  })

  test('click chevron expands/collapses — child snippets toggle visibility', async ({ page }) => {
    // Use depth=0 to target only the root-level parent folder
    const parentRow = page.locator('[data-testid="folder-row"][data-depth="0"]').filter({ hasText: 'Parent Folder' })
    const header = parentRow.locator('> [data-testid="folder-header"]')

    // Click to expand
    await header.click()
    // Children should be visible
    const children = parentRow.locator('> [data-testid="folder-children"]')
    await expect(children).toBeVisible()
    const snippetA = children.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet A' })
    await expect(snippetA).toBeVisible()

    // Click again to collapse
    await header.click()
    await expect(children).not.toBeVisible()
  })

  test('nested indent — subfolder has greater left padding than parent', async ({ page }) => {
    // Expand parent folder first
    const parentRow = page.locator('[data-testid="folder-row"][data-depth="0"]').filter({ hasText: 'Parent Folder' })
    await parentRow.locator('> [data-testid="folder-header"]').click()

    // Use data-depth attributes for unambiguous selection
    const parentHeader = page.locator('[data-testid="folder-row"][data-depth="0"] > [data-testid="folder-header"]').first()
    const childHeader = page.locator('[data-testid="folder-row"][data-depth="1"] > [data-testid="folder-header"]').first()

    await expect(childHeader).toBeVisible()

    const parentPadding = await parentHeader.evaluate((el) => parseInt(getComputedStyle(el).paddingLeft))
    const childPadding = await childHeader.evaluate((el) => parseInt(getComputedStyle(el).paddingLeft))

    expect(childPadding).toBeGreaterThan(parentPadding)
  })

  test('snippet count — folder row shows (N) count matching actual snippets', async ({ page }) => {
    // Parent Folder has 2 direct snippets + 1 in child = 3 total
    const parentFolder = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Parent Folder' })
    const countBadge = parentFolder.locator('[data-testid="snippet-count"]')
    await expect(countBadge).toBeVisible()
    await expect(countBadge).toHaveText('(3)')
  })

  test('unfiled snippets render at root level, not inside any folder', async ({ page }) => {
    // The unfiled snippet should be a direct child of the main list, not inside any folder-children
    const unfiledSnippet = page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Unfiled Snippet' })
    await expect(unfiledSnippet).toBeVisible()

    // It should NOT be inside any folder-children container
    const insideFolder = page.locator('[data-testid="folder-children"] [data-testid="snippet-row"]').filter({ hasText: 'Unfiled Snippet' })
    await expect(insideFolder).toHaveCount(0)
  })

  test('empty state — folder with 0 snippets shows no count badge', async ({ page }) => {
    const emptyFolder = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Empty Folder' })
    await expect(emptyFolder).toBeVisible()

    const countBadge = emptyFolder.locator('[data-testid="snippet-count"]')
    await expect(countBadge).toHaveCount(0)
  })
})
