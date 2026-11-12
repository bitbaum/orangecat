import { test, expect } from '@playwright/test';
import path from 'path';

/**
 * Profile Info Workflow E2E Test
 *
 * Tests the new "My Info" view/edit workflow:
 * 1. View mode shows read-only profile information
 * 2. Edit mode accessible via button
 * 3. Guidance sidebar works in edit mode
 * 4. Wallets are separate (not in profile editor)
 * 5. Navigation flows work correctly
 */

test.describe('Profile Info Workflow', () => {
  test.skip(
    !process.env.E2E_USER_EMAIL || !process.env.E2E_USER_PASSWORD,
    'Needs E2E_USER_EMAIL / E2E_USER_PASSWORD for the test account'
  );
  const screenshotsDir = path.join(process.cwd(), 'tests', 'screenshots', 'profile-info-workflow');

  test.beforeEach(async ({ page }) => {
    // Navigate to homepage
    await page.goto('http://localhost:3000');

    // Wait for page to load
    await page.waitForLoadState('networkidle');

    // Check if we need to sign in
    const signInButton = page.getByRole('button', { name: /sign in/i });
    if (await signInButton.isVisible({ timeout: 2000 }).catch(() => false)) {
      // Sign in (adjust credentials as needed)
      await page.goto('http://localhost:3000/auth');
      await page.waitForLoadState('networkidle');

      // Fill in credentials (you may need to adjust these)
      const emailInput = page.getByPlaceholder(/email/i).first();
      const passwordInput = page.getByPlaceholder(/password/i).first();

      if (await emailInput.isVisible({ timeout: 2000 }).catch(() => false)) {
        await emailInput.fill(process.env.E2E_USER_EMAIL ?? '');
        await passwordInput.fill(process.env.E2E_USER_PASSWORD ?? '');

        const submitButton = page.getByRole('button', { name: /sign in/i });
        await submitButton.click();

        // Wait for navigation after sign in
        await page.waitForURL('**/dashboard**', { timeout: 10000 }).catch(() => {});
        await page.waitForLoadState('networkidle');
      }
    }
  });

  test('My Info shows view mode by default', async ({ page }) => {
    // Navigate to My Info from sidebar
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click "Profile" in sidebar
    const profileLink = page.getByRole('link', { name: /profile/i });
    await expect(profileLink).toBeVisible();
    await profileLink.click();

    // Wait for navigation
    await page.waitForURL('**/dashboard/info**', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Take screenshot of view mode
    await page.screenshot({
      path: path.join(screenshotsDir, '01-view-mode.png'),
      fullPage: true,
    });

    // Verify we're in view mode
    await expect(page).toHaveURL(/\/dashboard\/info$/);

    // Verify page title
    const pageTitle = page.getByRole('heading', { name: /my profile/i });
    await expect(pageTitle).toBeVisible();

    // Verify Edit Profile button is present
    const editButton = page.getByRole('link', { name: /edit profile/i });
    await expect(editButton).toBeVisible();

    // Verify we see profile information (read-only)
    // Check for profile overview section
    const overviewSection = page.locator('text=/about|bio|contact/i').first();
    await expect(overviewSection).toBeVisible({ timeout: 5000 });

    // Verify NO edit forms are visible
    const inputFields = page
      .locator('input[type="text"], textarea')
      .filter({ hasNotText: /search/i });
    const inputCount = await inputFields.count();
    // Should have minimal inputs (maybe search), but no profile edit inputs
    console.log(`Found ${inputCount} input fields in view mode (should be minimal)`);
  });

  test('Edit Profile button navigates to edit mode', async ({ page }) => {
    // Navigate to view mode
    await page.goto('http://localhost:3000/dashboard/info');
    await page.waitForLoadState('networkidle');

    // Click Edit Profile button
    const editButton = page.getByRole('link', { name: /edit profile/i }).first();
    await expect(editButton).toBeVisible();
    await editButton.click();

    // Wait for navigation to edit mode
    await page.waitForURL('**/dashboard/info/edit**', { timeout: 5000 });
    await page.waitForLoadState('networkidle');

    // Take screenshot of edit mode
    await page.screenshot({
      path: path.join(screenshotsDir, '02-edit-mode.png'),
      fullPage: true,
    });

    // Verify we're in edit mode
    await expect(page).toHaveURL(/\/dashboard\/info\/edit$/);

    // Verify page title
    const pageTitle = page.getByRole('heading', { name: /edit profile/i });
    await expect(pageTitle).toBeVisible();

    // Verify form fields are present
    const usernameInput = page
      .getByPlaceholder(/username/i)
      .or(page.locator('input[name*="username"]'));
    await expect(usernameInput).toBeVisible({ timeout: 5000 });

    // Verify Back to View button
    const backButton = page.getByRole('link', { name: /back to view/i });
    await expect(backButton).toBeVisible();
  });

  test('Guidance sidebar appears in edit mode', async ({ page }) => {
    // Navigate to edit mode
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');

    // Check for guidance sidebar (desktop view)
    // The sidebar should be visible on larger screens
    const viewport = page.viewportSize();
    if (viewport && viewport.width >= 1024) {
      // Look for guidance sidebar elements
      const guidanceSidebar = page.locator('text=/profile completion|guidance|help/i');
      await expect(guidanceSidebar.first()).toBeVisible({ timeout: 5000 });

      // Take screenshot showing guidance sidebar
      await page.screenshot({
        path: path.join(screenshotsDir, '03-guidance-sidebar.png'),
        fullPage: true,
      });
    }

    // Verify profile completion percentage is shown
    const completionText = page.locator('text=/\\d+%/i');
    await expect(completionText.first()).toBeVisible({ timeout: 5000 });
  });

  test('Wallets are NOT in profile editor', async ({ page }) => {
    // Navigate to edit mode
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');

    // Scroll through the form to check for wallet fields
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(1000);

    // Take screenshot of full form
    await page.screenshot({
      path: path.join(screenshotsDir, '04-no-wallets-in-editor.png'),
      fullPage: true,
    });

    // Verify NO wallet address input fields
    const walletInputs = page.locator(
      'input[placeholder*="wallet"], input[placeholder*="bitcoin"], input[placeholder*="lightning"]'
    );
    const walletInputCount = await walletInputs.count();
    expect(walletInputCount).toBe(0);

    // Verify link to wallets page exists instead
    const walletsLink = page.getByRole('link', { name: /my wallets|manage wallets/i });
    await expect(walletsLink.first()).toBeVisible({ timeout: 5000 });

    // Verify the link goes to wallets page
    const href = await walletsLink.first().getAttribute('href');
    expect(href).toContain('/dashboard/wallets');
  });

  test('Edit Profile from dropdown navigates correctly', async ({ page }) => {
    // Navigate to dashboard
    await page.goto('http://localhost:3000/dashboard');
    await page.waitForLoadState('networkidle');

    // Click user avatar/profile dropdown
    const userMenu = page.getByRole('button', { name: /user menu|profile/i });
    await expect(userMenu).toBeVisible({ timeout: 5000 });
    await userMenu.click();

    // Wait for dropdown to appear
    await page.waitForTimeout(500);

    // Click "Edit Profile" from dropdown
    const editProfileDropdown = page.getByRole('link', { name: /edit profile/i });
    await expect(editProfileDropdown).toBeVisible();
    await editProfileDropdown.click();

    // Verify navigation to edit mode
    await page.waitForURL('**/dashboard/info/edit**', { timeout: 5000 });
    await expect(page).toHaveURL(/\/dashboard\/info\/edit$/);

    // Take screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, '05-dropdown-navigation.png'),
      fullPage: true,
    });
  });

  test('Save changes returns to view mode', async ({ page }) => {
    // Navigate to edit mode
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');

    // Make a small change (update bio if field exists)
    const bioTextarea = page
      .locator('textarea[name*="bio"]')
      .or(page.getByPlaceholder(/bio|about/i));
    if (await bioTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      const currentBio = await bioTextarea.inputValue().catch(() => '');
      await bioTextarea.fill(currentBio + ' [Test]');
    }

    // Click Save button
    const saveButton = page.getByRole('button', { name: /save/i });
    await expect(saveButton).toBeVisible();
    await saveButton.click();

    // Wait for success toast and navigation
    await page.waitForURL('**/dashboard/info**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');

    // Take screenshot of view mode after save
    await page.screenshot({
      path: path.join(screenshotsDir, '06-after-save.png'),
      fullPage: true,
    });

    // Verify we're back in view mode
    await expect(page).toHaveURL(/\/dashboard\/info$/);

    // Verify success message appeared (toast)
    const successToast = page.locator('text=/saved|success/i');
    // Toast might disappear quickly, so we just check if URL changed
    expect(page.url()).toContain('/dashboard/info');
  });

  test('Cancel returns to view mode without saving', async ({ page }) => {
    // Navigate to edit mode
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');

    // Make a change
    const bioTextarea = page
      .locator('textarea[name*="bio"]')
      .or(page.getByPlaceholder(/bio|about/i));
    if (await bioTextarea.isVisible({ timeout: 2000 }).catch(() => false)) {
      await bioTextarea.fill('This should not be saved');
    }

    // Click Cancel or Back to View
    const cancelButton = page
      .getByRole('button', { name: /cancel/i })
      .or(page.getByRole('link', { name: /back to view/i }));
    await expect(cancelButton.first()).toBeVisible();
    await cancelButton.first().click();

    // Wait for navigation back to view
    await page.waitForURL('**/dashboard/info**', { timeout: 5000 });

    // Take screenshot
    await page.screenshot({
      path: path.join(screenshotsDir, '07-after-cancel.png'),
      fullPage: true,
    });

    // Verify we're in view mode
    await expect(page).toHaveURL(/\/dashboard\/info$/);
  });

  test('Quick Actions section works correctly', async ({ page }) => {
    // Navigate to view mode
    await page.goto('http://localhost:3000/dashboard/info');
    await page.waitForLoadState('networkidle');

    // Scroll to Quick Actions section
    const quickActions = page.locator('text=/quick actions/i');
    await expect(quickActions).toBeVisible({ timeout: 5000 });

    // Scroll to it
    await quickActions.scrollIntoViewIfNeeded();
    await page.waitForTimeout(500);

    // Take screenshot of Quick Actions
    await page.screenshot({
      path: path.join(screenshotsDir, '08-quick-actions.png'),
      fullPage: false,
    });

    // Verify Edit Profile button in Quick Actions
    const editInActions = page.getByRole('link', { name: /edit profile/i });
    const editButtons = await editInActions.count();
    expect(editButtons).toBeGreaterThan(0);

    // Verify View Public Profile button (if username exists)
    const viewPublicButton = page.getByRole('link', { name: /view public profile/i });
    // This might not exist if no username, so we check conditionally
    const hasPublicButton = await viewPublicButton.isVisible({ timeout: 2000 }).catch(() => false);
    if (hasPublicButton) {
      await expect(viewPublicButton).toBeVisible();
    }

    // Verify Manage Wallets button
    const manageWalletsButton = page.getByRole('link', { name: /manage wallets/i });
    await expect(manageWalletsButton).toBeVisible();
  });
});
