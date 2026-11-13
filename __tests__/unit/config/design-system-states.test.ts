/**
 * Interaction states that can be seen.
 *
 * In light theme --surface-raised is 96% on a 97% page, so a hover or open
 * state painted with it was invisible, and no button had a pressed state.
 * States use --surface-overlay (94% light, 17% dark), and every variant
 * answers a press.
 */
import { describe, expect, it } from 'vitest';
import { COMPONENT_STYLES } from '@/config/design-system';
import { HEADER_ICON_BUTTON } from '@/components/layout/HeaderIconButton';
import { SIDEBAR_COLORS } from '@/constants/sidebar';

const variants = {
  ...Object.fromEntries(
    Object.entries(COMPONENT_STYLES.button.variants).map(([k, v]) => [`button.${k}`, v])
  ),
  ...Object.fromEntries(
    Object.entries(COMPONENT_STYLES.iconButton.variants).map(([k, v]) => [`iconButton.${k}`, v])
  ),
};

describe('interaction states', () => {
  it.each(Object.entries(variants))('%s has a pressed state', (_name, classes) => {
    expect(classes).toMatch(/(^|\s)active:bg-/);
  });

  it.each(Object.entries(variants))('%s never hovers to surface-raised', (_name, classes) => {
    expect(classes).not.toMatch(/hover:bg-surface-raised\b/);
  });

  it('the header rail and the sidebar mark hover and open with surface-overlay', () => {
    expect(HEADER_ICON_BUTTON.variants.ghost).toContain('hover:bg-surface-overlay');
    expect(HEADER_ICON_BUTTON.active.ghost).toContain('bg-surface-overlay');
    expect(SIDEBAR_COLORS.HOVER_BACKGROUND).toBe('hover:bg-surface-overlay');
    expect(SIDEBAR_COLORS.ACTIVE_BACKGROUND).toBe('bg-surface-overlay');
  });
});
