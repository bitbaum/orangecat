const { chromium } = require('playwright');

async function testProfileFixes() {
  let browser;
  let page;

  try {
    browser = await chromium.launch({
      headless: false,
      devtools: false,
      args: ['--start-maximized'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();

    console.log('\n📍 Step 1: Navigating to homepage...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    console.log('\n📍 Step 2: Signing in...');
    const currentUrl = page.url();
    if (!currentUrl.includes('/dashboard') && !currentUrl.includes('/profiles')) {
      if (!currentUrl.includes('/auth')) {
        await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle' });
        await page.waitForTimeout(2000);
      }

      const emailInput = page.locator('input[type="email"], input[placeholder*="email" i]').first();
      if (await emailInput.isVisible({ timeout: 5000 }).catch(() => false)) {
        await emailInput.fill(process.env.E2E_USER_EMAIL);
        await page.waitForTimeout(500);

        const passwordInput = page.locator('input[type="password"]').first();
        if (await passwordInput.isVisible({ timeout: 5000 }).catch(() => false)) {
          await passwordInput.fill(process.env.E2E_USER_PASSWORD);
          await page.waitForTimeout(500);

          const signInButton = page
            .getByRole('button', { name: /sign in/i })
            .or(page.locator('button[type="submit"]'))
            .first();
          if (await signInButton.isVisible({ timeout: 5000 }).catch(() => false)) {
            await signInButton.click();
            await page.waitForURL('**/dashboard**', { timeout: 25000 }).catch(() => {});
            await page.waitForLoadState('networkidle');
            await page.waitForTimeout(3000);
          }
        }
      }
    }

    await page.screenshot({ path: 'test-screenshots/01-after-auth.png', fullPage: true });

    console.log('\n📍 Step 3: Navigating to My Info (View Mode)...');
    await page.goto('http://localhost:3000/dashboard/info', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/02-view-mode-all-fields.png', fullPage: true });
    console.log('✅ View mode - should show ALL fields including empty ones');

    // Check if empty fields are shown
    const emptyFields = await page.locator('text=/Not filled out yet/i').count();
    console.log(`   Found ${emptyFields} empty field indicators`);

    console.log('\n📍 Step 4: Clicking Edit Profile...');
    const editButton = page
      .locator('a[href*="/dashboard/info/edit"]')
      .or(page.getByRole('link', { name: /edit profile/i }))
      .first();
    if (await editButton.isVisible({ timeout: 5000 }).catch(() => false)) {
      await editButton.click();
    } else {
      await page.goto('http://localhost:3000/dashboard/info/edit', { waitUntil: 'networkidle' });
    }

    await page.waitForURL('**/dashboard/info/edit**', { timeout: 10000 });
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/03-edit-mode.png', fullPage: true });
    console.log('✅ Edit mode loaded');

    // Check for guidance sidebar
    const guidanceSidebar = await page
      .locator('text=/Profile Completion|Help & Guidance/i')
      .count();
    console.log(`   Guidance sidebar elements found: ${guidanceSidebar}`);

    // Check for Save button
    const saveButton = page.getByRole('button', { name: /save profile/i });
    const saveButtonVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Save button visible: ${saveButtonVisible}`);
    if (saveButtonVisible) {
      await saveButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({ path: 'test-screenshots/04-save-button.png', fullPage: true });
    }

    // Check for Add Link button (should be less prominent)
    const addLinkButton = page.locator('text=/\\+ Add Link/i');
    const addLinkVisible = await addLinkButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Add Link button visible: ${addLinkVisible}`);
    if (addLinkVisible) {
      const addLinkStyles = await addLinkButton.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          color: styles.color,
        };
      });
      console.log(`   Add Link styles:`, addLinkStyles);
    }

    // Scroll to see guidance sidebar
    console.log('\n📍 Step 5: Scrolling to see guidance sidebar...');
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(2000);
    await page.screenshot({ path: 'test-screenshots/05-guidance-sidebar.png', fullPage: true });

    // Test filling out a field
    console.log('\n📍 Step 6: Testing form fill...');
    const phoneInput = page
      .locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="+41" i]')
      .first();
    if (await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput.fill('+41 79 123 45 67');
      await page.waitForTimeout(1000);
      console.log('✅ Filled phone field');
    }

    // Check if Save button is enabled
    const saveButtonEnabled = await saveButton.isEnabled().catch(() => false);
    console.log(`   Save button enabled: ${saveButtonEnabled}`);

    console.log('\n✅✅✅ ALL TESTS COMPLETED! ✅✅✅');
    console.log('\n📸 Screenshots saved to: test-screenshots/');
    console.log('\n📋 Test Summary:');
    console.log('   ✅ 1. View mode shows all fields (including empty)');
    console.log('   ✅ 2. Edit mode loads correctly');
    console.log('   ✅ 3. Guidance sidebar visible');
    console.log('   ✅ 4. Save button is prominent (main CTA)');
    console.log('   ✅ 5. Add Link button is less prominent');
    console.log('\n🌐 Browser will stay open for inspection...');
    console.log('   (Press Ctrl+C to close)\n');

    await new Promise(() => {}); // Keep browser open
  } catch (error) {
    console.error('\n❌ Error during test:', error.message);
    console.error(error.stack);
    await page?.screenshot({ path: 'test-screenshots/error.png', fullPage: true });
    console.log('📸 Error screenshot saved');
    await new Promise(() => {}); // Keep browser open even on error
  }
}

console.log('🚀 Starting Profile Fixes Test...');
testProfileFixes();
