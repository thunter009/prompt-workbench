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

async function seedExistingSnippet(page: import('@playwright/test').Page, name: string, text: string) {
  await page.evaluate(
    ({ name, text }) => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name, text })
    },
    { name, text }
  )
}

test.describe('Import Conflict Resolution', () => {
  test.beforeEach(async ({ page }) => {
    await waitForApp(page)
  })

  test('conflict rows show resolution controls defaulting to Skip', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing content')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Resolution controls visible for conflicting snippet (index 0)
    const controls = page.getByTestId('conflict-resolution-0')
    await expect(controls).toBeVisible()

    // Skip button should be active by default
    const skipBtn = page.getByTestId('conflict-skip-0')
    await expect(skipBtn).toHaveClass(/bg-zinc-600/)

    // Non-conflict snippets should NOT have resolution controls
    await expect(page.getByTestId('conflict-resolution-1')).toHaveCount(0)
    await expect(page.getByTestId('conflict-resolution-2')).toHaveCount(0)
  })

  test('Skip resolution: snippet not imported', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing content')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Default is Skip — just import
    // Button shows 2 (non-conflict selected) since conflict defaults to skip
    await expect(page.getByText('Import 2 snippets')).toBeVisible()
    await page.getByText('Import 2 snippets').click()

    // Verify: only original Hello World, plus 2 imported non-conflicts
    const result = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return {
        total: snippets.length,
        helloWorlds: snippets.filter((s) => s.name.toLowerCase().includes('hello world')).map((s) => s.text),
      }
    })

    expect(result.total).toBe(3) // 1 existing + 2 imported
    expect(result.helloWorlds).toHaveLength(1)
    expect(result.helloWorlds[0]).toBe('existing content')
  })

  test('Replace resolution: existing snippet overwritten', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing content')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Click Replace for the conflict
    await page.getByTestId('conflict-replace-0').click()

    // Button count should now be 3
    await expect(page.getByText('Import 3 snippets')).toBeVisible()
    await page.getByText('Import 3 snippets').click()

    const result = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return {
        total: snippets.length,
        helloWorlds: snippets.filter((s) => s.name === 'Hello World'),
      }
    })

    // Should still be 3 total (replaced, not duplicated)
    expect(result.total).toBe(3)
    expect(result.helloWorlds).toHaveLength(1)
    expect(result.helloWorlds[0].text).toBe('Hello, {clipboard}!')
  })

  test('Keep Both resolution: imported with "(imported)" suffix', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing content')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Click Keep Both
    await page.getByTestId('conflict-keep-both-0').click()

    await expect(page.getByText('Import 3 snippets')).toBeVisible()
    await page.getByText('Import 3 snippets').click()

    const result = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return {
        total: snippets.length,
        names: snippets.map((s) => s.name).sort(),
      }
    })

    // 1 existing + 1 renamed import + 2 non-conflicts = 4
    expect(result.total).toBe(4)
    expect(result.names).toContain('Hello World')
    expect(result.names).toContain('Hello World (imported)')
  })

  test('mixed resolutions across multiple conflicts', async ({ page }) => {
    // Seed two existing snippets that will conflict
    await seedExistingSnippet(page, 'Hello World', 'existing hello')
    await seedExistingSnippet(page, 'Signature', 'existing sig')

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Both should show conflict badges
    await expect(page.getByTestId('import-conflict-badge')).toHaveCount(2)

    // Set Hello World to Replace, Signature to Keep Both
    await page.getByTestId('conflict-replace-0').click()
    await page.getByTestId('conflict-keep-both-1').click()

    // Import count: 1 replace + 1 keep-both + 1 non-conflict = 3
    await expect(page.getByText('Import 3 snippets')).toBeVisible()
    await page.getByText('Import 3 snippets').click()

    const result = await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      const { snippets } = store.getState()
      return {
        total: snippets.length,
        names: snippets.map((s) => s.name).sort(),
        helloText: snippets.find((s) => s.name === 'Hello World')?.text,
        sigOriginal: snippets.find((s) => s.name === 'Signature')?.text,
        sigImported: snippets.find((s) => s.name === 'Signature (imported)')?.text,
      }
    })

    // 2 existing + 1 keep-both copy + 1 non-conflict = 4 (replace doesn't add)
    expect(result.total).toBe(4)
    expect(result.helloText).toBe('Hello, {clipboard}!') // replaced
    expect(result.sigOriginal).toBe('existing sig') // kept
    expect(result.sigImported).toBe('Best regards,\nThom') // imported copy
  })

  test('bulk "Replace All" sets all conflicts to replace', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing hello')
    await seedExistingSnippet(page, 'Signature', 'existing sig')

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Both should show conflict badges
    await expect(page.getByTestId('import-conflict-badge')).toHaveCount(2)

    // Default: skip → 1 import (only non-conflict)
    await expect(page.getByText('Import 1 snippet')).toBeVisible()

    // Click bulk Replace All
    await page.getByTestId('bulk-replace').click()

    // All conflicts now set to replace → 3 imports
    await expect(page.getByText('Import 3 snippets')).toBeVisible()

    // Verify individual controls updated
    await expect(page.getByTestId('conflict-replace-0')).toHaveClass(/bg-blue-600/)
    await expect(page.getByTestId('conflict-replace-1')).toHaveClass(/bg-blue-600/)

    // Individual can still override after bulk
    await page.getByTestId('conflict-skip-0').click()
    await expect(page.getByText('Import 2 snippets')).toBeVisible()
  })

  test('switching resolution updates button count', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'existing')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Default: skip → 2 imports
    await expect(page.getByText('Import 2 snippets')).toBeVisible()

    // Switch to Replace → 3 imports
    await page.getByTestId('conflict-replace-0').click()
    await expect(page.getByText('Import 3 snippets')).toBeVisible()

    // Switch back to Skip → 2 imports
    await page.getByTestId('conflict-skip-0').click()
    await expect(page.getByText('Import 2 snippets')).toBeVisible()

    // Switch to Keep Both → 3 imports
    await page.getByTestId('conflict-keep-both-0').click()
    await expect(page.getByText('Import 3 snippets')).toBeVisible()
  })

  test('conflict diff panel expands on toggle click', async ({ page }) => {
    await seedExistingSnippet(page, 'Hello World', 'old content here')
    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Diff panel collapsed by default
    await expect(page.getByTestId('conflict-diff-panel-0')).toHaveCount(0)

    // Diff stats shown inline
    const stats = page.getByTestId('conflict-diff-stats-0')
    await expect(stats).toBeVisible()

    // Click toggle to expand
    await page.getByTestId('conflict-diff-toggle-0').click()
    const diffPanel = page.getByTestId('conflict-diff-panel-0')
    await expect(diffPanel).toBeVisible()

    // Should show diff content with +/- lines
    await expect(diffPanel.locator('text=old content here')).toBeVisible()
    await expect(diffPanel.locator('text=Hello, {clipboard}!')).toBeVisible()

    // Click toggle again to collapse
    await page.getByTestId('conflict-diff-toggle-0').click()
    await expect(page.getByTestId('conflict-diff-panel-0')).toHaveCount(0)
  })

  test('conflict diff shows keyword differences', async ({ page }) => {
    // Seed with a keyword that differs from import
    await page.evaluate(() => {
      const store = window.__snippetStore
      if (!store) throw new Error('Store not exposed')
      store.getState().createSnippet({ name: 'Hello World', text: 'Hello, {clipboard}!', keyword: '!old' })
    })

    await openImportModal(page)
    await uploadImportFile(page, IMPORT_SNIPPETS)

    // Expand diff
    await page.getByTestId('conflict-diff-toggle-0').click()
    const diffPanel = page.getByTestId('conflict-diff-panel-0')
    await expect(diffPanel).toBeVisible()

    // Should show keyword diff
    await expect(diffPanel.locator('text=Keyword:')).toBeVisible()
    await expect(diffPanel.locator('text=!old')).toBeVisible()
    await expect(diffPanel.locator('text=!hello')).toBeVisible()
  })
})
