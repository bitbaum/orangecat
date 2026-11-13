/**
 * Every Cat action has words for a person, and none of them read like the
 * model's tool prompt. The permission screens render these beside each switch;
 * they used to render `description`, which names other tool ids, shouts NOT
 * and talks about "the user".
 */
import { describe, expect, it } from 'vitest';
import { CAT_ACTIONS, RISK_COLORS } from '@/config/cat-actions';
import { CAT_ACTION_SUMMARIES, catActionSummary } from '@/config/cat-action-summaries';

const summaries = Object.entries(CAT_ACTION_SUMMARIES);

describe('Cat action summaries', () => {
  it('cover every action', () => {
    const missing = Object.keys(CAT_ACTIONS).filter(id => !CAT_ACTION_SUMMARIES[id]);
    expect(missing).toEqual([]);
  });

  it('name no action that does not exist', () => {
    const stale = Object.keys(CAT_ACTION_SUMMARIES).filter(id => !CAT_ACTIONS[id]);
    expect(stale).toEqual([]);
  });

  it.each(summaries)('%s reads like words for a person', (_id, summary) => {
    expect(summary).not.toMatch(/\w_\w/); // a tool id such as add_wallet
    expect(summary).not.toMatch(/\bthe user\b/i);
    expect(summary).not.toMatch(/\b[A-Z]{3,}\b/); // NOT, STARTED, SENT
    expect(summary.length).toBeLessThanOrEqual(90);
    expect(summary.trim()).toBe(summary);
  });

  it('is what a person sees, not the model description', () => {
    const action = CAT_ACTIONS.connect_wallet;
    expect(catActionSummary(action)).toBe(CAT_ACTION_SUMMARIES.connect_wallet);
    expect(catActionSummary(action)).not.toBe(action.description);
  });

  it('risk tiles use status tokens, which carry a dark value', () => {
    for (const classes of Object.values(RISK_COLORS)) {
      expect(classes).toMatch(/^text-status-\w+ bg-status-\w+-subtle$/);
    }
  });
});
