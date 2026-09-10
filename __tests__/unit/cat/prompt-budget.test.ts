import {
  buildCatSystemPrompt,
  stripActionProseSections,
  ACTION_PROSE_SECTION_HEADINGS,
  ACTION_INSTRUCTION_SECTION_HEADINGS,
  type ActionsVia,
} from '@/services/cat/system-prompt';
import { actionToolDefinitions } from '@/services/cat/action-schemas';
import { getCatFewShotExamplesText } from '@/services/cat/few-shot-examples';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { GROQ_ON_DEMAND_TPM_LIMIT, GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq';

/**
 * The prompt has a size budget, and it only ratchets DOWN.
 *
 * Nothing watched this number, so it grew every time an action or a section was
 * added — to 60,322 characters shipped on EVERY message, before a single byte
 * of the user's own context. The cost is not theoretical: it is why platform
 * Groq can never serve Cat.
 *
 * Groq's on-demand tier allows GROQ_ON_DEMAND_TPM_LIMIT tokens per minute, and
 * the reserved output counts against the same bucket, so the whole assembled
 * prompt must fit in (12000 - 2048) * 4 ≈ 39,808 characters. Cat's static
 * prompt alone is over that before any memories, profile, history or page
 * excerpt are appended — so `overflowsPlatformGroq` skips Groq pre-flight on
 * every request, and everything falls to OpenRouter's free tier, which is
 * capped at 50 requests/day across ALL users. That cap is what turned six real
 * users away in June 2026 (see failed-turn.ts).
 *
 * So this file is not style policing. The number is a product constraint.
 */

/** Whole-prompt ceiling for the on-demand Groq tier, derived — never hardcoded. */
const GROQ_PROMPT_CEILING_CHARS = (GROQ_ON_DEMAND_TPM_LIMIT - GROQ_CHAT_MAX_TOKENS) * 4;

/**
 * Current high-water mark. RATCHET: lower it when the prompt shrinks; do not
 * raise it to make a failing build pass. Growing the prompt spends capacity
 * that real users need, so it has to be a conscious, argued decision — which is
 * exactly what was missing while it grew to 60k.
 */
const PROMPT_BUDGET_CHARS = 54_600;

/**
 * Budget for the path production actually serves: Groq and OpenRouter both get
 * native tool definitions, so the prose catalog is dropped (ADR-0006 D7).
 *
 * RATCHET, same rule as above: lower it when the prompt shrinks, never raise it
 * to make a build pass.
 */
const TOOLS_PROMPT_BUDGET_CHARS = 35_600;

function assembledStaticPrompt(actionsVia?: ActionsVia): string {
  // Mirrors chat-orchestrator: system prompt + few-shot examples. User context,
  // history and the message itself are added on top of this at request time.
  return `${buildCatSystemPrompt({ actionsVia })}\n\n${getCatFewShotExamplesText()}`;
}

describe('Cat prompt size', () => {
  it('does not grow past its budget', () => {
    const chars = assembledStaticPrompt().length;
    expect(chars).toBeLessThanOrEqual(PROMPT_BUDGET_CHARS);
  });

  it('reports how far it still is from being servable by platform Groq', () => {
    const chars = assembledStaticPrompt().length;
    const overshoot = chars - GROQ_PROMPT_CEILING_CHARS;
    // Not an assertion about passing today — a standing, visible measurement of
    // the gap, so shrinking work has a target instead of a vague "make it
    // smaller". When this goes negative the static prompt fits, and the real
    // goal is lower still: user context must fit in the same budget.
    // eslint-disable-next-line no-console
    console.info(
      `[cat prompt] ${chars} chars · Groq ceiling ${GROQ_PROMPT_CEILING_CHARS} · overshoot ${overshoot}`
    );
    expect(GROQ_PROMPT_CEILING_CHARS).toBeGreaterThan(0);
  });
});

describe('every action stays reachable', () => {
  // The prompt IS the routing table. An enabled action that appears nowhere in
  // it cannot be chosen, no matter how correct its handler is — that is how
  // publish_interest lost to update_profile (see action-disambiguation.test.ts).
  //
  // This matters most for future shrinking work: the tempting way to cut the
  // prompt is to include only the actions that look relevant to the turn, and
  // this is the invariant that must survive it.
  const enabled = Object.values(CAT_ACTIONS).filter(a => a.enabled);

  it('documents at least one action (guards against an empty registry)', () => {
    expect(enabled.length).toBeGreaterThan(10);
  });

  /**
   * Deliberately NOT `toContain(id)`. An id gets mentioned in passing all over
   * the prompt ("publish_entity and archive_entity require confirmation"), so a
   * bare substring match passes even when the action has no usable
   * documentation at all — it was silently vacuous until a mutation test caught
   * it. An action is only reachable in a form the model can emit:
   *   - a catalog line `**id(params)**`, or
   *   - a worked example containing `"actionId": "id"`.
   */
  function isDocumentedActionably(prompt: string, id: string): boolean {
    return prompt.includes(`**${id}(`) || prompt.includes(`"actionId": "${id}"`);
  }

  it.each(enabled.map(a => a.id))('%s is documented in an emittable form', id => {
    expect(isDocumentedActionably(assembledStaticPrompt(), id)).toBe(true);
  });
});

describe('the prose catalog is dropped where tool definitions carry it', () => {
  // ADR-0006 D7. "Actions You Can Execute Directly" and "Tools You Can Call"
  // describe, in English, the same CAT_ACTIONS registry that action-schemas.ts
  // ships as JSON Schema. On Groq and OpenRouter the definitions ARE sent, so
  // the prose is the catalog a second time - measured 2026-09-10 at 18,871
  // chars, 34.8% of the assembled prompt, on every single message.

  it('costs 18k fewer chars than the prose path', () => {
    const prose = assembledStaticPrompt('prose').length;
    const tools = assembledStaticPrompt('tools').length;
    expect(tools).toBeLessThan(prose);
    // Not an exact equality: the prompt will keep changing. The claim is that
    // the cut is LARGE - if it ever shrinks below this, the sections stopped
    // being where the weight is and the mechanism needs re-measuring.
    expect(prose - tools).toBeGreaterThan(15_000);
  });

  it('stays inside the tools-path budget', () => {
    expect(assembledStaticPrompt('tools').length).toBeLessThanOrEqual(TOOLS_PROMPT_BUDGET_CHARS);
  });

  it('leaves the prose path byte-for-byte alone', () => {
    // A caller that says nothing must get exactly what it got before
    // actionsVia existed. Dropping the catalog is opt-in by provider
    // capability; it is never the default an un-migrated caller falls into.
    expect(buildCatSystemPrompt({})).toBe(buildCatSystemPrompt({ actionsVia: 'prose' }));
  });

  it('removes both sections and keeps the rest', () => {
    const tools = buildCatSystemPrompt({ actionsVia: 'tools' });
    for (const heading of ACTION_PROSE_SECTION_HEADINGS) {
      expect(tools).not.toContain(`## ${heading}`);
    }
    // The sections AFTER the dropped ones must survive - a slice-to-end-of-file
    // bug would take the whole tail and nothing else here would notice.
    expect(tools).toContain('## Critical Rules');
  });

  it('fails loudly if a heading stops matching the prompt', () => {
    // The headings are strings that must track prose. A silent miss would ship
    // the 36% this mechanism exists to remove, and every other test here would
    // still pass, so the miss has to throw.
    expect(() => stripActionProseSections('## Some Other Section\nnothing to drop')).toThrow(
      /not found in prompt/
    );
  });
});

describe('every action stays reachable on the tools path too', () => {
  // The invariant above ("the prompt IS the routing table") is only true where
  // the prompt carries the catalog. On the tools path the routing table is the
  // tool definitions instead - so the same guarantee has to be proven against
  // THEM, or D7 quietly made every action unreachable.
  const enabled = Object.values(CAT_ACTIONS).filter(a => a.enabled);
  const toolNames = new Set(actionToolDefinitions().map(d => d.function.name));

  it('ships a definition for every enabled action', () => {
    expect(toolNames.size).toBe(enabled.length);
  });

  it.each(enabled.map(a => a.id))('%s is callable as a tool', id => {
    expect(toolNames.has(id)).toBe(true);
  });
});

describe('a model that cannot act is told so', () => {
  // ADR-0006 D8. /api/cat/prepare serves models running in the user's own
  // browser; the only thing that comes back is /api/cat/local-complete, which
  // saves messages. Nothing on that path executes anything, so an exec_action
  // block is stored as literal text and reads to the user as "Cat did it".
  const none = buildCatSystemPrompt({ actionsVia: 'none' });

  it('states the limit instead of leaving it implied', () => {
    expect(none).toContain('## You Cannot Execute Actions On This Turn');
    expect(none).toContain('NOTHING you write can change anything on OrangeCat');
  });

  it('carries no action catalog to tempt it', () => {
    for (const heading of ACTION_PROSE_SECTION_HEADINGS) {
      expect(none).not.toContain(`## ${heading}`);
    }
  });

  it('carries no worked example to copy either', () => {
    // This assertion earned its place. It FAILED on the first implementation:
    // dropping the two catalog sections left a complete `"actionId"` example in
    // "Setting Up for Someone Else", so the prompt said "you cannot act" while
    // still demonstrating precisely how. A worked example outweighs a
    // prohibition thousands of chars earlier.
    expect(none).not.toContain('"actionId"');
    for (const heading of ACTION_INSTRUCTION_SECTION_HEADINGS) {
      expect(none).not.toContain(`## ${heading}`);
    }
  });

  it('neutralises the rules that still name exec_action', () => {
    // Critical Rules is kept (it carries much more than action restraint) and
    // mentions exec_action once. Rather than surgically editing a shared rule,
    // the notice overrides it — and goes LAST, so recency favours the truth.
    expect(none).toContain('it does not apply on this turn');
    expect(none.lastIndexOf('## You Cannot Execute Actions On This Turn')).toBeGreaterThan(
      none.lastIndexOf('## Critical Rules')
    );
  });

  it('keeps every action-instruction section on the tools path', () => {
    // These come out ONLY where nothing executes. On the tools path the loop
    // really can do them, and dropping them there would be a silent capability
    // loss that no other test here would notice.
    const tools = buildCatSystemPrompt({ actionsVia: 'tools' });
    for (const heading of ACTION_INSTRUCTION_SECTION_HEADINGS) {
      expect(tools).toContain(`## ${heading}`);
    }
  });

  it('points at the UI rather than just refusing', () => {
    // A flat "I can't" is a dead end. The honest version still helps.
    expect(none).toMatch(/Dashboard/);
  });
});
