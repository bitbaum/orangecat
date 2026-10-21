import { test, expect } from '@playwright/test';

for (const width of [390, 1280]) {
  test(`Studio keeps one feeling across forms and plays its instrumental at ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const requests: { feeling: string; form: string; revision: string }[] = [];
    await page.route('**/api/ai/creative', async route => {
      const body = route.request().postDataJSON();
      requests.push(body);
      await route.fulfill({
        json: {
          success: true,
          data: {
            title: 'Spring',
            text: 'Morning light. The road remembers.',
            ...(body.form === 'music'
              ? {
                  score: {
                    bpm: 76,
                    chords: [
                      [57, 60, 64],
                      [53, 57, 60],
                      [48, 52, 55],
                      [55, 59, 62],
                    ],
                    melody: [69, null, 72, 71, 67, null, 64, 67],
                    texture: 'soft',
                  },
                }
              : {}),
          },
        },
      });
    });
    await page.goto('/studio');
    await page.getByRole('button', { name: /Listen to the morning sketch/ }).click();
    const audio = page.locator('audio');
    await expect(audio).toBeVisible();
    await expect
      .poll(() => audio.evaluate(a => Number.isFinite(a.duration) && a.duration > 10))
      .toBe(true);
    expect(await audio.evaluate(a => a.paused && !a.autoplay)).toBe(true);
    await audio.evaluate(a => a.play());
    expect(await audio.evaluate(a => a.paused)).toBe(false);
    await audio.evaluate(a => a.pause());
    await page.getByRole('button', { name: 'Create an interpretation', exact: true }).click();
    await page.getByText('AI-assisted draft · Music').waitFor();
    const feeling = requests[0].feeling;
    await page.getByLabel('What would you change?').fill('Leave it unresolved');
    await page.getByRole('button', { name: 'Revise together' }).click();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].revision).toBe('Leave it unresolved');
    await expect(page.getByRole('radio', { name: 'Haiku', exact: true })).toBeEnabled();
    await page.getByRole('radio', { name: 'Haiku', exact: true }).check();
    await page.getByRole('button', { name: 'Create an interpretation', exact: true }).click();
    await page.getByText('AI-assisted draft · Haiku').waitFor();
    expect(requests.at(-1)?.feeling).toBe(feeling);
    await expect(audio).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(
      true
    );
    await page.route('**/api/ai/creative', route =>
      route.fulfill({
        status: 503,
        json: { success: false, error: { message: 'Try again shortly.' } },
      })
    );
    await page.getByRole('button', { name: 'Create an interpretation', exact: true }).click();
    await expect(
      page.getByRole('region', { name: 'Your interpretation' }).getByRole('alert')
    ).toContainText('Try again shortly.');
    await expect(page.getByLabel('What does it feel like?')).toHaveValue(feeling);
  });
}
