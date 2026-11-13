import { describe, expect, it } from 'vitest';
import { COMPANION_COPY } from '@/config/companions';
import { COMPANION_HANDS } from '@/services/companions/hands';
import { chipsFor } from '@/components/companions/talk/SuggestionChips';

/**
 * The chips above a bot's message box offer only what that bot can do: a
 * chip is there while its ability is on, and every chip names a real one.
 */
describe('suggestion chips', () => {
  const items = COMPANION_COPY.talk.chips.items;

  it('names only abilities a bot has', () => {
    for (const chip of items) {
      expect(COMPANION_HANDS).toContain(chip.hand);
    }
  });

  it('shows a chip only while its ability is switched on', () => {
    const all = items.map(c => ({ id: c.hand, mode: 'ask' as const }));
    expect(chipsFor(all).map(c => c.label)).toEqual(items.map(c => c.label));
    const without = all.map(h => (h.id === 'walk_site' ? { ...h, mode: 'off' as const } : h));
    expect(chipsFor(without).map(c => c.label)).not.toContain('Check a site');
    expect(chipsFor([])).toEqual([]);
  });

  it('a chip that is finished by the person ends ready to be typed after', () => {
    for (const chip of items) {
      expect(chip.draft.endsWith(': ') || chip.draft.endsWith('?')).toBe(true);
    }
  });
});
