import { test, expect } from '@playwright/test'

test.describe('Snippet CRUD & Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('context menu shows full CRUD options on right-click', async ({ page }) => {
    // Seed a snippet
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Test Snippet', text: 'hello' })
    })

    // Right-click the snippet
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })

    // Verify all menu items are visible
    await expect(page.locator('[data-testid="ctx-rename"]')).toBeVisible()
    await expect(page.locator('[data-testid="ctx-duplicate"]')).toBeVisible()
    await expect(page.locator('[data-testid="ctx-move-to"]')).toBeVisible()
    await expect(page.locator('[data-testid="ctx-export"]')).toBeVisible()
    await expect(page.locator('[data-testid="snippet-delete"]')).toBeVisible()
  })

  test('delete snippet via context menu with confirmation', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Delete Me', text: 'bye' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()

    // Confirmation dialog appears
    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await expect(page.getByText(/Delete Me.*will be permanently deleted/)).toBeVisible()

    // Confirm
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    // Snippet gone
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)
  })

  test('cancel delete does not remove snippet', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Keep Me', text: 'stay' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()
    await page.locator('[data-testid="snippet-delete-cancel"]').click()

    // Snippet still there
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
  })

  test('bulk delete multiple snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet } = store.getState()
      createSnippet({ name: 'Snippet A', text: 'a' })
      createSnippet({ name: 'Snippet B', text: 'b' })
      createSnippet({ name: 'Snippet C', text: 'c' })
    })

    // Multi-select first two with Cmd+click
    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })

    // Right-click for context menu
    await rows.nth(1).click({ button: 'right' })
    await expect(page.locator('[data-testid="snippet-delete"]')).toContainText('Delete (2)')

    // Delete
    await page.locator('[data-testid="snippet-delete"]').click()
    await expect(page.getByText('Delete 2 Snippets?')).toBeVisible()
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    // Only one snippet left
    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('Snippet C')
  })

  test('duplicate snippet via context menu', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Original', text: 'content here' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="ctx-duplicate"]').click()

    // Two snippets now
    const rows = page.locator('[data-testid="snippet-row"]')
    await expect(rows).toHaveCount(2)

    // Verify via store
    const names = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      return store.getState().snippets.map((s) => s.name)
    })
    expect(names).toContain('Original')
    expect(names).toContain('Original (copy)')
  })

  test('rename snippet via context menu', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Old Name', text: 'content' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="ctx-rename"]').click()

    // Inline editor should be visible
    const input = row.locator('input[type="text"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    // Type new name and confirm
    await input.fill('New Name')
    await input.press('Enter')

    // Verify rename
    await expect(row).toContainText('New Name')
    const name = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets[0]?.name
    )
    expect(name).toBe('New Name')
  })

  test('move to folder via context menu', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, createFolder } = store.getState()
      createFolder({ name: 'Target Folder', orderIndex: 0 })
      createSnippet({ name: 'Movable', text: 'move me' })
    })

    // Click snippet, right-click for menu
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })

    // Open move-to submenu
    await page.locator('[data-testid="ctx-move-to"]').click()

    // Click "Target Folder" in the submenu (the button element, not the folder header span)
    await page.locator('button:text-is("Target Folder")').click()

    // Verify snippet moved via store
    const folderId = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      return store.getState().snippets.find((s) => s.name === 'Movable')?.folderId
    })
    expect(folderId).toBeTruthy()
  })

  test('Delete key opens delete confirmation for selected snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Deletable', text: 'content' })
    })

    // Select snippet
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click()

    // Press Delete/Backspace
    await page.keyboard.press('Backspace')

    // Confirmation should appear (keyboard shortcut uses page.tsx dialog)
    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await page.locator('[data-testid="kbd-delete-confirm"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)
  })

  test('Cmd+D duplicates selected snippet', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Dup Target', text: 'content' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click()

    await page.keyboard.press('Meta+d')
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(2)
  })

  test('undo delete restores snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Restore Me', text: 'content' })
    })

    // Select and delete (keyboard shortcut uses page.tsx dialog)
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click()
    await page.keyboard.press('Backspace')
    await page.locator('[data-testid="kbd-delete-confirm"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)

    // Undo
    await page.keyboard.press('Meta+z')

    // Snippet restored
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="snippet-row"]')).toContainText('Restore Me')
  })

  test('F2 starts inline rename', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'F2 Rename', text: 'content' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click()
    await page.keyboard.press('F2')

    const input = row.locator('input[type="text"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('F2 Rename')
  })
})
