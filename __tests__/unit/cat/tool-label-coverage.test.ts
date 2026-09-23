/**
 * The chip must name what Cat did — for EVERY action, not seven of them.
 *
 * The registry already held the words. This gate iterates it so an action
 * added tomorrow is covered tomorrow. Spot-check conjugation examples are not
 * worth a second describe — the registry loop catches missing verbs.
 */
import { CAT_ACTIONS } from '@/config/cat-actions';
import { labelForTool, conjugateAction, DEFAULT_LABEL, VERB_FORMS } from '@/lib/chat/tool-labels';

const actionIds = Object.keys(CAT_ACTIONS);

describe('every action in the registry has words of its own', () => {
  it('has something to cover at all', () => {
    expect(actionIds.length).toBeGreaterThan(40);
  });

  it('never falls back to the generic label', () => {
    const generic = actionIds.filter(id => labelForTool(id) === DEFAULT_LABEL);
    expect(generic, `these would render "Working…" / "Done (1)": ${generic.join(', ')}`).toEqual(
      []
    );
  });

  it('knows the leading verb of every action', () => {
    const missing = actionIds
      .filter(id => conjugateAction(id) === null)
      .map(id => `${id} (verb "${CAT_ACTIONS[id]!.name.split(' ')[0]}")`);
    expect(missing, `add these to VERB_FORMS in src/lib/chat/tool-labels.ts`).toEqual([]);
  });

  it('says something different while running than when done', () => {
    for (const id of actionIds) {
      const l = labelForTool(id);
      expect(l.running, id).not.toBe(l.completed(1));
      expect(l.completed(1), id).not.toBe(l.failed);
      expect(l.running.length, id).toBeGreaterThan(3);
    }
  });

  it('never prints a raw tool id or a snake_case fragment at a user', () => {
    for (const id of actionIds) {
      const l = labelForTool(id);
      for (const text of [l.running, l.completed(1), l.failed, l.pending ?? '']) {
        expect(text, `${id}: "${text}"`).not.toContain('_');
      }
    }
  });

  it('names pending confirmation with the action, not a generic nudge', () => {
    expect(labelForTool('send_payment').pending).toBe('Send payment — needs your confirmation');
  });
});

describe('the tools that READ keep their own wording', () => {
  it('distinguishes "we looked and found nothing" from "we never got to look"', () => {
    for (const tool of ['web_search', 'read_page', 'search_platform']) {
      const l = labelForTool(tool);
      expect(l.noResults, tool).not.toBe(l.failed);
      expect(l, tool).not.toBe(DEFAULT_LABEL);
    }
  });

  it('counts what a search found, which an action cannot meaningfully do', () => {
    expect(labelForTool('web_search').completed(3)).toBe('Found 3 sources');
    expect(labelForTool('web_search').completed(1)).toBe('Found 1 source');
    expect(labelForTool('fund_project').completed(7)).toBe('Funded project');
  });
});

describe('the verb table cannot rot unnoticed', () => {
  it('carries no verb the registry has stopped using', () => {
    const used = new Set(actionIds.map(id => CAT_ACTIONS[id]!.name.split(' ')[0]!.toLowerCase()));
    const unused = Object.keys(VERB_FORMS).filter(v => !used.has(v));
    expect(unused, `unused verbs in VERB_FORMS: ${unused.join(', ')}`).toEqual([]);
  });
});
