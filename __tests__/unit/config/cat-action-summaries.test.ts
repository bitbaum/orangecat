/**
 * "What Cat can do" showed the model's tool instructions as the description of
 * 14 actions (orangecat.ch, 2026-11-12): "Dispatched, not done: say SENT",
 * "The setup step, NOT add_wallet", "Use it, never forget_memories". A person
 * deciding what Cat may do reads `summary ?? description`; it must be written
 * for them.
 */
import { CAT_ACTIONS } from '@/config/cat-actions';

const shown = Object.values(CAT_ACTIONS)
  .filter(a => a.enabled)
  .map(a => ({ id: a.id, text: a.summary ?? a.description }));

// Acronyms people read; anything else in capitals is an order to the model.
const ACRONYMS = new Set(['BTC', 'CHF', 'NWC', 'PR', 'URL', 'AI', 'API']);

describe('what the permissions page shows for each action', () => {
  it.each(shown)('$id names no tool', ({ text }) => {
    expect(text).not.toMatch(/\b[a-z]+_[a-z_]+\b/);
  });

  it.each(shown)('$id gives the model no orders', ({ text }) => {
    const shouted = (text.match(/\b[A-Z]{2,}\b/g) ?? []).filter(w => !ACRONYMS.has(w));
    expect(shouted).toEqual([]);
    expect(text).not.toMatch(/\bthe user\b|\buser's\b|\bUse (this|it)\b/i);
  });
});
