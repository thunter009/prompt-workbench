import { test, expect } from '@playwright/test'

const IMPORT_SNIPPETS = [
  { name: 'Hello World', text: 'Hello, {clipboard}!', keyword: '!hello' },
  { name: 'Signature', text: 'Best regards,\nThom', keyword: '!sig' },
  { name: 'Debug Log', text: 'console.log({cursor})' },
]

async function waitForApp(page: import('@playwright/test').Page) {
  await page.goto('/')
  await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
  await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
}

async function openImportModal(page: import('@playwright/test').Page) {
  await page.click('button[title="Import from Raycast"]')
  await expect(page.locator('text=Import from Raycast').first()).toBeVisible()
}

/**
 * Upload a JSON file to the import modal via the hidden file input
 */
async function uploadImportFile(page: import('@playwright/test').Page, snippets: typeof IMPORT_SNIPPETS) {
  const fileInput = page.locator('input[type="file"][accept=".json"]')
  const json = JSON.stringify(snippets)
  const buffer = Buffer.from(json)

  await fileInput.setInputFiles({
    name: 'test-snippets.json',
    mimeType: 'application/json',
    buffer,
  })
}

test.describe('Import Rayconfig', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('selective import: individual checkbox toggle', async ({ page }) => {
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // All should be selected initially
    await expect(page.getByText(`Select all (3/3)`)).toBeVisible()

    // Uncheck first snippet by clicking its row in the modal
    const modal = page.locator('.fixed.inset-0.z-50')
    const snippetRows = modal.locator('.space-y-2 > div')
    await snippetRows.first().click()

    await expect(page.getByText(`Select all (2/3)`)).toBeVisible()

    // Click again to re-select
    await snippetRows.first().click()
    await expect(page.getByText(`Select all (3/3)`)).toBeVisible()
  })

  test('selective import: select-all toggle', async ({ page }) => {
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // All selected
    await expect(page.getByText(`Select all (3/3)`)).toBeVisible()

    // Click select all to deselect all
    await page.getByText('Select all').click()
    await expect(page.getByText(`Select all (0/3)`)).toBeVisible()

    // Click again to select all
    await page.getByText('Select all').click()
    await expect(page.getByText(`Select all (3/3)`)).toBeVisible()
  })

  test('conflict detection: shows duplicate badge for existing names', async ({ page }) => {
    // Seed an existing snippet with same name as one in import
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Hello World', text: 'existing content' })
    })

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Should show conflict warning banner
    await expect(page.getByTestId('conflict-warning')).toBeVisible()
    await expect(page.getByTestId('conflict-warning')).toContainText('already exists')

    // Should show duplicate badge on the conflicting snippet
    const badges = page.getByTestId('duplicate-badge')
    await expect(badges).toHaveCount(1)
    await expect(badges.first()).toContainText('duplicate')
  })

  test('conflict detection: no banner when no duplicates', async ({ page }) => {
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // No conflict warning should appear
    await expect(page.getByTestId('conflict-warning')).toHaveCount(0)
    await expect(page.getByTestId('duplicate-badge')).toHaveCount(0)
  })

  test('import to folder: folder selector present', async ({ page }) => {
    // Create a folder
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createFolder({ name: 'My Folder', orderIndex: 0 })
    })

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Folder selector should be visible
    const folderSelect = page.getByTestId('folder-select')
    await expect(folderSelect).toBeVisible()
    await expect(folderSelect).toContainText('No folder (root)')

    // Open dropdown and select folder
    await folderSelect.locator('button').first().click()
    await folderSelect.getByText('My Folder').click()

    // Should now show selected folder
    await expect(folderSelect).toContainText('My Folder')
  })

  test('import to folder: snippets get assigned to selected folder', async ({ page }) => {
    // Create a folder
    const folderId = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const folder = store.getState().createFolder({ name: 'Target Folder', orderIndex: 0 })
      return folder.id
    })

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Select the folder
    const folderSelect = page.getByTestId('folder-select')
    await folderSelect.locator('button').first().click()
    await folderSelect.getByText('Target Folder').click()

    // Import
    await page.getByText('Import 3 snippets').click()

    // Verify snippets landed in the folder
    const result = await page.evaluate((fid) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return snippets.filter((s) => s.folderId === fid).map((s) => s.name)
    }, folderId)

    expect(result).toContain('Hello World')
    expect(result).toContain('Signature')
    expect(result).toContain('Debug Log')
    expect(result).toHaveLength(3)
  })

  test('full import flow: select subset, import to folder, verify store', async ({ page }) => {
    // Create a folder and existing snippet
    const folderId = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Hello World', text: 'pre-existing' })
      const folder = store.getState().createFolder({ name: 'Imports', orderIndex: 0 })
      return folder.id
    })

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Conflict badge should show
    await expect(page.getByTestId('duplicate-badge')).toHaveCount(1)

    // Deselect the conflicting "Hello World" snippet (click its checkbox row in the import modal)
    // The modal's snippet list contains rows with checkboxes; target the import modal content
    const modal = page.locator('.fixed.inset-0.z-50')
    const snippetRows = modal.locator('.space-y-2 > div')
    // First row is "Hello World"
    await snippetRows.first().click()
    await expect(page.getByText('Select all (2/3)')).toBeVisible()

    // Select target folder
    const folderSelect = page.getByTestId('folder-select')
    await folderSelect.locator('button').first().click()
    await folderSelect.getByText('Imports').click()

    // Import 2 snippets
    await page.getByText('Import 2 snippets').click()

    // Modal should close
    await expect(page.locator('text=Import from Raycast')).toHaveCount(0)

    // Verify store state
    const result = await page.evaluate((fid) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return {
        totalCount: snippets.length,
        inFolder: snippets.filter((s) => s.folderId === fid).map((s) => s.name).sort(),
        helloWorldCount: snippets.filter((s) => s.name === 'Hello World').length,
      }
    }, folderId)

    // Original Hello World + 2 imported = 3 total
    expect(result.totalCount).toBe(3)
    expect(result.inFolder).toEqual(['Debug Log', 'Signature'])
    // Only original Hello World, not imported duplicate
    expect(result.helloWorldCount).toBe(1)
  })
})
