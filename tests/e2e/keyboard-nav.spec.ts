import { test, expect } from '@playwright/test'

test.describe('Keyboard Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('arrow keys navigate between snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet } = store.getState()
      createSnippet({ name: 'Snippet A', text: 'a' })
      createSnippet({ name: 'Snippet B', text: 'b' })
      createSnippet({ name: 'Snippet C', text: 'c' })
    })

    // Click first snippet to establish selection
    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(0).click()

    // Arrow down to second snippet
    await page.keyboard.press('ArrowDown')
    const selectedId = await page.evaluate(() =>
      window.__snippetStore?.getState().selectedId
    )
    const snippetB = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets.find((s) => s.name === 'Snippet B')?.id
    )
    expect(selectedId).toBe(snippetB)

    // Arrow down again to third
    await page.keyboard.press('ArrowDown')
    const selectedId2 = await page.evaluate(() =>
      window.__snippetStore?.getState().selectedId
    )
    const snippetC = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets.find((s) => s.name === 'Snippet C')?.id
    )
    expect(selectedId2).toBe(snippetC)

    // Arrow up back to second
    await page.keyboard.press('ArrowUp')
    const selectedId3 = await page.evaluate(() =>
      window.__snippetStore?.getState().selectedId
    )
    expect(selectedId3).toBe(snippetB)
  })

  test('arrow keys wrap around list', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createSnippet } = store.getState()
      createSnippet({ name: 'First', text: 'a' })
      createSnippet({ name: 'Last', text: 'b' })
    })

    // Select last snippet
    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.nth(1).click()

    // Arrow down wraps to first
    await page.keyboard.press('ArrowDown')
    const selectedName = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) return null
      const { selectedId, snippets } = store.getState()
      return snippets.find((s) => s.id === selectedId)?.name
    })
    expect(selectedName).toBe('First')
  })

  test('arrow keys navigate between folders and snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet } = store.getState()
      createFolder({ name: 'My Folder', orderIndex: 0 })
      createSnippet({ name: 'Root Snippet', text: 'root' })
    })

    // Click the folder first
    const folderHeader = page.locator('[data-testid="folder-header"]').first()
    await folderHeader.click()

    // Arrow down should go to root snippet
    await page.keyboard.press('ArrowDown')
    const selectedId = await page.evaluate(() =>
      window.__snippetStore?.getState().selectedId
    )
    expect(selectedId).toBeTruthy()
  })

  test('escape closes inline rename for snippets', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Original', text: 'content' })
    })

    // Start rename via double-click
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.dblclick()

    const input = row.locator('input[type="text"]')
    await expect(input).toBeVisible()

    // Type a new name but press Escape
    await input.fill('Changed Name')
    await input.press('Escape')

    // Input should be gone, name unchanged
    await expect(input).not.toBeVisible()
    const name = await page.evaluate(() =>
      window.__snippetStore?.getState().snippets[0]?.name
    )
    expect(name).toBe('Original')
  })

  test('escape closes inline rename for folders', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createFolder({ name: 'Test Folder', orderIndex: 0 })
    })

    // Start rename via double-click
    const folderHeader = page.locator('[data-testid="folder-header"]').first()
    await folderHeader.dblclick()

    const input = folderHeader.locator('input[type="text"]')
    await expect(input).toBeVisible()

    // Type a new name but press Escape
    await input.fill('Changed Folder')
    await input.press('Escape')

    // Input should be gone, name unchanged
    await expect(input).not.toBeVisible()
    const name = await page.evaluate(() =>
      window.__snippetStore?.getState().folders[0]?.name
    )
    expect(name).toBe('Test Folder')
  })

  test('escape closes context menu', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Menu Test', text: 'content' })
    })

    // Open context menu
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await expect(page.locator('[role="menu"]')).toBeVisible()

    // Press Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('[role="menu"]')).not.toBeVisible()
  })

  test('context menu arrow key navigation', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Nav Test', text: 'content' })
    })

    // Open context menu
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })
    await expect(page.locator('[role="menu"]')).toBeVisible()

    // Arrow down focuses first menu item
    await page.keyboard.press('ArrowDown')
    const firstItem = page.locator('[role="menuitem"]').first()
    await expect(firstItem).toBeFocused()

    // Arrow down again focuses second item
    await page.keyboard.press('ArrowDown')
    const secondItem = page.locator('[role="menuitem"]').nth(1)
    await expect(secondItem).toBeFocused()

    // Arrow up goes back to first
    await page.keyboard.press('ArrowUp')
    await expect(firstItem).toBeFocused()
  })

  test('context menu Enter selects focused item', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Enter Test', text: 'content' })
    })

    // Open context menu
    const row = page.locator('[data-testid="snippet-row"]').first()
    await row.click({ button: 'right' })

    // Arrow down to Rename (first item), press Enter
    await page.keyboard.press('ArrowDown')
    await page.keyboard.press('Enter')

    // Should trigger rename - inline input visible
    const input = row.locator('input[type="text"]')
    await expect(input).toBeVisible()
  })

  test('focus-visible ring appears on snippet rows', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Focus Test', text: 'content' })
    })

    // Tab to snippet row - check it has focus-visible class ready
    const row = page.locator('[data-testid="snippet-row"]').first()
    const classes = await row.getAttribute('class')
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).toContain('focus-visible:ring-ring')
  })

  test('focus-visible ring on folder headers', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createFolder({ name: 'Focus Folder', orderIndex: 0 })
    })

    const folderHeader = page.locator('[data-testid="folder-header"]').first()
    const classes = await folderHeader.getAttribute('class')
    expect(classes).toContain('focus-visible:ring-2')
    expect(classes).toContain('focus-visible:ring-ring')
  })

  test('Enter on selected folder toggles expand/collapse', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { createFolder, createSnippet } = store.getState()
      const folder = createFolder({ name: 'Toggle Folder', orderIndex: 0 })
      createSnippet({ name: 'Inside', text: 'inside', folderId: folder.id })
    })

    // Click folder to select it
    const folderHeader = page.locator('[data-testid="folder-header"]').first()
    await folderHeader.click()

    // Folder should now be expanded (click toggles)
    const chevron = page.locator('[data-testid="folder-chevron"]').first()
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')

    // Press Enter to toggle (collapse)
    await page.keyboard.press('Enter')
    await expect(chevron).toHaveAttribute('aria-expanded', 'false')

    // Press Enter again to re-expand
    await page.keyboard.press('Enter')
    await expect(chevron).toHaveAttribute('aria-expanded', 'true')
  })
})
