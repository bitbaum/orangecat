import { test, expect } from '@playwright/test'

// This test logs in with the seeded user, navigates to Messages,
// sends a message, and asserts it appears.

const TEST_EMAIL = 'test@orangecat.ch'
const TEST_PASSWORD = 'TestPassword123!'

test.describe('Messages: login and send', () => {
  test('logs in and sends a message', async ({ page, baseURL }) => {
    const target = baseURL || 'http://localhost:3000'

    // 1) Go to login page
    await page.goto(target + '/auth?mode=login', { waitUntil: 'networkidle' })

    // 2) Fill login form and submit
    await page.locator('input[type="email"]').fill(TEST_EMAIL)
    await page.locator('input[type="password"]').fill(TEST_PASSWORD)
    await page.locator('button:has-text("Sign in")').click()

    // 3) Wait for redirect to dashboard
    await page.waitForURL(/\/dashboard(\/.*)?$/, { timeout: 15000 })

    // 4) Ensure a self-conversation via test endpoint, then navigate directly
    const resp = await page.request.post(target + '/api/test/conversation/self')
    expect(resp.ok()).toBeTruthy()
    const { conversationId } = await resp.json()
    expect(conversationId).toBeTruthy()
    await page.goto(`${target}/messages?id=${conversationId}`, { waitUntil: 'networkidle' })

    const composer = page.locator('textarea[placeholder="Message — type @cat to bring Cat in"]')
    await composer.waitFor({ state: 'visible', timeout: 15000 })

    // 5) Send a message
    const msg = `Hello from Playwright ${Date.now()}`
    await composer.fill(msg)
    await composer.press('Enter')

    // 6) Assert message appears in the thread
    await expect(page.getByText(msg, { exact: false })).toBeVisible({ timeout: 15000 })

    // 7) Save a screenshot for reference
    await page.screenshot({ path: 'test-results/messages-send.png', fullPage: true })
  })
})
