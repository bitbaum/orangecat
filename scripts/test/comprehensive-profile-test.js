const { chromium } = require('playwright');
const fs = require('fs');

async function comprehensiveTest() {
  let browser;
  let page;
  const errors = [];
  const warnings = [];

  try {
    browser = await chromium.launch({
      headless: false,
      devtools: true, // Open devtools to see console errors
      args: ['--start-maximized'],
    });

    const context = await browser.newContext({
      viewport: { width: 1920, height: 1080 },
    });

    page = await context.newPage();

    // Listen for console errors
    page.on('console', msg => {
      const type = msg.type();
      const text = msg.text();
      if (type === 'error') {
        errors.push(text);
        console.log(`❌ Console Error: ${text}`);
      } else if (type === 'warning') {
        warnings.push(text);
        console.log(`⚠️  Console Warning: ${text}`);
      }
    });

    // Listen for page errors
    page.on('pageerror', error => {
      errors.push(error.message);
      console.log(`❌ Page Error: ${error.message}`);
    });

    console.log('\n🚀 Starting Comprehensive Profile Test...\n');

    // Step 1: Navigate and login
    console.log('📍 Step 1: Navigating to homepage and signing in...');
    await page.goto('http://localhost:3000', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);

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

    await page.screenshot({
      path: 'test-screenshots/comprehensive-01-after-auth.png',
      fullPage: true,
    });
    console.log('✅ Signed in successfully\n');

    // Step 2: Test View Mode - Check all fields are shown
    console.log('📍 Step 2: Testing View Mode - All fields should be visible...');
    await page.goto('http://localhost:3000/dashboard/info', { waitUntil: 'networkidle' });
    await page.waitForTimeout(2000);
    await page.screenshot({
      path: 'test-screenshots/comprehensive-02-view-mode.png',
      fullPage: true,
    });

    // Check for empty field indicators
    const emptyFieldIndicators = await page.locator('text=/Not filled out yet/i').count();
    console.log(`   Found ${emptyFieldIndicators} empty field indicators`);

    // Check for all expected fields
    const expectedFields = [
      'Username',
      'Display Name',
      'About',
      'Location',
      'Website',
      'Contact Email',
      'Phone',
      'Social Media',
    ];
    for (const field of expectedFields) {
      const found = await page.locator(`text=/${field}/i`).count();
      if (found === 0) {
        warnings.push(`Field "${field}" not found in view mode`);
        console.log(`   ⚠️  Field "${field}" not found`);
      } else {
        console.log(`   ✅ Field "${field}" found`);
      }
    }

    // Step 3: Test Edit Mode - Check structure and functionality
    console.log('\n📍 Step 3: Testing Edit Mode...');
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
    await page.waitForTimeout(3000);
    await page.screenshot({
      path: 'test-screenshots/comprehensive-03-edit-mode.png',
      fullPage: true,
    });

    // Check for guidance sidebar
    const guidanceElements = await page
      .locator('text=/Profile Completion|Help & Guidance|Tips/i')
      .count();
    console.log(`   Guidance sidebar elements: ${guidanceElements}`);
    if (guidanceElements === 0) {
      warnings.push('Guidance sidebar not visible in edit mode');
      console.log('   ⚠️  Guidance sidebar not found');
    } else {
      console.log('   ✅ Guidance sidebar visible');
    }

    // Check for Save button
    const saveButton = page.getByRole('button', { name: /save profile/i });
    const saveButtonVisible = await saveButton.isVisible({ timeout: 5000 }).catch(() => false);
    const saveButtonEnabled = saveButtonVisible
      ? await saveButton.isEnabled().catch(() => false)
      : false;

    console.log(`   Save button visible: ${saveButtonVisible}`);
    console.log(`   Save button enabled: ${saveButtonEnabled}`);

    if (!saveButtonVisible) {
      errors.push('Save button not visible in edit mode');
      console.log('   ❌ Save button NOT FOUND - CRITICAL ISSUE!');
    } else {
      // Check Save button styling
      const saveButtonStyles = await saveButton.evaluate(el => {
        const styles = window.getComputedStyle(el);
        return {
          backgroundColor: styles.backgroundColor,
          fontSize: styles.fontSize,
          fontWeight: styles.fontWeight,
          padding: styles.padding,
        };
      });
      console.log(`   Save button styles:`, saveButtonStyles);

      // Scroll to Save button and screenshot
      await saveButton.scrollIntoViewIfNeeded();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/comprehensive-04-save-button.png',
        fullPage: true,
      });
    }

    // Check for Add Link button (should be subtle)
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
          textDecoration: styles.textDecoration,
        };
      });
      console.log(`   Add Link styles:`, addLinkStyles);

      // Verify it's subtle (small font, gray color)
      if (parseFloat(addLinkStyles.fontSize) > 14) {
        warnings.push('Add Link button might be too prominent');
      }
    }

    // Step 4: Test form functionality
    console.log('\n📍 Step 4: Testing form functionality...');

    // Fill phone field
    const phoneInput = page
      .locator('input[type="tel"], input[placeholder*="phone" i], input[placeholder*="+41" i]')
      .first();
    if (await phoneInput.isVisible({ timeout: 5000 }).catch(() => false)) {
      await phoneInput.fill('+41 79 123 45 67');
      await page.waitForTimeout(1000);
      console.log('   ✅ Filled phone field');
    }

    // Check if form fields are accessible
    const formFields = ['username', 'name', 'bio', 'location', 'website', 'contact_email', 'phone'];
    for (const field of formFields) {
      const input = page
        .locator(
          `input[name="${field}"], input[placeholder*="${field}" i], textarea[name="${field}"]`
        )
        .first();
      const visible = await input.isVisible({ timeout: 2000 }).catch(() => false);
      if (visible) {
        console.log(`   ✅ Field "${field}" is accessible`);
      } else {
        warnings.push(`Field "${field}" might not be accessible`);
      }
    }

    // Step 5: Test guidance sidebar interaction
    console.log('\n📍 Step 5: Testing guidance sidebar interaction...');
    await page.evaluate(() => window.scrollTo(0, 400));
    await page.waitForTimeout(2000);

    // Focus on a field to trigger guidance
    const bioTextarea = page
      .locator('textarea[placeholder*="story" i], textarea[name="bio"]')
      .first();
    if (await bioTextarea.isVisible({ timeout: 5000 }).catch(() => false)) {
      await bioTextarea.focus();
      await page.waitForTimeout(1000);
      await page.screenshot({
        path: 'test-screenshots/comprehensive-05-guidance-active.png',
        fullPage: true,
      });
      console.log('   ✅ Focused on bio field - guidance should update');
    }

    // Step 6: Check for duplicate headers
    console.log('\n📍 Step 6: Checking for duplicate headers...');
    const editHeaders = await page
      .locator('h1, h2')
      .filter({ hasText: /edit profile/i })
      .count();
    console.log(`   Found ${editHeaders} "Edit Profile" headers`);
    if (editHeaders > 1) {
      warnings.push(`Found ${editHeaders} duplicate "Edit Profile" headers`);
    }

    // Step 7: Check overall layout and design
    console.log('\n📍 Step 7: Checking layout and design...');
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.waitForTimeout(1000);
    await page.screenshot({
      path: 'test-screenshots/comprehensive-06-full-layout.png',
      fullPage: true,
    });

    // Check for proper spacing and visual hierarchy
    const cards = await page.locator('[class*="Card"], [class*="card"]').count();
    console.log(`   Found ${cards} card elements`);

    // Final summary
    console.log('\n' + '='.repeat(60));
    console.log('📊 TEST SUMMARY');
    console.log('='.repeat(60));

    if (errors.length === 0 && warnings.length === 0) {
      console.log('✅ ALL TESTS PASSED - No errors or warnings!');
    } else {
      if (errors.length > 0) {
        console.log(`\n❌ ERRORS (${errors.length}):`);
        errors.forEach((err, i) => console.log(`   ${i + 1}. ${err}`));
      }
      if (warnings.length > 0) {
        console.log(`\n⚠️  WARNINGS (${warnings.length}):`);
        warnings.forEach((warn, i) => console.log(`   ${i + 1}. ${warn}`));
      }
    }

    console.log('\n📸 Screenshots saved to: test-screenshots/');
    console.log('\n🌐 Browser will stay open for inspection...');
    console.log('   (Press Ctrl+C to close)\n');

    // Save test report
    const report = {
      timestamp: new Date().toISOString(),
      errors,
      warnings,
      summary: {
        totalErrors: errors.length,
        totalWarnings: warnings.length,
        passed: errors.length === 0 && warnings.length === 0,
      },
    };

    fs.writeFileSync('test-screenshots/test-report.json', JSON.stringify(report, null, 2));
    console.log('📄 Test report saved to: test-screenshots/test-report.json\n');

    await new Promise(() => {}); // Keep browser open
  } catch (error) {
    console.error('\n❌ FATAL ERROR:', error.message);
    console.error(error.stack);
    await page?.screenshot({ path: 'test-screenshots/comprehensive-error.png', fullPage: true });
    console.log('📸 Error screenshot saved');
    await new Promise(() => {}); // Keep browser open even on error
  }
}

console.log('🚀 Starting Comprehensive Profile Test...');
comprehensiveTest();
