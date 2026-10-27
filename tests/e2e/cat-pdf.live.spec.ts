/**
 * The Cat reads PDFs — checked on the live site, in Chromium, Firefox and
 * WebKit (Safari's engine), signed in as the E2E account.
 *
 * Found 2026-10-27: an investor deck (slides exported as JPEG 2000 pictures,
 * no text layer) could not be attached at all. This proves, against what is
 * actually deployed, that:
 *   - pdf.js's worker and JPEG 2000 decoder are served from /pdfjs/,
 *   - a PDF of slide pictures attaches as page pictures that are drawn, not blank,
 *   - a PDF with text attaches as a file.
 * Nothing is sent to the Cat, so a run costs no model call.
 */
import path from 'node:path';
import { test, expect, type Page } from '@playwright/test';
import { requireE2ECredentials } from './helpers/credentials';

const baseURL = process.env.E2E_BASE_URL || 'http://localhost:3000';
const fixture = (name: string) => path.join(__dirname, 'fixtures', name);

async function signIn(page: Page) {
  const { email, password } = requireE2ECredentials();
  await page.goto(`${baseURL}/auth?mode=login`, { waitUntil: 'domcontentloaded' });
  await page.locator('input[type="email"]').fill(email);
  await page.locator('input[type="password"]').fill(password);
  await page.locator('form button[type="submit"]').first().click();
  await page.waitForURL(/\/(dashboard|timeline|onboarding)/, { timeout: 20000 });
}

async function openCat(page: Page) {
  await page.goto(`${baseURL}/dashboard/cat`, { waitUntil: 'domcontentloaded' });
  await expect(page.locator('input[data-ck-source="files"]').first()).toBeAttached({
    timeout: 20000,
  });
}

// chatkit's staged strip: a file is a chip with its name, a picture is a thumbnail
// whose alt is its name. A refusal is chatkit's `.ck-note` under the strip.
const chips = (page: Page) => page.locator('.ck-attach-item');

test.describe('Cat reads PDFs (live)', () => {
  test.use({ storageState: { cookies: [], origins: [] } });

  test('pdf.js runtime files are served', async ({ request }) => {
    const worker = await request.get(`${baseURL}/pdfjs/pdf.worker.min.mjs`);
    expect(worker.status()).toBe(200);
    expect(worker.headers()['content-type']).toMatch(/javascript/);
    const jpx = await request.get(`${baseURL}/pdfjs/wasm/openjpeg.wasm`);
    expect(jpx.status()).toBe(200);
    console.log('pdfjs:', (await (await request.get(`${baseURL}/pdfjs/VERSION`)).text()).trim());
  });

  test('a deck of slide pictures attaches as drawn page sheets', async ({ page }) => {
    await signIn(page);
    await openCat(page);
    await page
      .locator('input[data-ck-source="files"]')
      .first()
      .setInputFiles(fixture('slides-jpx.pdf'));

    const sheet = chips(page).filter({
      has: page.locator('img[alt="slides-jpx.pdf · pages 1–2"]'),
    });
    await expect(sheet).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('.ck-note')).toHaveCount(0);

    // Ink on the thumbnail: a page whose JPEG 2000 failed to decode is plain white.
    const ink = await sheet.locator('img').evaluate(async (img: HTMLImageElement) => {
      await img.decode();
      const c = document.createElement('canvas');
      c.width = 64;
      c.height = 36;
      const g = c.getContext('2d')!;
      g.drawImage(img, 0, 0, 64, 36);
      const px = g.getImageData(0, 0, 64, 36).data;
      let dark = 0;
      for (let i = 0; i < px.length; i += 4) if (px[i] + px[i + 1] + px[i + 2] < 600) dark++;
      return dark / (px.length / 4);
    });
    console.log('sheet ink share:', ink.toFixed(2));
    expect(ink).toBeGreaterThan(0.3);
  });

  test('a PDF with text attaches as a file', async ({ page }) => {
    await signIn(page);
    await openCat(page);
    await page.locator('input[data-ck-source="files"]').first().setInputFiles(fixture('text.pdf'));
    await expect(chips(page).filter({ hasText: 'text.pdf' })).toHaveCount(1, { timeout: 30000 });
    await expect(page.locator('.ck-note')).toHaveCount(0);
  });
});
