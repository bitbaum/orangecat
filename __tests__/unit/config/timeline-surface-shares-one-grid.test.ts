/**
 * The header, the composer and every post sit on ONE grid.
 *
 * Each is a full-width band in the same column, so their horizontal padding
 * decides where their content begins. When they disagree, the feed runs on two
 * grids and scrolling past the composer shifts the avatar column sideways.
 *
 * That is exactly what shipped: `header` and `composer` carried `sm:px-5`,
 * `post` carried only `px-4`. Measured in production at 1322px — header and
 * composer content began at x=467, every post at x=463. Four pixels, on every
 * post, forever. Too small to see and too consistent to ignore; it reads as
 * sloppiness rather than as a bug.
 *
 * A test rather than a code comment because the classes live in three separate
 * strings, and nothing about editing one of them suggests looking at the other
 * two.
 */

import { TIMELINE_SURFACE, TIMELINE_AVATAR_SIZE } from '@/config/timeline';

/** The horizontal padding utilities on a class string, in order. */
function horizontalPadding(classes: string): string[] {
  return classes
    .split(/\s+/)
    .filter(c => /(^|:)px-/.test(c))
    .sort();
}

describe('the timeline surfaces share one grid', () => {
  const bands = {
    header: TIMELINE_SURFACE.header,
    composer: TIMELINE_SURFACE.composer,
    post: TIMELINE_SURFACE.post,
  };

  it('gives every band the same horizontal padding at every breakpoint', () => {
    const padding = Object.fromEntries(
      Object.entries(bands).map(([name, classes]) => [name, horizontalPadding(classes)])
    );

    expect(padding.post).toEqual(padding.composer);
    expect(padding.post).toEqual(padding.header);
  });

  it('actually declares padding, so the check cannot pass vacuously', () => {
    // Three empty arrays are also "equal". Without this, deleting px-* from
    // all three would satisfy the test above while breaking the layout.
    for (const [name, classes] of Object.entries(bands)) {
      expect(horizontalPadding(classes).length).toBeGreaterThan(0);
      expect(classes).toContain('px-4');
      expect(name).toBeTruthy();
    }
  });

  it('has one avatar size for the whole feed', () => {
    // The avatar's width sets the left edge of the text column in every row.
    // The composer used 44 while posts used 40, so the composer's text began
    // 4px right of every post body underneath it.
    expect(TIMELINE_AVATAR_SIZE).toBe(40);
  });
});
