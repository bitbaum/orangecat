import { expect, test, type Page } from '@playwright/test';

async function expectSingleUsefulPage(page: Page, heading: string | RegExp): Promise<void> {
  await expect(page.locator('main')).toHaveCount(1);
  await expect(page.getByRole('heading', { level: 1, name: heading })).toBeVisible();
}

async function expectLoginIntent(page: Page, expectedFrom: string): Promise<void> {
  await expect(page).toHaveURL(/\/auth(?:\?|$)/);
  const url = new URL(page.url());
  expect(url.searchParams.get('mode')).toBe('login');
  expect(url.searchParams.get('from')).toBe(expectedFrom);
  await expectSingleUsefulPage(page, 'Welcome back');
}

test.describe('representative persona journeys', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('first-time evaluator moves from proposition to live discovery', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('main')).toHaveCount(1);
    await page.getByRole('link', { name: 'Explore Platform' }).first().click();
    await expect(page).toHaveURL(/\/discover(?:\?|$)/);
    await expectSingleUsefulPage(page, /Discover Opportunities/);
  });

  test('returning evaluator bookmarks resolve to the exact canonical outcome', async ({ page }) => {
    for (const [legacy, destination] of [
      ['/browse', '/discover'],
      ['/donate', '/discover'],
      ['/fundraising', '/how-it-works'],
    ] as const) {
      await page.goto(legacy);
      expect(`${new URL(page.url()).pathname}${new URL(page.url()).search}`).toBe(destination);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('explorer can select people without a mobile control wall', async ({ page }) => {
    await page.goto('/discover');
    const mobileType = page.getByLabel('Filter results by type');
    if (await mobileType.isVisible()) {
      await mobileType.selectOption('profiles');
    } else {
      await page.getByRole('button', { name: /^People(?:\s|$)/ }).click();
    }
    await expect(page).toHaveURL(/\/discover\?[^#]*type=profiles/);
  });

  test('buyer, service customer, lender, investor, and group seeker land in the right context', async ({
    page,
  }) => {
    for (const [entry, type] of [
      ['/products', 'products'],
      ['/services', 'services'],
      ['/loans', 'loans'],
      ['/investments', 'investments'],
      ['/groups', 'groups'],
    ] as const) {
      await page.goto(entry);
      const url = new URL(page.url());
      expect(url.pathname).toBe('/discover');
      expect(url.searchParams.get('type')).toBe(type);
      await expectSingleUsefulPage(page, /Discover Opportunities/);
    }
  });

  test('creator intent is preserved from discovery through sign-in', async ({ page }) => {
    await page.goto('/discover');
    await page.getByRole('link', { name: /Start Creating/ }).click();
    await expectSingleUsefulPage(page, 'Welcome back');
    await expect(page.getByRole('button', { name: /Start instantly/ })).toBeVisible();
  });

  test('project creator guessed and legacy URLs converge on one protected wizard', async ({
    page,
  }) => {
    for (const entry of ['/create', '/create/project', '/projects/create'] as const) {
      await page.goto(entry);
      await expectLoginIntent(page, '/dashboard/projects/create');
    }
  });

  test('event organizer reaches sign-in with exact create intent', async ({ page }) => {
    await page.goto('/events');
    await expectSingleUsefulPage(page, 'Event Organization with Bitcoin');
    await page.getByRole('button', { name: 'Create Your Event' }).click();
    await expectLoginIntent(page, '/events/create');
  });

  test('profile owner share URL never falls back to a database id', async ({ page }) => {
    await page.goto('/profiles/me');
    await expectLoginIntent(page, '/profiles/me');
  });

  test('community reader gets value before registration', async ({ page }) => {
    await page.goto('/community');
    await expectSingleUsefulPage(page, 'Community');
    await expect(page.getByText(/Please sign in to view your timeline/i)).toHaveCount(0);
  });

  test('collaborator can inspect roles before authentication', async ({ page }) => {
    await page.goto('/collaborate');
    await expectSingleUsefulPage(page, 'Collaborate');
    await expect(page.getByText('Open roles on projects looking for collaborators')).toBeVisible();
    await expect(
      page.getByText(/Loading roles|No open roles|Create a project|on /).first()
    ).toBeVisible();
  });

  test('Bitcoin novice moves from learning to a concrete wallet choice', async ({ page }) => {
    await page.goto('/study-bitcoin');
    await page
      .getByRole('link', { name: /Start Learning/ })
      .first()
      .click();
    await expectSingleUsefulPage(page, 'Get Your Bitcoin Wallet');
    await expect(page.getByRole('heading', { level: 2, name: 'Choose Your Wallet' })).toBeVisible();
    await expect(page.locator('a[href="#"]')).toHaveCount(0);
  });

  test('recipient and payer intents retain their exact protected/public split', async ({
    page,
  }) => {
    await page.goto('/receive');
    await expectLoginIntent(page, '/receive');

    const username = process.env.E2E_PROFILE_USERNAME;
    if (username) {
      await page.goto(`/pay/${encodeURIComponent(username)}`);
      await expect(page).not.toHaveURL(/\/auth(?:\?|$)/);
      await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    }
  });

  test('Cat alias keeps flagship intent through the auth boundary', async ({ page }) => {
    await page.goto('/cat');
    await expectLoginIntent(page, '/dashboard/cat');
  });

  test('developer learns the model then reaches protected integration management', async ({
    page,
  }) => {
    await page.goto('/docs');
    await expectSingleUsefulPage(page, 'Platform Documentation');
    await expect(page.getByRole('heading', { level: 2, name: 'Entity System' })).toBeVisible();
    await page.goto('/settings/integrations');
    await expectLoginIntent(page, '/settings/integrations');
  });

  test('security reporter gets a real non-placeholder contact action', async ({ page }) => {
    await page.goto('/security');
    await expectSingleUsefulPage(page, 'Security & Privacy');
    await expect(page.getByRole('link', { name: 'Report Security Issue' })).toHaveAttribute(
      'href',
      'mailto:security@orangecat.ch'
    );
  });

  test('auth mode changes retain the exact intended destination', async ({ page }) => {
    const returnTo = '/dashboard/projects/create?edit=journey-project';
    await page.goto(`/auth?mode=login&from=${encodeURIComponent(returnTo)}`);
    await expectSingleUsefulPage(page, 'Welcome back');
    await page.getByRole('button', { name: 'Create an account' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Get started');
    expect(new URL(page.url()).searchParams.get('from')).toBe(returnTo);
    await page.getByRole('button', { name: 'Sign in instead' }).click();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Welcome back');
  });
});
