const { chromium } = require('playwright');

async function quickCheck() {
  let browser = await chromium.launch({ headless: false, devtools: true });
  let page = await browser.newPage();

  const errors = [];
  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('MIME type') && !text.includes('Failed to load resource')) {
        errors.push(text);
        console.log(`❌ ${text}`);
      }
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });

  try {
    console.log('🔍 Quick Profile Check...\n');

    // Login
    await page.goto('http://localhost:3000/auth');
    await page.fill('input[type="email"]', process.env.E2E_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.E2E_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Test View Mode
    console.log('📍 Testing View Mode...');
    await page.goto('http://localhost:3000/dashboard/info');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(2000);

    const emptyFields = await page.locator('text=/Not filled out yet/i').count();
    console.log(`   Empty field indicators: ${emptyFields}`);

    const allFieldsVisible = await page
      .locator('text=/Username|Display Name|About|Location|Website|Contact Email|Phone/i')
      .count();
    console.log(`   Total fields visible: ${allFieldsVisible}`);
    await page.screenshot({ path: 'test-screenshots/quick-view.png', fullPage: true });
    console.log('✅ View mode OK\n');

    // Test Edit Mode
    console.log('📍 Testing Edit Mode...');
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);

    // Check Save button
    const saveBtn = page.getByRole('button', { name: /save profile/i });
    const saveVisible = await saveBtn.isVisible({ timeout: 5000 }).catch(() => false);
    const saveEnabled = saveVisible ? await saveBtn.isEnabled().catch(() => false) : false;

    console.log(`   Save button visible: ${saveVisible}`);
    console.log(`   Save button enabled: ${saveEnabled}`);

    if (!saveVisible) {
      console.log('   ❌ CRITICAL: Save button not found!');
    } else {
      await saveBtn.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
    }

    // Check guidance sidebar
    const guidance = await page.locator('text=/Profile Completion|Help/i').count();
    console.log(`   Guidance sidebar elements: ${guidance}`);

    // Check Add Link
    const addLink = await page.locator('text=/\\+ Add Link/i').count();
    console.log(`   Add Link button: ${addLink}`);

    await page.screenshot({ path: 'test-screenshots/quick-edit.png', fullPage: true });
    console.log('✅ Edit mode checked\n');

    // Summary
    console.log('='.repeat(50));
    if (errors.length > 0) {
      console.log(`❌ Found ${errors.length} errors:`);
      errors.forEach(e => console.log(`   - ${e}`));
    } else {
      console.log('✅ No critical errors found!');
    }
    console.log('='.repeat(50));

    console.log('\n🌐 Browser stays open for inspection...');
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-screenshots/quick-error.png' });
    await new Promise(() => {});
  }
}

quickCheck();
