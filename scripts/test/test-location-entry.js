const { chromium } = require('playwright');

async function testLocationEntry() {
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
    console.log('🔍 Testing Location Entry...\n');

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
    await page.screenshot({ path: 'test-screenshots/location-01-edit-page.png', fullPage: true });
    console.log('✅ On edit page\n');

    // Find location input
    console.log('📍 Testing location input...');
    const locationInput = page
      .locator(
        'input[placeholder*="zip code" i], input[placeholder*="location" i], input[placeholder*="city" i]'
      )
      .first();

    const inputVisible = await locationInput.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Location input visible: ${inputVisible}`);

    if (inputVisible) {
      await locationInput.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/location-02-before-input.png',
        fullPage: true,
      });

      // Test typing 8053
      console.log('\n📍 Typing "8053"...');
      await locationInput.fill('8053');
      await page.waitForTimeout(2000);
      await page.screenshot({
        path: 'test-screenshots/location-03-typed-8053.png',
        fullPage: true,
      });

      // Check if suggestions appeared or auto-filled
      const suggestions = await page
        .locator('[class*="suggestion"], [class*="dropdown"], [class*="autocomplete"]')
        .count();
      console.log(`   Suggestions/dropdowns visible: ${suggestions}`);

      // Check input value
      const inputValue = await locationInput.inputValue();
      console.log(`   Input value after typing: "${inputValue}"`);

      // Check for any error messages
      const errorMessages = await page.locator('text=/error|failed|not found/i').count();
      console.log(`   Error messages: ${errorMessages}`);

      // Wait a bit more for async operations
      await page.waitForTimeout(3000);
      await page.screenshot({
        path: 'test-screenshots/location-04-after-wait.png',
        fullPage: true,
      });

      const finalValue = await locationInput.inputValue();
      console.log(`   Final input value: "${finalValue}"`);

      // Check if location fields were filled
      const cityField = await page
        .locator('input[name*="city" i], input[name*="location_city"]')
        .first();
      const cityValue = await cityField.inputValue().catch(() => '');
      console.log(`   City field value: "${cityValue}"`);

      const countryField = await page
        .locator('input[name*="country" i], input[name*="location_country"]')
        .first();
      const countryValue = await countryField.inputValue().catch(() => '');
      console.log(`   Country field value: "${countryValue}"`);
    } else {
      console.log('   ❌ Location input not found!');
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
    await page.screenshot({ path: 'test-screenshots/location-error.png' });
    await new Promise(() => {});
  }
}

testLocationEntry();
