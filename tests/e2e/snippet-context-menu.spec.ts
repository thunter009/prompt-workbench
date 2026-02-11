import { test, expect } from '@playwright/test'

test.describe('Snippet Context Menu', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('right-click shows snippet context menu with all actions', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Test Snippet', text: 'hello' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })

    const menu = page.locator('[data-testid="snippet-context-menu"]')
    await expect(menu).toBeVisible()
    await expect(menu.locator('[data-testid="ctx-rename"]')).toBeVisible()
    await expect(menu.locator('[data-testid="ctx-duplicate"]')).toBeVisible()
    await expect(menu.locator('[data-testid="ctx-move-to"]')).toBeVisible()
    await expect(menu.locator('[data-testid="snippet-delete"]')).toBeVisible()
  })

  test('duplicate creates copy with "(copy)" suffix', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Original', text: 'content' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="ctx-duplicate"]').click()

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(2)

    const names = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets.map((s) => s.name)
    )
    expect(names).toContain('Original')
    expect(names).toContain('Original (copy)')
  })

  test('delete shows confirmation then removes snippet', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Delete Me', text: 'bye' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="snippet-delete"]').click()

    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)
  })

  test('move to folder submenu lists folders and root', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, createFolder } = store.getState()
      createFolder({ name: 'My Folder', orderIndex: 0 })
      createSnippet({ name: 'Movable', text: 'move me' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="ctx-move-to"]').click()

    const submenu = page.locator('[data-testid="move-to-folder"]')
    await expect(submenu).toBeVisible()
    await expect(submenu.getByText('Root')).toBeVisible()
    await expect(submenu.getByText('My Folder')).toBeVisible()

    // Move to folder
    await submenu.getByText('My Folder').click()

    const folderId = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets.find((s) => s.name === 'Movable')?.folderId
    )
    expect(folderId).toBeTruthy()
  })

  test('multi-select shows count in delete label', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet } = store.getState()
      createSnippet({ name: 'A', text: 'a' })
      createSnippet({ name: 'B', text: 'b' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })
    await rows.nth(1).click({ button: 'right' })

    await expect(page.locator('[data-testid="snippet-delete"]')).toContainText('Delete (2)')
  })

  test('escape dismisses context menu', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Test', text: 'x' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await expect(page.locator('[data-testid="snippet-context-menu"]')).toBeVisible()

    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="snippet-context-menu"]')).not.toBeVisible()
  })

  test('rename via context menu triggers inline edit', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Old Name', text: 'content' })
    })

    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await page.locator('[data-testid="ctx-rename"]').click()

    const input = row.locator('input[type="text"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()

    await input.fill('New Name')
    await input.press('Enter')

    await expect(row).toContainText('New Name')
  })
})
