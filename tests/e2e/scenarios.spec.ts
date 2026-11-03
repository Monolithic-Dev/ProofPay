import { test, expect } from '@playwright/test'

test.describe('Judge Mode E2E Scenarios (§8.6)', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('judge panel renders all 4 personas with distinct roles', async ({ page }) => {
    const judgeSection = page.locator('#judge-mode')
    await expect(judgeSection).toBeVisible()

    await expect(page.getByText('Sarah Buyer')).toBeVisible()
    await expect(page.getByText('Alex Seller')).toBeVisible()
    await expect(page.getByText('ProcureBot')).toBeVisible()
    await expect(page.getByText('SynthetixBot')).toBeVisible()
  })

  test('judge panel renders all 5 scenario buttons with execution descriptions', async ({ page }) => {
    const judgeSection = page.locator('#judge-mode')
    await expect(judgeSection).toBeVisible()

    await expect(page.getByText('Happy Path')).toBeVisible()
    await expect(page.getByText('Self-Correction Loop')).toBeVisible()
    await expect(page.getByText('Adversarial Grader Defense')).toBeVisible()
    await expect(page.getByText('Payment Gateway Resilience')).toBeVisible()
    await expect(page.getByText('Silent Buyer Protection')).toBeVisible()
  })

  test('persona switch logs in persona and updates session state', async ({ page }) => {
    // Click Sarah Buyer login card
    const sarahBtn = page.getByRole('button', { name: /Sarah Buyer/i })
    await expect(sarahBtn).toBeVisible()
    await sarahBtn.click()

    // Studio link should be accessible
    const studioLink = page.getByRole('link', { name: /Create a contract/i })
    await expect(studioLink).toBeVisible()
  })

  test('scenario launch initiates agent console navigation', async ({ page }) => {
    // First log in as Sarah Buyer
    const sarahBtn = page.getByRole('button', { name: /Sarah Buyer/i })
    await sarahBtn.click()

    // Click Happy Path scenario
    const happyPathBtn = page.getByRole('button', { name: /Happy Path/i })
    await expect(happyPathBtn).toBeVisible()

    // Intercept or navigate to agent-console
    await happyPathBtn.click()

    // URL should redirect to agent-console/[runId]
    await expect(page).toHaveURL(/\/agent-console\/[a-f0-9-]+/, { timeout: 10000 })
    await expect(page.getByText(/Live Agent Session/i)).toBeVisible({ timeout: 10000 })
  })

  test('all five scenarios are registered and executable via API', async ({ request }) => {
    // Authenticate via demo login
    const loginRes = await request.post('/api/v1/auth/demo-login', {
      data: { persona_key: 'buyer' },
    })
    expect(loginRes.status()).toBe(200)

    const scenarios = [
      'happy_path',
      'reject_then_pass',
      'injection_attack',
      'capture_declined',
      'silent_buyer_autorelease',
    ]

    for (const scenario of scenarios) {
      const runRes = await request.post(`/api/v1/demo/scenarios/${scenario}/run`)
      // Returns 202 Accepted or 409 if a previous run is still active
      expect([202, 409]).toContain(runRes.status())
      if (runRes.status() === 202) {
        const body = await runRes.json()
        expect(body.run_id).toBeDefined()
        expect(body.scenario).toBe(scenario)
        expect(body.status).toBe('RUNNING')
      }
    }
  })
})
