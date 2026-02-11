import { test, expect } from '@playwright/test'

test.describe('Bulk Operations Toolbar', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('bulk toolbar appears when 2+ snippets selected via Cmd+Click', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createSnippet({ name: 'Alpha', text: 'a' })
      store.getState().createSnippet({ name: 'Beta', text: 'b' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    // No toolbar with 1 selected
    await expect(page.locator('[data-testid="bulk-toolbar"]')).not.toBeVisible()

    // Cmd+Click second
    await rows.nth(1).click({ modifiers: ['Meta'] })
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toBeVisible()
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toContainText('2 selected')
  })

  test('bulk delete triggers confirmation and deletes all selected', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createSnippet({ name: 'Del1', text: 'x' })
      store.getState().createSnippet({ name: 'Del2', text: 'y' })
      store.getState().createSnippet({ name: 'Keep', text: 'z' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })

    await page.locator('[data-testid="bulk-delete"]').click()

    // Confirmation dialog
    await expect(page.getByText('Delete 2 Snippets?')).toBeVisible()
    await page.locator('[data-testid="snippet-delete-confirm"]').click()

    // Only 1 snippet remains
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
  })

  test('bulk move shows folder dropdown and moves snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createFolder({ name: 'Target', orderIndex: 0 })
      store.getState().createSnippet({ name: 'Move1', text: 'a' })
      store.getState().createSnippet({ name: 'Move2', text: 'b' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })

    await page.locator('[data-testid="bulk-move"]').click()
    // Folder dropdown opens - click folder in the bulk toolbar dropdown
    const folderBtn = page.locator('[data-testid="bulk-toolbar"]').getByRole('button', { name: 'Target' })
    await expect(folderBtn).toBeVisible()
    await folderBtn.click()

    // Snippets moved - verify in store
    const folderIds = await page.evaluate(() => {
      return window.__snippetStore!.getState().snippets.map((s) => s.folderId)
    })
    expect(folderIds.every((id: string | undefined) => id !== undefined)).toBe(true)
  })

  test('Cmd+A selects all snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createSnippet({ name: 'S1', text: 'a' })
      store.getState().createSnippet({ name: 'S2', text: 'b' })
      store.getState().createSnippet({ name: 'S3', text: 'c' })
    })

    await page.keyboard.press('Meta+a')
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toBeVisible()
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toContainText('3 selected')
  })

  test('Escape clears selection and hides toolbar', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createSnippet({ name: 'S1', text: 'a' })
      store.getState().createSnippet({ name: 'S2', text: 'b' })
    })

    // Select all
    await page.keyboard.press('Meta+a')
    await expect(page.locator('[data-testid="bulk-toolbar"]')).toBeVisible()

    // Escape clears
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="bulk-toolbar"]')).not.toBeVisible()
  })

  test('clear selection button hides toolbar', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore!
      store.getState().createSnippet({ name: 'S1', text: 'a' })
      store.getState().createSnippet({ name: 'S2', text: 'b' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })

    await page.locator('[data-testid="bulk-clear"]').click()
    await expect(page.locator('[data-testid="bulk-toolbar"]')).not.toBeVisible()
  })
})
