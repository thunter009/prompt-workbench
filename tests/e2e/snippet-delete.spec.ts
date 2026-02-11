import { test, expect } from '@playwright/test'

test.describe('Snippet Delete with Undo', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('delete single snippet shows confirmation, deletes, and undo restores', async ({ page }) => {
    // Seed a snippet
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Undoable', text: 'restore me', keyword: 'kw1' })
    })

    // Right-click > Delete
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()

    // Confirmation dialog visible
    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await expect(page.getByText(/will be permanently deleted/)).toBeVisible()

    // Confirm deletion
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    // Snippet gone
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)

    // Toast with Undo button visible
    const undoButton = page.locator('[data-sonner-toast] button', { hasText: 'Undo' })
    await expect(undoButton).toBeVisible({ timeout: 3000 })

    // Click Undo
    await undoButton.click()
    await page.waitForTimeout(200)

    // Snippet restored
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)

    // Verify full state restored
    const restored = await page.evaluate(() => {
      const s = window.__snippetStore?.getState().snippets[0]
      return s ? { name: s.name, text: s.text, keyword: s.keyword } : null
    })
    expect(restored).toEqual({ name: 'Undoable', text: 'restore me', keyword: 'kw1' })
  })

  test('cancel delete keeps snippet', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Keep Me', text: 'stay' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()

    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await page.locator('[data-testid="snippet-delete-cancel"]').click()

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
  })

  test('bulk delete shows snippet names, max 5 shown + N more', async ({ page }) => {
    // Seed 7 snippets
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet } = store.getState()
      for (let i = 1; i <= 7; i++) {
        createSnippet({ name: `Snippet ${i}`, text: `text ${i}` })
      }
    })

    // Select all with shift
    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.first().click()
    await rows.last().click({ modifiers: ['Shift'] })

    // Right-click > Delete
    await rows.last().click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()

    // Dialog shows "7 Snippets"
    await expect(page.getByText('Delete 7 Snippets?')).toBeVisible()
    // Shows "+ 2 more" (7 - 5 = 2)
    await expect(page.getByText('+ 2 more')).toBeVisible()

    // Confirm and verify all deleted
    await page.locator('[data-testid="snippet-delete-confirm"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)

    // Undo restores all
    const undoButton = page.locator('[data-sonner-toast] button', { hasText: 'Undo' })
    await expect(undoButton).toBeVisible({ timeout: 3000 })
    await undoButton.click()
    await page.waitForTimeout(200)

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(7)
  })

  test('undo restores snippet to original folder', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet } = store.getState()
      const folder = createFolder({ name: 'MyFolder', orderIndex: 0 })
      createSnippet({ name: 'Nested', text: 'in folder', folderId: folder.id })
    })

    // Expand folder, right-click snippet
    await page.locator('[data-testid="folder-row"]').first().click()
    await page.waitForTimeout(100)
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)

    // Undo
    const undoButton = page.locator('[data-sonner-toast] button', { hasText: 'Undo' })
    await expect(undoButton).toBeVisible({ timeout: 3000 })
    await undoButton.click()
    await page.waitForTimeout(200)

    // Snippet back in original folder
    const folderId = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets.find((s) => s.name === 'Nested')?.folderId
    )
    const folderExists = await page.evaluate((fid) =>
      window.__snippetStore?.getState().folders.some((f) => f.id === fid), folderId
    )
    expect(folderId).toBeTruthy()
    expect(folderExists).toBe(true)
  })
})
