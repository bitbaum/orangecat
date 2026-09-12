/**
 * The chip must name what Cat did — for EVERY action, not seven of them.
 *
 * Measured before this gate existed: 62 distinct tool names can reach
 * `ToolCallChip`, and 7 had labels. The other 55 — every action in the registry
 * — rendered "Working…" and then "Done (1)". `send_payment`, `fund_project` and
 * `like_post` produced the same sentence as each other, so a user watching Cat
 * work could not tell a payment from a like.
 *
 * The registry already held the words. This gate keeps it that way: it is not a
 * spot-check of favourite actions, it iterates the registry, so an action added
 * tomorrow is covered tomorrow or CI says which verb is missing. That is the
 * only thing wrong with a list — not that it exists, but that it can drift in
 * silence.
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { labelForTool, conjugateAction, DEFAULT_LABEL, VERB_FORMS } from '@/lib/chat/tool-labels';

const ROOT = join(__dirname, '../../..');
const actionIds = Object.keys(CAT_ACTIONS);

describe('every action in the registry has words of its own', () => {
  it('has something to cover at all', () => {
    // Guards the gate itself: an empty registry would make every loop below
    // vacuously green, which is how a coverage test quietly stops covering.
    expect(actionIds.length).toBeGreaterThan(40);
  });

  it('never falls back to the generic label', () => {
    const generic = actionIds.filter(id => labelForTool(id) === DEFAULT_LABEL);
    expect(generic, `these would render "Working…" / "Done (1)": ${generic.join(', ')}`).toEqual(
      []
    );
  });

  it('knows the leading verb of every action', () => {
    // The failure message IS the fix: it names the verb to add.
    const missing = actionIds
      .filter(id => conjugateAction(id) === null)
      .map(id => `${id} (verb "${CAT_ACTIONS[id]!.name.split(' ')[0]}")`);
    expect(missing, `add these to VERB_FORMS in src/lib/chat/tool-labels.ts`).toEqual([]);
  });

  it('says something different while running than when done', () => {
    // A conjugation that returned the same string twice would pass the coverage
    // check above while telling the user nothing about which state they are in.
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
});

describe("the English is the registry's, conjugated", () => {
  it('uses the present participle while running and the past tense when done', () => {
    expect(labelForTool('create_project').running).toBe('Creating project');
    expect(labelForTool('create_project').completed(1)).toBe('Created project');
    expect(labelForTool('send_message').running).toBe('Sending message');
    // The reason a lookup table exists rather than a rule: "sended" would ship.
    expect(labelForTool('send_message').completed(1)).toBe('Sent message');
    expect(labelForTool('build_site').completed(1)).toBe('Built a website');
  });

  it('leaves a proper noun alone while lowering an ordinary word', () => {
    // "Send to FleetCrown" must not become "send to fleetcrown", and
    // "Create AI Assistant" must not become "Create ai assistant".
    expect(labelForTool('send_to_fleetcrown').completed(1)).toBe('Sent to FleetCrown');
    expect(labelForTool('send_to_fleetcrown').failed).toBe("Couldn't send to FleetCrown");
    expect(labelForTool('create_ai_assistant').completed(1)).toBe('Created AI assistant');
  });

  it('names the action in the confirmation state instead of a generic nudge', () => {
    // Seen live 2026-09-10: a pending action read "Needs your confirmation" with
    // no clue WHAT was waiting. With several chips in a thread that is unusable.
    expect(labelForTool('send_payment').pending).toBe('Send payment — needs your confirmation');
  });

  it('keeps an irregular past that happens to equal the infinitive', () => {
    // "set" is its own past tense; a naive "+ed" rule would print "Setted".
    expect(labelForTool('set_reminder').completed(1)).toBe('Set reminder');
  });
});

describe('the tools that READ keep their own wording', () => {
  it('distinguishes "we looked and found nothing" from "we never got to look"', () => {
    // The three-answer shape from ADR-0007. Flattening these into one past
    // tense would destroy the distinction the web tools exist to preserve.
    for (const tool of ['web_search', 'read_page', 'search_platform']) {
      const l = labelForTool(tool);
      expect(l.noResults, tool).not.toBe(l.failed);
      expect(l, tool).not.toBe(DEFAULT_LABEL);
    }
  });

  it('counts what a search found, which an action cannot meaningfully do', () => {
    expect(labelForTool('web_search').completed(3)).toBe('Found 3 sources');
    expect(labelForTool('web_search').completed(1)).toBe('Found 1 source');
    // An action's resultCount is a hard-coded 1, so it must not be printed.
    expect(labelForTool('fund_project').completed(7)).toBe('Funded project');
  });
});

describe('the verb table cannot rot unnoticed', () => {
  it('carries no verb the registry has stopped using', () => {
    // The other direction of drift: dead entries accumulate and nobody dares
    // remove them because nobody knows what still needs them.
    const used = new Set(actionIds.map(id => CAT_ACTIONS[id]!.name.split(' ')[0]!.toLowerCase()));
    const unused = Object.keys(VERB_FORMS).filter(v => !used.has(v));
    expect(unused, `unused verbs in VERB_FORMS: ${unused.join(', ')}`).toEqual([]);
  });

  it('is what the chip actually calls — not a parallel copy', () => {
    // A derivation nothing renders is decoration. The component must hold no
    // label map of its own; that map is precisely what rotted.
    const chip = readFileSync(
      join(ROOT, 'src/components/ai-chat/ModernChatPanel/components/ToolCallChip.tsx'),
      'utf8'
    ).replace(/\/\*[\s\S]*?\*\//g, '');
    expect(chip).toContain('labelForTool(event.name)');
    expect(chip).not.toContain('const TOOL_LABELS');
  });
});
