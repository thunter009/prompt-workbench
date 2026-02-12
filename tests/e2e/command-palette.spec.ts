import { test, expect } from '@playwright/test'

test.describe('Command Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('Cmd+K opens palette, Escape closes it', async ({ page }) => {
    // Should not be visible initially
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()

    // Open with Cmd+K
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible()

    // Placeholder text present
    const input = page.locator('[data-testid="command-palette"] input')
    await expect(input).toHaveAttribute('placeholder', 'Type a command...')

    // Close with Escape
    await page.keyboard.press('Escape')
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()
  })

  test('arrow key navigation highlights commands', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible()

    // First item should be selected by default
    const items = page.locator('[data-testid="command-palette"] [data-command-item]')
    await expect(items.first()).toHaveAttribute('aria-selected', 'true')

    // Arrow down moves selection
    await page.keyboard.press('ArrowDown')
    await expect(items.first()).toHaveAttribute('aria-selected', 'false')
    await expect(items.nth(1)).toHaveAttribute('aria-selected', 'true')

    // Arrow up moves back
    await page.keyboard.press('ArrowUp')
    await expect(items.first()).toHaveAttribute('aria-selected', 'true')
  })

  test('Enter executes selected command and closes palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')

    // Type to filter to settings
    const input = page.locator('[data-testid="command-palette"] input')
    await input.fill('Settings')

    const items = page.locator('[data-testid="command-palette"] [data-command-item]')
    await expect(items).toHaveCount(1)
    await expect(items.first()).toContainText('Settings')

    // Press Enter
    await page.keyboard.press('Enter')

    // Palette should close
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()
  })

  test('filtering narrows command list', async ({ page }) => {
    await page.keyboard.press('Meta+k')

    const items = page.locator('[data-testid="command-palette"] [data-command-item]')
    const initialCount = await items.count()
    expect(initialCount).toBeGreaterThan(3)

    // Type to filter
    const input = page.locator('[data-testid="command-palette"] input')
    await input.fill('snippet')
    const filteredCount = await items.count()
    expect(filteredCount).toBeLessThan(initialCount)
    expect(filteredCount).toBeGreaterThan(0)
  })

  test('no results shows empty message', async ({ page }) => {
    await page.keyboard.press('Meta+k')

    const input = page.locator('[data-testid="command-palette"] input')
    await input.fill('xyznonexistent')

    await expect(page.locator('[data-testid="command-palette"]')).toContainText('No matching commands')
  })

  test('Cmd+P still opens search palette (no conflict)', async ({ page }) => {
    // Open search palette with Cmd+P
    await page.keyboard.press('Meta+p')

    // Search palette should be visible (it has "Search snippets..." placeholder)
    await expect(page.locator('input[placeholder="Search snippets..."]')).toBeVisible()

    // Command palette should not be visible
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()
  })

  test('clicking backdrop closes palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.locator('[data-testid="command-palette"]')).toBeVisible()

    // Click on the backdrop (top-left corner, outside dialog)
    await page.mouse.click(10, 10)
    await expect(page.locator('[data-testid="command-palette"]')).not.toBeVisible()
  })

  test('arrow keys wrap around list', async ({ page }) => {
    await page.keyboard.press('Meta+k')

    const items = page.locator('[data-testid="command-palette"] [data-command-item]')
    const count = await items.count()

    // Arrow up from first wraps to last
    await page.keyboard.press('ArrowUp')
    await expect(items.nth(count - 1)).toHaveAttribute('aria-selected', 'true')

    // Arrow down from last wraps to first
    await page.keyboard.press('ArrowDown')
    await expect(items.first()).toHaveAttribute('aria-selected', 'true')
  })
})
