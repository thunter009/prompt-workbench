import { test, expect, type Page, type Locator } from '@playwright/test'

/**
 * Seed folders (nested 3 levels) and snippets for folder drag-drop tests.
 *
 * Tree:
 *   Folder A (orderIndex 0)
 *     └─ Child A1 (orderIndex 0)
 *         └─ Deep A1a (orderIndex 0)
 *   Folder B (orderIndex 1)
 *   Folder C (orderIndex 2)
 *   Snippet 1 (root)
 */
async function seedStore(page: Page) {
  return await page.evaluate(() => {
    const store = window.__snippetStore
    if (!store) throw new Error('Store not exposed on window')

    const { createFolder, createSnippet } = store.getState()

    const folderA = createFolder({ name: 'Folder A', orderIndex: 0 })
    const childA1 = createFolder({ name: 'Child A1', parentId: folderA.id, orderIndex: 0 })
    const deepA1a = createFolder({ name: 'Deep A1a', parentId: childA1.id, orderIndex: 0 })
    const folderB = createFolder({ name: 'Folder B', orderIndex: 1 })
    const folderC = createFolder({ name: 'Folder C', orderIndex: 2 })

    createSnippet({ name: 'Snippet 1', text: 'text 1' })
    createSnippet({ name: 'Snippet In A', text: 'in A', folderId: folderA.id })

    return {
      folderAId: folderA.id,
      childA1Id: childA1.id,
      deepA1aId: deepA1a.id,
      folderBId: folderB.id,
      folderCId: folderC.id,
    }
  })
}

/**
 * Simulate folder drag-drop with precise Y-offset control for drop zone detection.
 * yRatio: 0.0 = top edge, 0.5 = middle, 1.0 = bottom edge
 */
async function simulateFolderDragDrop(
  page: Page,
  source: Locator,
  target: Locator,
  folderId: string,
  yRatio: number = 0.5,
) {
  const sourceEl = await source.elementHandle()
  const targetEl = await target.elementHandle()
  if (!sourceEl || !targetEl) throw new Error('Could not get element handles')

  await page.evaluate(
    ({ src, tgt, id, yR }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('application/x-folder', id)
      dataTransfer.effectAllowed = 'move'
      dataTransfer.dropEffect = 'move'

      src.dispatchEvent(
        new DragEvent('dragstart', { dataTransfer, bubbles: true, cancelable: true }),
      )

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          // Position mouse at the specified yRatio within the target
          const rect = tgt.getBoundingClientRect()
          const clientY = rect.top + rect.height * yR

          tgt.dispatchEvent(
            new DragEvent('dragover', {
              dataTransfer,
              bubbles: true,
              cancelable: true,
              clientY,
              clientX: rect.left + rect.width / 2,
            }),
          )

          requestAnimationFrame(() => {
            tgt.dispatchEvent(
              new DragEvent('drop', { dataTransfer, bubbles: true, cancelable: true }),
            )
            src.dispatchEvent(
              new DragEvent('dragend', { dataTransfer, bubbles: true }),
            )
            resolve()
          })
        })
      })
    },
    { src: sourceEl, tgt: targetEl, id: folderId, yR: yRatio },
  )

  await page.waitForTimeout(150)
}

/**
 * Simulate dragstart + dragover (no drop) with precise Y position to test visual indicators.
 */
async function simulateFolderDragOver(
  page: Page,
  source: Locator,
  target: Locator,
  folderId: string,
  yRatio: number = 0.5,
) {
  const sourceEl = await source.elementHandle()
  const targetEl = await target.elementHandle()
  if (!sourceEl || !targetEl) throw new Error('Could not get element handles')

  await page.evaluate(
    ({ src, tgt, id, yR }) => {
      const dataTransfer = new DataTransfer()
      dataTransfer.setData('application/x-folder', id)
      dataTransfer.effectAllowed = 'move'

      src.dispatchEvent(
        new DragEvent('dragstart', { dataTransfer, bubbles: true, cancelable: true }),
      )

      return new Promise<void>((resolve) => {
        requestAnimationFrame(() => {
          const rect = tgt.getBoundingClientRect()
          const clientY = rect.top + rect.height * yR

          tgt.dispatchEvent(
            new DragEvent('dragover', {
              dataTransfer,
              bubbles: true,
              cancelable: true,
              clientY,
              clientX: rect.left + rect.width / 2,
            }),
          )
          resolve()
        })
      })
    },
    { src: sourceEl, tgt: targetEl, id: folderId, yR: yRatio },
  )

  await page.waitForTimeout(150)
}

/** Helper to get a folder-header by folder ID (avoids hasText ambiguity with nested folders) */
function folderHeaderById(page: Page, folderId: string): Locator {
  return page.locator(`[data-folder-id="${folderId}"] > [data-testid="folder-header"]`)
}

/** Helper to get a folder-row by folder ID */
function folderRowById(page: Page, folderId: string): Locator {
  return page.locator(`[data-folder-id="${folderId}"]`)
}

/** Expand a folder by clicking its header */
async function expandFolder(page: Page, folderId: string) {
  const header = folderHeaderById(page, folderId)
  await header.click()
  await page.waitForTimeout(50)
}

test.describe('Drag-Drop Folder Reordering (US-4)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
    await seedStore(page)
    await page.waitForSelector('[data-testid="folder-row"]', { timeout: 5000 })
  })

  test('reorder siblings — drag Folder C before Folder A, verify new DOM order', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        aId: folders.find((f) => f.name === 'Folder A')!.id,
        cId: folders.find((f) => f.name === 'Folder C')!.id,
      }
    })

    const folderCHeader = folderHeaderById(page, ids.cId)
    const folderAHeader = folderHeaderById(page, ids.aId)

    // Drop in top 25% = "before" position
    await simulateFolderDragDrop(page, folderCHeader, folderAHeader, ids.cId, 0.1)

    // Verify DOM order: Folder C should now be first root folder
    const rootFolderNames = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store
        .getState()
        .folders.filter((f) => !f.parentId)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map((f) => f.name)
    })
    expect(rootFolderNames[0]).toBe('Folder C')
    expect(rootFolderNames[1]).toBe('Folder A')
    expect(rootFolderNames[2]).toBe('Folder B')
  })

  test('drop zone indicators — top 25% = blue line above, bottom 25% = blue line below, middle 50% = blue ring', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        aId: folders.find((f) => f.name === 'Folder A')!.id,
        bId: folders.find((f) => f.name === 'Folder B')!.id,
      }
    })

    const folderBHeader = folderHeaderById(page, ids.bId)
    const folderAHeader = folderHeaderById(page, ids.aId)
    const folderARow = folderRowById(page, ids.aId)

    // Test top zone (before) — blue line above
    await simulateFolderDragOver(page, folderBHeader, folderAHeader, ids.bId, 0.1)
    await expect(folderARow.locator('.bg-blue-500.-top-0\\.5')).toBeVisible()

    // Clear drag state
    await page.evaluate(() => {
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    })
    await page.waitForTimeout(50)

    // Test middle zone (inside) — blue ring
    await simulateFolderDragOver(page, folderBHeader, folderAHeader, ids.bId, 0.5)
    await expect(folderAHeader).toHaveClass(/ring-blue-500/)

    // Clear drag state
    await page.evaluate(() => {
      document.dispatchEvent(new DragEvent('dragend', { bubbles: true }))
    })
    await page.waitForTimeout(50)

    // Test bottom zone (after) — blue line below
    await simulateFolderDragOver(page, folderBHeader, folderAHeader, ids.bId, 0.9)
    await expect(folderARow.locator('.bg-blue-500.-bottom-0\\.5')).toBeVisible()
  })

  test('nest folder — drop in middle zone moves folder inside target, verify parent-child in DOM', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        bId: folders.find((f) => f.name === 'Folder B')!.id,
        aId: folders.find((f) => f.name === 'Folder A')!.id,
      }
    })

    const folderBHeader = folderHeaderById(page, ids.bId)
    const folderAHeader = folderHeaderById(page, ids.aId)

    // Drop B into A's middle zone
    await simulateFolderDragDrop(page, folderBHeader, folderAHeader, ids.bId, 0.5)

    // Verify via store that Folder B is now child of Folder A
    const parentId = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().folders.find((f) => f.name === 'Folder B')?.parentId ?? null
    })
    expect(parentId).toBe(ids.aId)

    // Folder A should auto-expand on drop; if not visible, click to expand
    const folderAChildren = folderRowById(page, ids.aId).locator('[data-testid="folder-children"]')
    if (!(await folderAChildren.isVisible().catch(() => false))) {
      await expandFolder(page, ids.aId)
    }
    await expect(
      folderAChildren.locator(`[data-folder-id="${ids.bId}"]`),
    ).toBeVisible()
  })

  test('max depth prevention — dragging folder with children into deep folder shows red ring, move rejected', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        aId: folders.find((f) => f.name === 'Folder A')!.id,
        childA1Id: folders.find((f) => f.name === 'Child A1')!.id,
        deepA1aId: folders.find((f) => f.name === 'Deep A1a')!.id,
        bId: folders.find((f) => f.name === 'Folder B')!.id,
      }
    })

    // Expand all to see Deep A1a
    await expandFolder(page, ids.aId)
    await expandFolder(page, ids.childA1Id)

    const folderBHeader = folderHeaderById(page, ids.bId)
    const deepA1aHeader = folderHeaderById(page, ids.deepA1aId)

    // Deep A1a is at depth 2 (0-indexed), so child would be at depth 3
    // which exceeds MAX_DEPTH-1=2
    await simulateFolderDragOver(page, folderBHeader, deepA1aHeader, ids.bId, 0.5)

    // Should show red ring for invalid drop
    await expect(deepA1aHeader).toHaveClass(/ring-red-500/)

    // Attempt the drop — should be rejected
    await simulateFolderDragDrop(page, folderBHeader, deepA1aHeader, ids.bId, 0.5)

    // Folder B should still be at root
    const parentId = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().folders.find((f) => f.name === 'Folder B')?.parentId ?? null
    })
    expect(parentId).toBeNull()
  })

  test('circular prevention — dragging parent into its own descendant shows red ring, move rejected', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        aId: folders.find((f) => f.name === 'Folder A')!.id,
        childA1Id: folders.find((f) => f.name === 'Child A1')!.id,
      }
    })

    await expandFolder(page, ids.aId)

    const folderAHeader = folderHeaderById(page, ids.aId)
    const childA1Header = folderHeaderById(page, ids.childA1Id)

    // Drag Folder A into its own child Child A1 — circular!
    await simulateFolderDragOver(page, folderAHeader, childA1Header, ids.aId, 0.5)

    // Should show red ring for invalid (circular) drop
    await expect(childA1Header).toHaveClass(/ring-red-500/)

    // Attempt the drop — should be rejected
    await simulateFolderDragDrop(page, folderAHeader, childA1Header, ids.aId, 0.5)

    // Folder A should still be at root (no parent)
    const parentId = await page.evaluate(() => {
      const store = window.__snippetStore!
      return store.getState().folders.find((f) => f.name === 'Folder A')?.parentId ?? null
    })
    expect(parentId).toBeNull()
  })

  test('undo (Cmd+Z) — folder returns to previous parent and position', async ({ page }) => {
    const ids = await page.evaluate(() => {
      const store = window.__snippetStore!
      const folders = store.getState().folders
      return {
        bId: folders.find((f) => f.name === 'Folder B')!.id,
        aId: folders.find((f) => f.name === 'Folder A')!.id,
      }
    })

    // Record original state
    const originalOrder = await page.evaluate(() => {
      const store = window.__snippetStore!
      const b = store.getState().folders.find((f) => f.name === 'Folder B')!
      return { parentId: b.parentId ?? null, orderIndex: b.orderIndex }
    })

    const folderBHeader = folderHeaderById(page, ids.bId)
    const folderAHeader = folderHeaderById(page, ids.aId)

    // Move Folder B inside Folder A
    await simulateFolderDragDrop(page, folderBHeader, folderAHeader, ids.bId, 0.5)

    // Verify it moved
    const afterMove = await page.evaluate(() => {
      const store = window.__snippetStore!
      const b = store.getState().folders.find((f) => f.name === 'Folder B')!
      return { parentId: b.parentId ?? null }
    })
    expect(afterMove.parentId).toBe(ids.aId)

    // Undo with Cmd+Z
    await page.keyboard.press('Meta+z')
    await page.waitForTimeout(100)

    // Verify it returned to original position
    const afterUndo = await page.evaluate(() => {
      const store = window.__snippetStore!
      const b = store.getState().folders.find((f) => f.name === 'Folder B')!
      return { parentId: b.parentId ?? null, orderIndex: b.orderIndex }
    })
    expect(afterUndo.parentId).toBe(originalOrder.parentId)
    expect(afterUndo.orderIndex).toBe(originalOrder.orderIndex)
  })
})
