import { test, expect } from '@playwright/test'

test.describe('Unified Palette', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
    await page.evaluate(() => localStorage.clear())
    await page.reload()
    await page.waitForSelector('text=Prompt Workbench', { timeout: 10000 })
    await page.waitForFunction(() => !!window.__snippetStore, { timeout: 5000 })

    await page.evaluate(() => {
      const store = window.__snippetStore?.getState()
      if (!store) return
      const first = store.createSnippet({
        name: 'Welcome Prompt',
        text: 'Hello {{name}}, welcome to the app.',
      })
      store.updateSnippet(first.id, { keyword: '!welcome' })
      store.createSnippet({
        name: 'Deploy Notes',
        text: 'Deploy checklist includes migrations and smoke tests.',
      })
    })
  })

  test('Cmd+K opens palette, Escape closes it', async ({ page }) => {
    await expect(page.getByTestId('unified-palette')).not.toBeVisible()

    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('unified-palette')).toBeVisible()
    await expect(page.getByTestId('unified-palette').locator('input')).toHaveAttribute(
      'placeholder',
      'Search snippets, > commands, / content, >ai'
    )

    await page.keyboard.press('Escape')
    await expect(page.getByTestId('unified-palette')).not.toBeVisible()
  })

  test('Cmd+P opens unified palette in snippet mode', async ({ page }) => {
    await page.keyboard.press('Meta+p')
    await expect(page.getByTestId('unified-palette')).toBeVisible()
    await expect(page.getByTestId('unified-palette')).toContainText('snippet')
  })

  test('command mode shows grouped commands and fuzzy filter', async ({ page }) => {
    await page.keyboard.press('Meta+k')

    const input = page.getByTestId('unified-palette').locator('input')
    await input.fill('>')

    const sections = page.getByTestId('unified-palette').locator('[data-command-section]')
    await expect(sections.first()).toBeVisible()

    await input.fill('>tog prev')
    const items = page.getByTestId('unified-palette').locator('[data-command-item]')
    await expect(items.first()).toContainText('Toggle Preview')
  })

  test('content mode searches across snippet text', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByTestId('unified-palette').locator('input')

    await input.fill('/migrations')
    await expect(page.getByTestId('unified-palette')).toContainText('Deploy Notes')
    await expect(page.getByTestId('unified-palette')).toContainText('migrations')
  })

  test('Enter on content result opens snippet', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    const input = page.getByTestId('unified-palette').locator('input')

    await input.fill('/welcome to the app')
    await page.keyboard.press('Enter')

    const selectedName = await page.evaluate(() => {
      const store = window.__snippetStore?.getState()
      const selected = store?.getSelectedSnippet()
      return selected?.name ?? null
    })
    expect(selectedName).toBe('Welcome Prompt')
  })

  test('Cmd+J opens AI mode', async ({ page }) => {
    await page.keyboard.press('Meta+j')
    await expect(page.getByTestId('unified-palette')).toBeVisible()
    await expect(page.getByTestId('unified-palette')).toContainText('AI Assist')
  })

  test('clicking backdrop closes palette', async ({ page }) => {
    await page.keyboard.press('Meta+k')
    await expect(page.getByTestId('unified-palette')).toBeVisible()

    await page.mouse.click(10, 10)
    await expect(page.getByTestId('unified-palette')).not.toBeVisible()
  })
})
