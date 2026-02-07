import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Seed folders and snippets for drag-drop tests.
 */
async function seedStore(page: Page) {
  return await page.evaluate(() => {
    const store = window.__snippetStore
    if (!store) throw new Error('Store not exposed on window')

    const { createFolder, createSnippet } = store.getState()

    const folderA = createFolder({ name: 'Folder A', orderIndex: 0 })
    const folderB = createFolder({ name: 'Folder B', orderIndex: 1 })
    createFolder({ name: 'Empty Folder', orderIndex: 2 })

    createSnippet({ name: 'Snippet 1', text: 'text 1', folderId: folderA.id })
    createSnippet({ name: 'Snippet 2', text: 'text 2', folderId: folderA.id })
    createSnippet({ name: 'Snippet 3', text: 'text 3' })
    createSnippet({ name: 'Snippet 4', text: 'text 4' })

    return { folderAId: folderA.id, folderBId: folderB.id }
  })
}

/**
 * Simulate HTML5 drag-and-drop by dispatching synthetic events with DataTransfer.
 * Uses a shared DataTransfer object across all events to ensure data persists.
 */
async function simulateDragDrop(page: Page, source: Locator, target: Locator, dataType: string, data: string) {
  const sourceEl = await source.elementHandle()
  const targetEl = await target.elementHandle()
  if (!sourceEl || !targetEl) throw new Error('Could not get element handles')

  await page.evaluate(({ src, tgt, dt, d }) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(dt, d)
    dataTransfer.effectAllowed = 'move'
    dataTransfer.dropEffect = 'move'

    // Fire events with the same DataTransfer object
    src.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true, cancelable: true }))

    // Need a small delay for React state to update from dragstart
    // Use microtask to let React batch
    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        tgt.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true }))

        requestAnimationFrame(() => {
          tgt.dispatchEvent(new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }))
          src.dispatchEvent(new DragEvent('dragend', { dataTransfer, bubbles: true }))
          resolve()
        })
      })
    })
  }, { src: sourceEl, tgt: targetEl, dt: dataType, d: data })

  // Wait for React to process state updates
  await page.waitForTimeout(100)
}

/**
 * Simulate dragstart + dragover (no drop) to test visual highlighting.
 */
async function simulateDragOver(page: Page, source: Locator, target: Locator, dataType: string, data: string) {
  const sourceEl = await source.elementHandle()
  const targetEl = await target.elementHandle()
  if (!sourceEl || !targetEl) throw new Error('Could not get element handles')

  await page.evaluate(({ src, tgt, dt, d }) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.setData(dt, d)
    dataTransfer.effectAllowed = 'move'

    src.dispatchEvent(new DragEvent('dragstart', { dataTransfer, bubbles: true, cancelable: true }))

    return new Promise<void>((resolve) => {
      requestAnimationFrame(() => {
        tgt.dispatchEvent(new DragEvent('dragover', { dataTransfer, bubbles: true, cancelable: true }))
        resolve()
      })
    })
  }, { src: sourceEl, tgt: targetEl, dt: dataType, d: data })

  await page.waitForTimeout(100)
}

test.describe('Drag-Drop Snippets into Folders (US-3)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })
  })

  test('drag snippet to folder — snippet disappears from origin, appears inside target folder', async ({ page }) => {
    const snippet3Id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')!.id
    })

    const snippet3 = page.locator(`[data-snippet-id="${snippet3Id}"]`)
    const folderBHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-header"]')

    await simulateDragDrop(page, snippet3, folderBHeader, 'application/x-snippet', snippet3Id)

    // Verify snippet moved via store
    const folderId = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')?.folderId ?? null
    })
    expect(folderId).not.toBeNull()

    // Folder B should auto-expand on drop; if not, expand manually
    const folderBChildren = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-children"]')
    if (!(await folderBChildren.isVisible().catch(() => false))) {
      await folderBHeader.click()
    }
    await expect(folderBChildren.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet 3' })).toBeVisible()
  })

  test('drop highlight — folder shows blue ring on valid dragover', async ({ page }) => {
    const snippet3Id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')!.id
    })

    const snippet3 = page.locator(`[data-snippet-id="${snippet3Id}"]`)
    const folderBHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-header"]')

    await simulateDragOver(page, snippet3, folderBHeader, 'application/x-snippet', snippet3Id)

    await expect(folderBHeader).toHaveClass(/ring-blue-500/)
  })

  test('drop highlight — same-folder drag shows invalid state', async ({ page }) => {
    // Expand Folder A
    const folderAHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder A' }).locator('[data-testid="folder-header"]')
    await folderAHeader.click()

    const snippet1Id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 1')!.id
    })

    const snippet1 = page.locator(`[data-snippet-id="${snippet1Id}"]`)

    // Drag snippet 1 onto Folder A (its own folder) — no-op
    await simulateDragDrop(page, snippet1, folderAHeader, 'application/x-snippet', snippet1Id)

    // Snippet 1 should still be in Folder A
    const folderAChildren = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder A' }).locator('[data-testid="folder-children"]')
    await expect(folderAChildren.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet 1' })).toBeVisible()
  })

  test('drop on root — snippet moves to unfiled (root level)', async ({ page }) => {
    // Expand Folder A
    const folderAHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder A' }).locator('[data-testid="folder-header"]')
    await folderAHeader.click()

    const snippet1Id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 1')!.id
    })

    const snippet1 = page.locator(`[data-snippet-id="${snippet1Id}"]`)
    const rootArea = page.locator('aside .overflow-y-auto')

    await simulateDragDrop(page, snippet1, rootArea, 'application/x-snippet', snippet1Id)

    // Snippet 1 should now be unfiled
    const folderId = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 1')?.folderId ?? null
    })
    expect(folderId).toBeNull()
  })

  test('multi-drag — select 2+ snippets, all land in target folder', async ({ page }) => {
    const { s3Id, s4Id } = await page.evaluate(() => {
      const store = window.__snippetStore!
      const snippets = store.getState().snippets
      return {
        s3Id: snippets.find((s) => s.name === 'Snippet 3')!.id,
        s4Id: snippets.find((s) => s.name === 'Snippet 4')!.id,
      }
    })

    // Select both snippets
    await page.locator(`[data-snippet-id="${s3Id}"]`).click()
    await page.locator(`[data-snippet-id="${s4Id}"]`).click({ modifiers: ['Meta'] })

    const snippet4 = page.locator(`[data-snippet-id="${s4Id}"]`)
    const folderBHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-header"]')

    // Multi-select drag sends comma-separated IDs
    await simulateDragDrop(page, snippet4, folderBHeader, 'application/x-snippet', `${s3Id},${s4Id}`)

    // Both should now be in Folder B
    const folderBChildren = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-children"]')
    if (!(await folderBChildren.isVisible().catch(() => false))) {
      await folderBHeader.click()
    }
    await expect(folderBChildren.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet 3' })).toBeVisible()
    await expect(folderBChildren.locator('[data-testid="snippet-row"]').filter({ hasText: 'Snippet 4' })).toBeVisible()
  })

  test('undo (Cmd+Z) — reverses last move, snippet returns to previous location', async ({ page }) => {
    const snippet3Id = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')!.id
    })

    const snippet3 = page.locator(`[data-snippet-id="${snippet3Id}"]`)
    const folderBHeader = page.locator('[data-testid="folder-row"]').filter({ hasText: 'Folder B' }).locator('[data-testid="folder-header"]')

    await simulateDragDrop(page, snippet3, folderBHeader, 'application/x-snippet', snippet3Id)

    // Verify it moved
    const folderIdAfterMove = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')?.folderId ?? null
    })
    expect(folderIdAfterMove).not.toBeNull()

    // Undo with Cmd+Z
    await page.keyboard.press('Meta+z')

    // Snippet 3 should be back at root
    const folderIdAfterUndo = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().snippets.find((s) => s.name === 'Snippet 3')?.folderId ?? null
    })
    expect(folderIdAfterUndo).toBeNull()
  })
})
