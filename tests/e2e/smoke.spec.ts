import { test, expect } from '@playwright/test'

test.describe('ProofPay Smoke Tests', () => {
  test('landing page renders with tagline and honesty line', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('h1')).toContainText("Pay when it's proven")
    await expect(page.getByText('PayPal authorization hold, not escrow')).toBeVisible()
  })

  test('skip link is first focusable element', async ({ page }) => {
    await page.goto('/')
    await page.keyboard.press('Tab')
    const activeText = await page.evaluate(() => document.activeElement?.textContent)
    expect(activeText?.trim()).toBe('Skip to main content')
  })

  test('judge mode panel is present with demo personas', async ({ page }) => {
    await page.goto('/')
    await expect(page.locator('#judge-mode')).toBeVisible()
    await expect(page.getByText('Sarah Buyer')).toBeVisible()
    await expect(page.getByText('Alex Seller')).toBeVisible()
  })
})
