import { test, expect } from '@playwright/test'

test.describe('Placeholder Autocomplete', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })

    // Seed a snippet so editor has content to work with
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet, selectSnippet } = store.getState()
      const snippet = createSnippet({ name: 'Test Snippet', text: 'hello ' })
      selectSnippet(snippet.id)
    })
    await page.waitForTimeout(200)
  })

  test('shows autocomplete dropdown when typing {', async ({ page }) => {
    // Focus the CodeMirror editor
    const editor = page.locator('.cm-editor .cm-content')
    await editor.click()

    // Move to end of content and type {
    await page.keyboard.press('End')
    await page.keyboard.type('{')

    // Autocomplete tooltip should appear
    const tooltip = page.locator('.cm-tooltip-autocomplete')
    await expect(tooltip).toBeVisible({ timeout: 3000 })

    // Should contain placeholder options
    await expect(tooltip).toContainText('{clipboard}')
    await expect(tooltip).toContainText('{date}')
    await expect(tooltip).toContainText('{uuid}')
  })

  test('filters completions as user types', async ({ page }) => {
    const editor = page.locator('.cm-editor .cm-content')
    await editor.click()
    await page.keyboard.press('End')

    // Type {da to filter to date/datetime/day
    await page.keyboard.type('{da')

    const tooltip = page.locator('.cm-tooltip-autocomplete')
    await expect(tooltip).toBeVisible({ timeout: 3000 })

    // Should show date-related items
    await expect(tooltip).toContainText('{date}')
    await expect(tooltip).toContainText('{datetime}')
    await expect(tooltip).toContainText('{day}')

    // Should NOT show unrelated items
    await expect(tooltip).not.toContainText('{clipboard}')
    await expect(tooltip).not.toContainText('{uuid}')
  })

  test('inserts placeholder on selection', async ({ page }) => {
    const editor = page.locator('.cm-editor .cm-content')
    await editor.click()
    await page.keyboard.press('End')

    await page.keyboard.type('{uu')

    const tooltip = page.locator('.cm-tooltip-autocomplete')
    await expect(tooltip).toBeVisible({ timeout: 3000 })

    // Verify {uuid} is shown and selected (aria-selected)
    const selected = tooltip.locator('[aria-selected="true"]')
    await expect(selected).toContainText('{uuid}')

    // Click on the completion item to accept it
    await selected.click()
    await page.waitForTimeout(200)

    // Editor content should contain the inserted placeholder
    const editorText = await editor.textContent()
    expect(editorText).toContain('{uuid}')
  })
})
