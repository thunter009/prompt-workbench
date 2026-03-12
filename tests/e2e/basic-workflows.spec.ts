import { test, expect } from '@playwright/test'

test.describe('Basic Workflows', () => {
  test.beforeEach(async ({ page, request }) => {
    const cleanupResponse = await request.delete('/api/db/test-cleanup')
    expect(cleanupResponse.ok()).toBeTruthy()
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('smoke: app loads with store exposed', async ({ page }) => {
    await expect(page.getByText('Prompt Workbench')).toBeVisible()
    const hasStore = await page.evaluate(() => !!window.__snippetStore)
    expect(hasStore).toBe(true)
  })

  test('create snippet via Cmd+N and verify in store', async ({ page }) => {
    await page.keyboard.press('Meta+n')
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(1)

    // Verify snippet was created in store
    const name = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      return store.getState().snippets[0]?.name
    })
    expect(name).toBe('New Snippet')
  })

  test('tab switching: Preview and Playground tabs', async ({ page }) => {
    // Track page errors to detect infinite loops
    const pageErrors: string[] = []
    page.on('pageerror', (err) => pageErrors.push(err.message))

    // Seed a snippet and click to select
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      store.getState().createSnippet({ name: 'Tab Test', text: 'Some **markdown** content' })
    })
    await page.locator('[data-testid="snippet-row"]').first().click()

    // Tab buttons should be visible (use first() — there are tabs in both page header and preview panel)
    const previewBtn = page.locator('button', { hasText: 'Preview' }).first()
    const playgroundBtn = page.locator('button', { hasText: 'Playground' }).first()
    await expect(previewBtn).toBeVisible({ timeout: 5000 })
    await expect(playgroundBtn).toBeVisible({ timeout: 5000 })

    // Switch to Playground tab — should NOT crash
    await playgroundBtn.click()
    await page.waitForTimeout(1000)

    // No infinite loop errors
    const loopErrors = pageErrors.filter((e) => e.includes('Maximum update depth'))
    expect(loopErrors).toHaveLength(0)

    // App should not have crashed
    await expect(page.locator('h2:has-text("Application error")')).not.toBeVisible()

    // Switch back to Preview — should work
    await previewBtn.click()
    await expect(playgroundBtn).toBeVisible()
  })

  test('folder navigation: clicking folder shows its snippets', async ({ page }) => {
    // Seed folder + snippets
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      const { createFolder, createSnippet } = store.getState()
      const folder = createFolder({ name: 'My Folder', orderIndex: 0 })
      createSnippet({ name: 'Inside Folder', text: 'in folder', folderId: folder.id })
      createSnippet({ name: 'Root Snippet', text: 'at root' })
    })

    // Both snippets should be visible initially
    await expect(page.locator('[data-testid="snippet-row"]')).toHaveCount(2, { timeout: 3000 })

    // Folder header should be visible
    const folderHeader = page.locator('[data-testid="folder-header"]').first()
    await expect(folderHeader).toBeVisible()
    await expect(folderHeader).toContainText('My Folder')

    // Click folder to select/expand it
    await folderHeader.click()
    await expect(page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Inside Folder' })).toBeVisible()
  })

  test('snippet selection updates store selectedId', async ({ page }) => {
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      const { createSnippet } = store.getState()
      createSnippet({ name: 'First', text: 'content one' })
      createSnippet({ name: 'Second', text: 'content two' })
    })

    // Click first snippet
    const rows = page.locator('[data-testid="snippet-row"]')
    await rows.filter({ hasText: 'First' }).click()

    // Verify selectedId in store
    const selectedName1 = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      const state = store.getState()
      return state.snippets.find(s => s.id === state.selectedId)?.name
    })
    expect(selectedName1).toBe('First')

    // Click second snippet
    await rows.filter({ hasText: 'Second' }).click()

    const selectedName2 = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('No store')
      const state = store.getState()
      return state.snippets.find(s => s.id === state.selectedId)?.name
    })
    expect(selectedName2).toBe('Second')
  })

  test('selecting snippet renders content in CodeMirror editor', async ({ page }) => {
    // Wait for store hydration to complete
    await page.waitForFunction(() => {
      return window.__snippetStore?.getState().hydrated === true
    }, { timeout: 10000 })

    // Seed a snippet with unique content
    const id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().createSnippet({ name: 'EditorTest', text: 'unique-editor-test-99999' }).id
    })

    // Select snippet via store and wait for store to confirm
    await page.evaluate((id) => {
      window.__snippetStore!.getState().selectSnippet(id)
    }, id)
    await page.waitForFunction((expectedId) => {
      return window.__snippetStore?.getState().selectedId === expectedId
    }, id, { timeout: 5000 })

    const editor = page.locator('.cm-content')
    await expect(editor).toBeVisible({ timeout: 5000 })
    await expect(editor).toContainText('unique-editor-test-99999', { timeout: 5000 })

    // Verify switching snippets updates editor content
    const id2 = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().createSnippet({ name: 'EditorTest2', text: 'switched-content-88888' }).id
    })
    await page.evaluate((id) => {
      window.__snippetStore!.getState().selectSnippet(id)
    }, id2)
    await expect(editor).toContainText('switched-content-88888', { timeout: 5000 })
  })
})
