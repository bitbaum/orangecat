const { chromium } = require('playwright');

async function testLocationComplete() {
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

  try {
    console.log('🔍 Testing Complete Location Entry Flow...\n');

    // Login
    await page.goto('http://localhost:3000/auth');
    await page.fill('input[type="email"]', process.env.E2E_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.E2E_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✅ Logged in\n');

    // Navigate to edit page
    console.log('📍 Navigating to edit page...');
    await page.goto('http://localhost:3000/dashboard/info/edit');
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-screenshots/location-complete-01-edit-page.png',
      fullPage: true,
    });
    console.log('✅ On edit page\n');

    // Find location section
    console.log('📍 Testing location input with country selector...');

    // Check for country dropdown
    const countryButton = page
      .locator('button:has-text("Switzerland"), button:has-text("United States")')
      .first();
    const countryVisible = await countryButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Country selector visible: ${countryVisible}`);

    if (countryVisible) {
      await countryButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/location-complete-02-country-selector.png',
        fullPage: true,
      });

      // Click country selector
      await countryButton.click();
      await page.waitForTimeout(500);
      await page.screenshot({
        path: 'test-screenshots/location-complete-03-country-dropdown.png',
        fullPage: true,
      });
      console.log('   ✅ Country dropdown opened');

      // Select Switzerland (should already be selected, but verify)
      const switzerlandOption = page.locator('button:has-text("Switzerland")').first();
      if (await switzerlandOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await switzerlandOption.click();
        await page.waitForTimeout(500);
      }
    }

    // Find zip code input
    const zipInput = page
      .locator(
        'input[placeholder*="zip" i], input[placeholder*="location" i], input[placeholder*="city" i]'
      )
      .first();
    const inputVisible = await zipInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Zip code input visible: ${inputVisible}`);

    if (inputVisible) {
      await zipInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);

      // Test typing 8053
      console.log('\n📍 Typing "8053"...');
      await zipInput.fill('8053');
      await page.waitForTimeout(3000); // Wait for async lookup
      await page.screenshot({
        path: 'test-screenshots/location-complete-04-typed-8053.png',
        fullPage: true,
      });

      // Check input value
      const inputValue = await zipInput.inputValue();
      console.log(`   Input value: "${inputValue}"`);

      // Check if location fields were filled
      await page.waitForTimeout(2000);
      const cityField = await page
        .locator('input[name*="city" i], input[name*="location_city"]')
        .first()
        .inputValue()
        .catch(() => '');
      const countryField = await page
        .locator('input[name*="country" i], input[name*="location_country"]')
        .first()
        .inputValue()
        .catch(() => '');
      const zipField = await page
        .locator('input[name*="zip" i], input[name*="location_zip"]')
        .first()
        .inputValue()
        .catch(() => '');

      console.log(`   City field: "${cityField}"`);
      console.log(`   Country field: "${countryField}"`);
      console.log(`   Zip field: "${zipField}"`);

      if (cityField && cityField.length > 0) {
        console.log('   ✅✅✅ SUCCESS! Location auto-filled from zip code!');
      } else {
        console.log('   ⚠️  Location not auto-filled - checking for errors...');
      }

      await page.screenshot({
        path: 'test-screenshots/location-complete-05-final-state.png',
        fullPage: true,
      });
    }

    console.log('\n' + '='.repeat(50));
    if (errors.length > 0) {
      console.log(`❌ Found ${errors.length} errors:`);
      errors.forEach(e => console.log(`   - ${e}`));
    } else {
      console.log('✅ No console errors');
    }
    console.log('='.repeat(50));

    console.log('\n🌐 Browser stays open for inspection...');
    await new Promise(() => {});
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    await page.screenshot({ path: 'test-screenshots/location-complete-error.png' });
    await new Promise(() => {});
  }
}

testLocationComplete();
