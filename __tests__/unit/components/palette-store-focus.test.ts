// @vitest-environment jsdom
/**
 * Closing the palette hands focus back to what opened it.
 *
 * It is opened from outside state (two header triggers, ⌘K, "/"), not from a
 * Radix Dialog.Trigger, so Radix had nothing to return focus to and it fell to
 * the top of the page.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setPaletteOpen } from '@/components/search/palette-store';

describe('palette focus return', () => {
  beforeEach(() => {
    vi.spyOn(window, 'requestAnimationFrame').mockImplementation(cb => {
      cb(0);
      return 0;
    });
  });

  afterEach(() => {
    setPaletteOpen(false);
    vi.restoreAllMocks();
    document.body.innerHTML = '';
  });

  it('refocuses the trigger once the dialog has let go of focus', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    setPaletteOpen(true);
    trigger.blur(); // the dialog took focus, then unmounted
    setPaletteOpen(false);

    expect(document.activeElement).toBe(trigger);
  });

  it('leaves focus alone when something else has taken it', () => {
    const trigger = document.createElement('button');
    const elsewhere = document.createElement('input');
    document.body.append(trigger, elsewhere);
    trigger.focus();

    setPaletteOpen(true);
    elsewhere.focus();
    setPaletteOpen(false);

    expect(document.activeElement).toBe(elsewhere);
  });

  it('does not reach for a trigger that has left the page', () => {
    const trigger = document.createElement('button');
    document.body.appendChild(trigger);
    trigger.focus();

    setPaletteOpen(true);
    trigger.remove();
    setPaletteOpen(false);

    expect(document.activeElement).toBe(document.body);
  });
});
