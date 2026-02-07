import { test, expect } from '@playwright/test'

test.describe('Folder Management (US-2)', () => {
  test.beforeEach(async ({ page }) => {
    // Clear localStorage before each test
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('New Folder button creates folder with inline edit active and input focused', async ({ page }) => {
    // Click the "New folder" button (FolderPlus icon with title="New folder")
    await page.click('button[title="New folder"]')

    // Folder row should appear
    const folderRow = page.locator('[data-testid="folder-row"]')
    await expect(folderRow).toHaveCount(1)

    // Inline edit input should be visible and focused
    const input = folderRow.locator('input[type="text"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('New Folder')
  })

  test('Inline rename — type + Enter saves', async ({ page }) => {
    await page.click('button[title="New folder"]')

    const folderRow = page.locator('[data-testid="folder-row"]')
    const input = folderRow.locator('input[type="text"]')
    await expect(input).toBeFocused()

    // Clear and type new name
    await input.fill('My Custom Folder')
    await input.press('Enter')

    // Input should disappear, name should be visible
    await expect(input).not.toBeVisible()
    await expect(folderRow).toContainText('My Custom Folder')
  })

  test('Inline rename — Escape cancels', async ({ page }) => {
    await page.click('button[title="New folder"]')

    const folderRow = page.locator('[data-testid="folder-row"]')
    const input = folderRow.locator('input[type="text"]')
    await expect(input).toBeFocused()

    // Type something then cancel
    await input.fill('Cancelled Name')
    await input.press('Escape')

    // Input should disappear, original name should remain
    await expect(input).not.toBeVisible()
    // Original default name "New Folder" stays because escape doesn't save
    await expect(folderRow).toContainText('New Folder')
  })

  test('Double-click folder name opens inline editor', async ({ page }) => {
    // Create and name a folder
    await page.click('button[title="New folder"]')
    const input = page.locator('[data-testid="folder-row"] input[type="text"]')
    await input.fill('Test Folder')
    await input.press('Enter')

    // Double-click the folder name
    const folderHeader = page.locator('[data-testid="folder-header"]')
    await folderHeader.dblclick()

    // Inline editor should open
    const editInput = page.locator('[data-testid="folder-row"] input[type="text"]')
    await expect(editInput).toBeVisible()
    await expect(editInput).toHaveValue('Test Folder')
  })

  test('Subfolder creation via right-click context menu', async ({ page }) => {
    // Create parent folder
    await page.click('button[title="New folder"]')
    const input = page.locator('[data-testid="folder-row"] input[type="text"]')
    await input.fill('Parent')
    await input.press('Enter')

    // Right-click to open context menu
    const folderHeader = page.locator('[data-testid="folder-header"]')
    await folderHeader.click({ button: 'right' })

    // Click "New Subfolder"
    const subfolderBtn = page.getByText('New Subfolder')
    await expect(subfolderBtn).toBeVisible()
    await subfolderBtn.click()

    // Child folder should appear (parent auto-expanded)
    const childInput = page.locator('[data-testid="folder-row"][data-depth="1"] input[type="text"]')
    await expect(childInput).toBeVisible()
    await childInput.fill('Child')
    await childInput.press('Enter')

    // Verify child is nested
    const childRow = page.locator('[data-testid="folder-row"][data-depth="1"]')
    await expect(childRow).toContainText('Child')
  })

  test('Max depth enforcement — no subfolder option at level 3', async ({ page }) => {
    // Create 3-level deep folder structure via store
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder } = store.getState()
      const level0 = createFolder({ name: 'Level 0', orderIndex: 0 })
      const level1 = createFolder({ name: 'Level 1', parentId: level0.id, orderIndex: 0 })
      createFolder({ name: 'Level 2', parentId: level1.id, orderIndex: 0 })
    })

    // Expand all folders
    await page.click('button[title="Expand all folders"]')

    // Right-click on depth=2 folder (Level 2)
    const level2Header = page.locator('[data-testid="folder-row"][data-depth="2"] [data-testid="folder-header"]')
    await level2Header.click({ button: 'right' })

    // "New Subfolder" should NOT be visible
    const subfolderBtn = page.getByText('New Subfolder')
    await expect(subfolderBtn).not.toBeVisible()

    // Other options like "Delete Folder" should still appear
    await expect(page.getByText('Delete Folder')).toBeVisible()
  })

  test('Delete empty folder — removes immediately, no confirm dialog', async ({ page }) => {
    // Create an empty folder
    await page.click('button[title="New folder"]')
    const input = page.locator('[data-testid="folder-row"] input[type="text"]')
    await input.fill('Empty')
    await input.press('Enter')

    // Right-click and delete
    const folderHeader = page.locator('[data-testid="folder-header"]')
    await folderHeader.click({ button: 'right' })
    await page.getByText('Delete Folder').click()

    // No confirm dialog should appear
    await expect(page.getByText('Delete Folder?')).not.toBeVisible()

    // Folder should be gone
    await expect(page.locator('[data-testid="folder-row"]')).toHaveCount(0)
  })

  test('Delete non-empty folder — shows confirm, contents orphaned to parent/root', async ({ page }) => {
    // Create folder with snippet inside
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet } = store.getState()
      const folder = createFolder({ name: 'NonEmpty', orderIndex: 0 })
      createSnippet({ name: 'Orphan Me', text: 'content', folderId: folder.id })
    })

    // Right-click folder and delete
    const folderHeader = page.locator('[data-testid="folder-header"]')
    await folderHeader.click({ button: 'right' })
    await page.getByText('Delete Folder').click()

    // Confirm dialog should appear
    await expect(page.getByText('Delete Folder?')).toBeVisible()

    // Click Delete to confirm
    await page.locator('button:has-text("Delete")').last().click()

    // Folder gone
    await expect(page.locator('[data-testid="folder-row"]')).toHaveCount(0)

    // Snippet should be at root level
    const orphanedSnippet = page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Orphan Me' })
    await expect(orphanedSnippet).toBeVisible()
  })

  test('localStorage persistence — create folder, reload page, folder still present', async ({ page }) => {
    // Create a folder
    await page.click('button[title="New folder"]')
    const input = page.locator('[data-testid="folder-row"] input[type="text"]')
    await input.fill('Persistent Folder')
    await input.press('Enter')

    // Verify it's there
    await expect(page.locator('[data-testid="folder-row"]')).toContainText('Persistent Folder')

    // Reload page
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })

    // Folder should still be there
    const folderRow = page.locator('[data-testid="folder-row"]')
    await expect(folderRow).toBeVisible()
    await expect(folderRow).toContainText('Persistent Folder')
  })
})
