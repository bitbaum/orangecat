const { chromium } = require('playwright');

async function browserTestLocation() {
  let browser = await chromium.launch({
    headless: false,
    devtools: true,
    args: ['--start-maximized'],
  });

  let page = await browser.newPage();
  page.setViewportSize({ width: 1920, height: 1080 });

  const steps = [];
  const errors = [];

  page.on('console', msg => {
    if (msg.type() === 'error') {
      const text = msg.text();
      if (!text.includes('MIME type') && !text.includes('Failed to load resource')) {
        errors.push(text);
        console.log(`❌ Console: ${text}`);
      }
    }
  });

  page.on('pageerror', error => {
    errors.push(error.message);
    console.log(`❌ Page Error: ${error.message}`);
  });

  try {
    console.log('🌐 BROWSER TEST: Location Entry\n');
    console.log('='.repeat(60));

    // Step 1: Login
    steps.push('1. Login');
    console.log('\n📍 Step 1: Logging in...');
    await page.goto('http://localhost:3000/auth', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

    await page.fill('input[type="email"]', process.env.E2E_USER_EMAIL);
    await page.fill('input[type="password"]', process.env.E2E_USER_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL('**/dashboard**', { timeout: 15000 });
    await page.waitForTimeout(2000);
    console.log('✅ Logged in');
    await page.screenshot({ path: 'test-screenshots/browser-01-logged-in.png', fullPage: true });

    // Step 2: Navigate to edit page
    steps.push('2. Navigate to Edit Profile');
    console.log('\n📍 Step 2: Navigating to Edit Profile...');
    await page.goto('http://localhost:3000/dashboard/info/edit', { waitUntil: 'networkidle' });
    await page.waitForTimeout(3000);
    console.log('✅ On edit page');
    await page.screenshot({ path: 'test-screenshots/browser-02-edit-page.png', fullPage: true });

    // Step 3: Find location section
    steps.push('3. Find Location Input');
    console.log('\n📍 Step 3: Finding location input...');

    // Scroll to location field
    await page.evaluate(() => {
      const locationField = document.querySelector(
        '[id="location"], input[placeholder*="zip" i], input[placeholder*="location" i]'
      );
      if (locationField) {
        locationField.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
    await page.waitForTimeout(2000);

    // Check for country selector
    const countryButton = page
      .locator(
        'button:has-text("Switzerland"), button:has-text("United States"), button:has-text("CH")'
      )
      .first();
    const countryExists = await countryButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Country selector found: ${countryExists}`);

    // Check for location input
    const locationInputs = await page
      .locator(
        'input[placeholder*="zip" i], input[placeholder*="location" i], input[placeholder*="city" i]'
      )
      .count();
    console.log(`   Location inputs found: ${locationInputs}`);

    await page.screenshot({
      path: 'test-screenshots/browser-03-location-section.png',
      fullPage: true,
    });

    // Step 4: Test country selector
    if (countryExists) {
      steps.push('4. Test Country Selector');
      console.log('\n📍 Step 4: Testing country selector...');
      await countryButton.scrollIntoViewIfNeeded();
      await countryButton.click();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/browser-04-country-dropdown.png',
        fullPage: true,
      });

      const dropdownVisible = await page
        .locator('button:has-text("United States"), button:has-text("Germany")')
        .first()
        .isVisible({ timeout: 2000 })
        .catch(() => false);
      console.log(`   Dropdown opened: ${dropdownVisible}`);

      if (dropdownVisible) {
        // Click outside to close
        await page.click('body', { position: { x: 100, y: 100 } });
        await page.waitForTimeout(500);
      }
    }

    // Step 5: Test zip code entry
    steps.push('5. Test Zip Code Entry (8053)');
    console.log('\n📍 Step 5: Testing zip code entry "8053"...');

    const zipInput = page
      .locator(
        'input[placeholder*="zip" i], input[placeholder*="location" i], input[placeholder*="city" i]'
      )
      .first();
    const inputVisible = await zipInput.isVisible({ timeout: 5000 }).catch(() => false);

    if (inputVisible) {
      await zipInput.scrollIntoViewIfNeeded();
      await zipInput.click();
      await page.waitForTimeout(500);

      console.log('   Typing "8053"...');
      await zipInput.fill('8053');
      await page.waitForTimeout(3000); // Wait for async lookup

      await page.screenshot({ path: 'test-screenshots/browser-05-typed-8053.png', fullPage: true });

      const inputValue = await zipInput.inputValue();
      console.log(`   Input value: "${inputValue}"`);

      // Check if it auto-filled
      await page.waitForTimeout(2000);
      const finalValue = await zipInput.inputValue();
      console.log(`   Final value: "${finalValue}"`);

      if (finalValue.includes('Zürich') || finalValue.includes('Zurich')) {
        console.log('   ✅✅✅ SUCCESS! Location auto-filled!');
        steps.push('✅ Location auto-filled successfully');
      } else {
        console.log('   ⚠️  Location did not auto-fill');
        steps.push('⚠️ Location did not auto-fill');
      }

      // Check hidden fields
      const cityField = await page
        .evaluate(() => {
          const input = document.querySelector(
            'input[name*="city" i], input[name*="location_city"]'
          );
          return input ? input.value : '';
        })
        .catch(() => '');

      const countryField = await page
        .evaluate(() => {
          const input = document.querySelector(
            'input[name*="country" i], input[name*="location_country"]'
          );
          return input ? input.value : '';
        })
        .catch(() => '');

      console.log(`   City field: "${cityField}"`);
      console.log(`   Country field: "${countryField}"`);
    } else {
      console.log('   ❌ Location input not found!');
      steps.push('❌ Location input not found');
    }

    // Step 6: Test Save
    steps.push('6. Test Save Button');
    console.log('\n📍 Step 6: Testing save button...');
    const saveButton = page.getByRole('button', { name: /save profile/i });
    const saveVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);
    console.log(`   Save button visible: ${saveVisible}`);

    if (saveVisible) {
      await saveButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/browser-06-save-button.png',
        fullPage: true,
      });

      // Don't actually click save - just verify it exists
      console.log('   ✅ Save button found');
    }

    // Summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));
    console.log('\nSteps completed:');
    steps.forEach((step, i) => console.log(`   ${i + 1}. ${step}`));

    if (errors.length > 0) {
      console.log(`\n❌ Errors (${errors.length}):`);
      errors.forEach(e => console.log(`   - ${e}`));
    } else {
      console.log('\n✅ No console errors');
    }

    console.log('\n📸 Screenshots saved to: test-screenshots/');
    console.log('\n🌐 Browser stays open for manual inspection...');
    console.log('   Please verify:');
    console.log('   1. Country selector is visible');
    console.log('   2. Typing "8053" auto-fills location');
    console.log('   3. Save button works');
    console.log('\n   (Press Ctrl+C to close)\n');

    await new Promise(() => {});
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    await page.screenshot({ path: 'test-screenshots/browser-error.png', fullPage: true });
    await new Promise(() => {});
  }
}

browserTestLocation();
