import { test, expect } from '@playwright/test'

test.describe('Snippet keyboard shortcuts', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('Delete key opens delete confirmation for selected snippet', async ({ page }) => {
    await page.evaluate(() => {
      window.__snippetStore!.getState().createSnippet({ name: 'To Delete', text: 'bye' })
    })

    await page.locator('[data-testid="snippet-row"]').first().click()
    await page.keyboard.press('Backspace')

    await expect(page.getByText('Delete Snippet?')).toBeVisible()
    await page.locator('[data-testid="kbd-delete-confirm"]').click()
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(0)
  })

  test('Cmd+D duplicates selected snippet', async ({ page }) => {
    await page.evaluate(() => {
      window.__snippetStore!.getState().createSnippet({ name: 'Original', text: 'content' })
    })

    await page.locator('[data-testid="snippet-row"]').first().click()
    await page.keyboard.press('Meta+d')

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(2)
    const names = await page.evaluate(() =>
      window.__snippetStore!.getState().snippets.map((s) => s.name)
    )
    expect(names).toContain('Original')
    expect(names).toContain('Original (copy)')
  })

  test('F2 starts inline rename', async ({ page }) => {
    await page.evaluate(() => {
      window.__snippetStore!.getState().createSnippet({ name: 'Rename Me', text: 'content' })
    })

    await page.locator('[data-testid="snippet-row"]').first().click()
    await page.keyboard.press('F2')

    const input = page.locator('[data-testid="snippet-row"] input[type="text"]')
    await expect(input).toBeVisible()
    await expect(input).toBeFocused()
    await expect(input).toHaveValue('Rename Me')

    // Complete rename
    await input.fill('Renamed')
    await input.press('Enter')
    await expect(page.locator('[data-testid="snippet-row"]')).toContainText('Renamed')
  })

  test('Cmd+N creates a new snippet', async ({ page }) => {
    await page.keyboard.press('Meta+n')

    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
    const name = await page.evaluate(() =>
      window.__snippetStore!.getState().snippets[0]?.name
    )
    expect(name).toBe('New Snippet')
  })

  test('Cmd+Shift+N creates a new folder', async ({ page }) => {
    await page.keyboard.press('Meta+Shift+n')

    await expect(page.locator('[data-testid="folder-row"]')).toHaveCount(1)
    const folderName = await page.evaluate(() =>
      window.__snippetStore!.getState().folders[0]?.name
    )
    expect(folderName).toBe('New Folder')
  })

  test('shortcuts do not fire when typing in editor', async ({ page }) => {
    // Create a snippet and select it so editor is populated
    await page.evaluate(() => {
      window.__snippetStore!.getState().createSnippet({ name: 'Existing', text: 'hello' })
    })
    await page.locator('[data-testid="snippet-row"]').first().click()

    // Focus the CodeMirror editor
    await page.locator('.cm-editor .cm-content').click()

    // Press Backspace in editor - should NOT open delete dialog
    await page.keyboard.press('Backspace')
    await expect(page.getByText('Delete Snippet?')).not.toBeVisible()

    // Snippet should still exist
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)
  })

  test('bulk delete with Backspace on multi-selected snippets', async ({ page }) => {
    await page.evaluate(() => {
      const { createSnippet } = window.__snippetStore!.getState()
      createSnippet({ name: 'A', text: 'a' })
      createSnippet({ name: 'B', text: 'b' })
      createSnippet({ name: 'C', text: 'c' })
    })

    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()
    await rows.nth(1).click({ modifiers: ['Meta'] })

    await page.keyboard.press('Backspace')
    await expect(page.getByText('Delete 2 Snippets?')).toBeVisible()
    await page.locator('[data-testid="kbd-delete-confirm"]').click()

    await expect(rows).toHaveCount(1)
    await expect(rows.first()).toContainText('C')
  })
})
