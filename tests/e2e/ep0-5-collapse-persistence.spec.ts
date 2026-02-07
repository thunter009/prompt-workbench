import { test, expect, type Page } from '@playwright/test'

const STORAGE_KEY = 'prompt-workbench-expanded-folders'

async function seedStore(page: Page) {
  return await page.evaluate(() => {
    const store = window.__snippetStore
    if (!store) throw new Error('Store not exposed on window')

    const { createFolder, createSnippet } = store.getState()

    const folderA = createFolder({ name: 'Folder A', orderIndex: 0 })
    const folderB = createFolder({ name: 'Folder B', orderIndex: 1 })
    const folderC = createFolder({ name: 'Folder C', orderIndex: 2 })

    createSnippet({ name: 'Snippet In A', text: 'in A', folderId: folderA.id })
    createSnippet({ name: 'Snippet In B', text: 'in B', folderId: folderB.id })
    createSnippet({ name: 'Snippet In C', text: 'in C', folderId: folderC.id })

    return {
      folderAId: folderA.id,
      folderBId: folderB.id,
      folderCId: folderC.id,
    }
  })
}

function folderRow(page: Page, folderId: string) {
  return page.locator(`[data-folder-id="${folderId}"]`)
}

function folderHeader(page: Page, folderId: string) {
  return page.locator(`[data-folder-id="${folderId}"] > [data-testid="folder-header"]`)
}

test.describe('Collapse State Persistence (US-5)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('expand persists — expand folder, reload, folder still expanded', async ({ page }) => {
    const ids = await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Expand Folder A
    await folderHeader(page, ids.folderAId).click()
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="folder-children"]')).toBeVisible()

    // Wait for localStorage write
    await page.waitForTimeout(100)

    // Reload
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Wait for localStorage restore
    await page.waitForTimeout(200)

    // Folder A should still be expanded
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="folder-children"]')).toBeVisible()
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet In A' })).toBeVisible()
  })

  test('collapse persists — collapse folder, reload, folder still collapsed', async ({ page }) => {
    const ids = await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Expand then collapse Folder A
    await folderHeader(page, ids.folderAId).click()
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="folder-children"]')).toBeVisible()
    await folderHeader(page, ids.folderAId).click()
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="folder-children"]')).not.toBeVisible()

    await page.waitForTimeout(100)

    // Reload
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })
    await page.waitForTimeout(200)

    // Folder A should still be collapsed
    await expect(folderRow(page, ids.folderAId).locator('[data-testid="folder-children"]')).not.toBeVisible()
  })

  test('Expand All — all folders open, children visible', async ({ page }) => {
    const ids = await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // All folders should start collapsed
    for (const id of [ids.folderAId, ids.folderBId, ids.folderCId]) {
      await expect(folderRow(page, id).locator('[data-testid="folder-children"]')).not.toBeVisible()
    }

    // Click Expand All button
    await page.locator('button[title="Expand all folders"]').click()
    await page.waitForTimeout(100)

    // All children should be visible
    for (const id of [ids.folderAId, ids.folderBId, ids.folderCId]) {
      await expect(folderRow(page, id).locator('[data-testid="folder-children"]')).toBeVisible()
    }
    await expect(page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet In A' })).toBeVisible()
    await expect(page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet In B' })).toBeVisible()
    await expect(page.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet In C' })).toBeVisible()
  })

  test('Collapse All — all folders close, children hidden', async ({ page }) => {
    const ids = await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Expand all first
    await page.locator('button[title="Expand all folders"]').click()
    await page.waitForTimeout(100)

    // Verify all expanded
    for (const id of [ids.folderAId, ids.folderBId, ids.folderCId]) {
      await expect(folderRow(page, id).locator('[data-testid="folder-children"]')).toBeVisible()
    }

    // Click Collapse All button
    await page.locator('button[title="Collapse all folders"]').click()
    await page.waitForTimeout(100)

    // All children should be hidden
    for (const id of [ids.folderAId, ids.folderBId, ids.folderCId]) {
      await expect(folderRow(page, id).locator('[data-testid="folder-children"]')).not.toBeVisible()
    }
  })

  test('localStorage correctness — expanded IDs stored correctly', async ({ page }) => {
    const ids = await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Expand Folder A and Folder C
    await folderHeader(page, ids.folderAId).click()
    await folderHeader(page, ids.folderCId).click()
    await page.waitForTimeout(100)

    // Check localStorage
    const stored = await page.evaluate(() => localStorage.getItem('prompt-workbench-expanded-folders'))
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!) as string[]
    expect(parsed).toContain(ids.folderAId)
    expect(parsed).toContain(ids.folderCId)
    expect(parsed).not.toContain(ids.folderBId)
  })

  test('orphan cleanup — fake ID removed from localStorage on load', async ({ page }) => {
    // Inject a fake ID into localStorage before seeding
    await page.evaluate((key) => {
      localStorage.setItem(key, JSON.stringify(['fake-orphan-id-12345']))
    }, STORAGE_KEY)

    // Reload to trigger restoration with orphan cleanup
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })

    // Wait for init + persist cycle
    await page.waitForTimeout(300)

    // localStorage should no longer contain the fake ID
    const stored = await page.evaluate(() => localStorage.getItem('prompt-workbench-expanded-folders'))
    expect(stored).not.toBeNull()
    const parsed = JSON.parse(stored!) as string[]
    expect(parsed).not.toContain('fake-orphan-id-12345')
  })
})
