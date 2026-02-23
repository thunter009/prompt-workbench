import { test, expect } from '@playwright/test'

test.beforeEach(async ({ page }) => {
  await page.goto('/')
  await page.evaluate(() => localStorage.clear())
  await page.reload()
  await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
  await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
})

function mockSuggestFolder(page: import('@playwright/test').Page) {
  return page.route('**/api/suggest-folder', async (route) => {
    const body = JSON.parse(route.request().postData() ?? '{}')
    const name: string = body.snippet?.name ?? ''

    if (name.includes('Email')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Email Templates', confidence: 0.9 }],
        }),
      })
    } else if (name.includes('Code')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Code Snippets', confidence: 0.85 }],
        }),
      })
    } else if (name.includes('Doc')) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          suggestions: [{ folder: 'Documentation', confidence: 0.8 }],
        }),
      })
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ suggestions: [] }),
      })
    }
  })
}

/** Seed 2 snippets in different suggestion groups, open modal, wait for analysis */
async function seedAndOpenModal(page: import('@playwright/test').Page) {
  await mockSuggestFolder(page)
  const text = 'This is a sufficiently long text for analysis purposes that exceeds thirty characters.'

  await page.evaluate((t) => {
    const store = window.__snippetStore!
    const { createSnippet } = store.getState()
    createSnippet({ name: 'Email Welcome', text: t })
    createSnippet({ name: 'Code Review', text: t })
  }, text)

  await page.locator('[data-testid="reorg-trigger"]').click()
  await expect(page.locator('[data-testid="reorg-modal"]')).toBeVisible()
  await expect(page.locator('[data-testid="reorg-loading"]')).not.toBeVisible({ timeout: 15000 })
}

// ── US-2: Inline Folder Rename ──────────────────────────────────────

test.describe('US-2: Inline Folder Rename', () => {
  test('click folder name opens inline edit, Enter confirms', async ({ page }) => {
    await seedAndOpenModal(page)

    // Click first folder name to enter edit mode
    const folderName = page.locator('[data-testid="reorg-folder-name"]').first()
    const originalName = await folderName.textContent()
    await folderName.click()

    // Input should appear with the folder name
    const input = page.locator('[data-testid="reorg-folder-rename-input"]')
    await expect(input).toBeVisible()
    await expect(input).toHaveValue(originalName!)

    // Type new name and press Enter
    await input.fill('Renamed Folder')
    await input.press('Enter')

    // Input should disappear, new name should exist somewhere in the folder list
    await expect(input).not.toBeVisible()
    const allNames = await page.locator('[data-testid="reorg-folder-name"]').allTextContents()
    expect(allNames).toContain('Renamed Folder')
    expect(allNames).not.toContain(originalName)
  })

  test('Escape cancels rename', async ({ page }) => {
    await seedAndOpenModal(page)

    const folderName = page.locator('[data-testid="reorg-folder-name"]').first()
    const originalName = await folderName.textContent()
    await folderName.click()

    const input = page.locator('[data-testid="reorg-folder-rename-input"]')
    await input.fill('Should Not Apply')
    await input.press('Escape')

    // Should revert to original name
    await expect(input).not.toBeVisible()
    const allNames = await page.locator('[data-testid="reorg-folder-name"]').allTextContents()
    expect(allNames).toContain(originalName)
    expect(allNames).not.toContain('Should Not Apply')
  })

  test('rename to existing folder auto-merges groups', async ({ page }) => {
    await seedAndOpenModal(page)

    // Should have 2 folder groups initially
    const folderNames = page.locator('[data-testid="reorg-folder-name"]')
    await expect(folderNames).toHaveCount(2)

    // Get the name of the second folder to rename first folder into it
    const targetName = await folderNames.nth(1).textContent()

    // Click first folder name to edit
    await folderNames.first().click()
    const input = page.locator('[data-testid="reorg-folder-rename-input"]')
    await input.fill(targetName!)
    await input.press('Enter')

    // Should now have only 1 folder group (merged)
    await expect(page.locator('[data-testid="reorg-folder-name"]')).toHaveCount(1)

    // All snippets should be in the merged group
    await expect(page.locator('[data-testid="reorg-suggestion-row"]')).toHaveCount(2)
  })
})

// ── US-3: Merge Folders ─────────────────────────────────────────────

test.describe('US-3: Merge Folders', () => {
  test('folder menu shows merge targets and merges on click', async ({ page }) => {
    await seedAndOpenModal(page)

    // Should start with 2 folder groups
    await expect(page.locator('[data-testid="reorg-folder-name"]')).toHaveCount(2)
    const targetName = await page.locator('[data-testid="reorg-folder-name"]').nth(1).textContent()

    // Open ⋯ menu on first folder
    await page.locator('[data-testid="reorg-folder-menu"]').first().click()

    // Should show "Merge into..." with the other folder as target
    const mergeTargets = page.locator('[data-testid="reorg-merge-target"]')
    await expect(mergeTargets).toHaveCount(1)
    await expect(mergeTargets.first()).toContainText(targetName!)

    // Click the merge target
    await mergeTargets.first().click()

    // Source folder should disappear, only target remains
    await expect(page.locator('[data-testid="reorg-folder-name"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="reorg-folder-name"]').first()).toContainText(targetName!)

    // All snippets preserved in merged group
    await expect(page.locator('[data-testid="reorg-suggestion-row"]')).toHaveCount(2)
  })

  test('selection state preserved after merge', async ({ page }) => {
    await seedAndOpenModal(page)

    // Deselect first snippet (click the row to toggle)
    await page.locator('[data-testid="reorg-suggestion-row"]').first().click()

    // Merge first folder into second
    await page.locator('[data-testid="reorg-folder-menu"]').first().click()
    await page.locator('[data-testid="reorg-merge-target"]').first().click()

    // Apply button should show 1 selected (one was deselected)
    await expect(page.locator('[data-testid="reorg-apply"]')).toContainText('Apply (1)')
  })
})

// ── US-4: Reassign Snippet to Different Folder ──────────────────────

test.describe('US-4: Reassign Snippet', () => {
  test('reassign button opens menu with other folders', async ({ page }) => {
    await seedAndOpenModal(page)

    // Click reassign button on first snippet
    await page.locator('[data-testid="reorg-reassign-btn"]').first().click()

    // Menu should be visible with targets
    const menu = page.locator('[data-testid="reorg-reassign-menu"]')
    await expect(menu).toBeVisible()

    // Should show at least the other folder as a target
    const targets = page.locator('[data-testid="reorg-reassign-target"]')
    await expect(targets).toHaveCount(1)

    // Should also show "New folder..." option
    await expect(page.locator('[data-testid="reorg-reassign-new-folder"]')).toBeVisible()
  })

  test('reassign snippet moves it to target folder', async ({ page }) => {
    await seedAndOpenModal(page)

    const targetName = await page.locator('[data-testid="reorg-folder-name"]').nth(1).textContent()

    // Get snippet name from first group
    const snippetName = await page.locator('[data-testid="reorg-suggestion-row"]').first().locator('span.truncate').textContent()

    // Click reassign on first snippet
    await page.locator('[data-testid="reorg-reassign-btn"]').first().click()
    await page.locator('[data-testid="reorg-reassign-target"]').first().click()

    // First folder group should now have 0 snippets (and disappear)
    // Second folder should have both snippets
    await expect(page.locator('[data-testid="reorg-folder-name"]')).toHaveCount(1)
    await expect(page.locator('[data-testid="reorg-folder-name"]').first()).toContainText(targetName!)
    await expect(page.locator('[data-testid="reorg-suggestion-row"]')).toHaveCount(2)
  })

  test('"New folder..." creates new group and moves snippet', async ({ page }) => {
    await seedAndOpenModal(page)

    // Click reassign on first snippet
    await page.locator('[data-testid="reorg-reassign-btn"]').first().click()

    // Click "New folder..."
    await page.locator('[data-testid="reorg-reassign-new-folder"]').click()

    // Type new folder name and press Enter
    const newFolderInput = page.locator('[data-testid="reorg-reassign-new-folder-input"]')
    await expect(newFolderInput).toBeVisible()
    await newFolderInput.fill('Brand New Folder')
    await newFolderInput.press('Enter')

    // Should now have 3 folder groups (original empty one disappears, so 2 original + 1 new - 1 empty = 2)
    // Actually: first folder had 1 snippet, moved out → empty → disappears. So 2 groups remain.
    await expect(page.locator('[data-testid="reorg-folder-name"]')).toHaveCount(2)

    // One of them should be "Brand New Folder"
    const allFolderNames = await page.locator('[data-testid="reorg-folder-name"]').allTextContents()
    expect(allFolderNames).toContain('Brand New Folder')
  })

  test('apply works correctly after reassign', async ({ page }) => {
    await seedAndOpenModal(page)

    const targetName = await page.locator('[data-testid="reorg-folder-name"]').nth(1).textContent()

    // Reassign first snippet to second folder
    await page.locator('[data-testid="reorg-reassign-btn"]').first().click()
    await page.locator('[data-testid="reorg-reassign-target"]').first().click()

    // Apply
    await page.locator('[data-testid="reorg-apply"]').click()
    await expect(page.locator('[data-testid="reorg-done"]')).toBeVisible()

    // Close and verify state
    await page.locator('[data-testid="reorg-close-done"]').click()

    const state = await page.evaluate(() => {
      const store = window.__snippetStore!
      const { folders, snippets } = store.getState()
      return { folders, snippets }
    })

    // Only the target folder should exist (source was empty and disappeared)
    const folderNames = state.folders.map((f: { name: string }) => f.name)
    expect(folderNames).toContain(targetName)

    // Both snippets should be in the target folder
    const targetFolder = state.folders.find((f: { name: string }) => f.name === targetName)
    const inTarget = state.snippets.filter((s: { folderId?: string }) => s.folderId === targetFolder!.id)
    expect(inTarget).toHaveLength(2)
  })
})
