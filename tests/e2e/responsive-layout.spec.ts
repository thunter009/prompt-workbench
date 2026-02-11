import { test, expect } from '@playwright/test'

test.describe('Responsive Layout', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })
  })

  test('mobile viewport shows hamburger menu and hides sidebar', async ({ page }) => {
    // Set mobile viewport
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(200)

    // Hamburger button should be visible
    const toggle = page.getByTestId('sidebar-toggle')
    await expect(toggle).toBeVisible()

    // Mobile sidebar overlay should not be visible by default
    const overlay = page.locator('.bg-black\\/50')
    await expect(overlay).not.toBeVisible()

    // Click hamburger to open sidebar overlay
    await toggle.click()
    await expect(overlay).toBeVisible()
    // The overlay sidebar should contain snippet content
    const sidebarOverlay = page.locator('.absolute.inset-y-0.left-0')
    await expect(sidebarOverlay).toBeVisible()

    // Click backdrop to close
    await overlay.click({ position: { x: 350, y: 300 } })
    await page.waitForTimeout(200)
    await expect(overlay).not.toBeVisible()
  })

  test('desktop viewport shows sidebar without hamburger', async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 720 })
    await page.waitForTimeout(200)

    // Hamburger should not exist on desktop
    const toggle = page.getByTestId('sidebar-toggle')
    await expect(toggle).not.toBeVisible()
  })

  test('search palette has mobile padding', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.waitForTimeout(200)

    // Open search palette
    await page.keyboard.press('Meta+p')
    await page.waitForTimeout(200)

    // The Command component should have mx-4 class on mobile
    const palette = page.locator('[cmdk-root]')
    await expect(palette).toBeVisible()
    await expect(palette).toHaveClass(/mx-4/)
  })
})
