/**
 * Section selection has to be safe BEFORE it is switched on.
 *
 * The tempting way to shrink a prompt is to send only what looks relevant, and
 * the way that goes wrong is well documented here already: an action that
 * appears nowhere in the prompt cannot be chosen no matter how correct its
 * handler is (see prompt-budget.test.ts, action-disambiguation.test.ts). So the
 * invariants below are the price of admission for turning the flag on:
 *
 *   1. Every section is deliberately classified — a new one cannot drift into
 *      either bucket by default.
 *   2. Core survives selection for ANY turn, including an empty message.
 *   3. Every enabled action stays emittable after selection.
 *   4. Selection actually buys enough room to matter.
 */

import {
  BASE_SYSTEM_PROMPT_FOR_TEST,
  selectSectionsFromPrompt,
  buildCatSystemPrompt,
} from '@/services/cat/system-prompt';
import {
  CORE_SECTIONS,
  SITUATIONAL_SECTIONS,
  CLASSIFIED_SECTION_HEADINGS,
  selectPromptSections,
} from '@/config/cat-prompt-sections';
import { CAT_ACTIONS } from '@/config/cat-actions';
import { GROQ_ON_DEMAND_TPM_LIMIT, GROQ_CHAT_MAX_TOKENS } from '@/services/ai/groq';

const full = BASE_SYSTEM_PROMPT_FOR_TEST;

/** Headings the prompt actually contains. */
function headingsIn(prompt: string): string[] {
  return prompt
    .split('\n')
    .filter(l => l.startsWith('## '))
    .map(l => l.slice(3).trim());
}

/** Same emittable-form rule the budget gate uses. */
function isDocumentedActionably(prompt: string, id: string): boolean {
  return prompt.includes(`**${id}(`) || prompt.includes(`"actionId": "${id}"`);
}

describe('prompt section classification', () => {
  it('classifies every section in the prompt — none may default silently', () => {
    const unclassified = headingsIn(full).filter(h => !CLASSIFIED_SECTION_HEADINGS.includes(h));
    expect(unclassified).toEqual([]);
  });

  it('does not classify headings that no longer exist (drift the other way)', () => {
    const present = new Set(headingsIn(full));
    const stale = CLASSIFIED_SECTION_HEADINGS.filter(h => !present.has(h));
    expect(stale).toEqual([]);
  });

  it('keeps capability and safety sections in core, not situational', () => {
    // These are the ones whose absence is a defect rather than a dullness.
    for (const heading of [
      'Actions You Can Execute Directly',
      'Tools You Can Call',
      'Critical Rules',
      'Grounding & Honesty (non-negotiable)',
      'When Someone Needs Help, Not Strategy',
      'Never Pigeonhole',
      'Response Format for Entity Suggestions',
    ]) {
      expect(CORE_SECTIONS).toContain(heading);
    }
  });
});

describe('selection preserves what Cat needs to function', () => {
  const turns = [
    '',
    'hi',
    'first-message',
    'what should I charge for my mug?',
    'my friend is in a really bad situation and needs help',
    'delete my product',
    'anyone here into permaculture?',
    '¿cómo puedo vender mis cosas?',
    '🙂',
  ];

  it.each(turns)('keeps every core section for turn: %s', turn => {
    const selected = selectSectionsFromPrompt(full, turn);
    for (const heading of CORE_SECTIONS) {
      expect(selected).toContain(`## ${heading}`);
    }
  });

  it.each(turns)('keeps every enabled action emittable for turn: %s', turn => {
    const selected = selectSectionsFromPrompt(full, turn);
    for (const action of Object.values(CAT_ACTIONS).filter(a => a.enabled)) {
      expect(isDocumentedActionably(selected, action.id)).toBe(true);
    }
  });

  it('keeps an unclassified section rather than dropping it', () => {
    const withNew = `${full}\n\n## Some Brand New Section\nrules that nobody classified yet`;
    expect(selectSectionsFromPrompt(withNew, 'hi')).toContain('## Some Brand New Section');
  });
});

describe('selection is worth doing', () => {
  it('pulls in the relevant situational section when the turn calls for it', () => {
    expect(selectPromptSections('what should I charge for this?')).toContain('Pricing Guidance');
    expect(selectPromptSections('my friend needs help')).toContain('Setting Up for Someone Else');
    expect(selectPromptSections('это не для меня, это для другого пользователя')).toContain(
      'Setting Up for Someone Else'
    );
    expect(selectPromptSections('hi')).not.toContain('Pricing Guidance');
  });

  /**
   * Selection is necessary but NOT yet sufficient, and this test says so out
   * loud rather than asserting a fit that has not been achieved. On a plain
   * greeting it returns ~7k characters; core alone is still ~39k, dominated by
   * the action catalog and the tool guide. Closing the rest means trimming
   * core, which is the next piece of work — this measurement is its target.
   */
  it('frees a material amount of room, and reports what is still missing', () => {
    const selected = selectSectionsFromPrompt(full, 'hi');
    const saved = full.length - selected.length;
    expect(saved).toBeGreaterThan(5_000);

    const CEILING_CHARS = (GROQ_ON_DEMAND_TPM_LIMIT - GROQ_CHAT_MAX_TOKENS) * 4;
    const TYPICAL_USER_CONTEXT = 8_000;
    const remaining = selected.length + TYPICAL_USER_CONTEXT - CEILING_CHARS;
    // eslint-disable-next-line no-console
    console.info(
      `[cat prompt] selection on a greeting: ${full.length} -> ${selected.length} chars (saved ${saved}). ` +
        `With ${TYPICAL_USER_CONTEXT} chars of user context, still ${remaining} over the Groq ceiling.`
    );
    // Ratchet: the gap may shrink, and may only grow for a stated reason.
    //
    // Raised 3,100 -> 3,400 when `connect_wallet` landed on main (#641). A new
    // enabled action is real capability and costs real prompt — that is the
    // "conscious, argued decision" this mechanism exists to force, not to
    // forbid. Everything this branch itself added was paid back by trimming
    // instead: the action-appendix preamble, the add_wallet enum and the
    // save_economic_profile line are all tighter than they were.
    //
    // Raised 3,400 -> 3,650 for `propose_governance_change`: the Cat can now
    // file Solon governance proposals about its own spending leash — a new
    // capability worth its prompt cost. Its description and parameters were
    // already cut to the bone to keep the hard 54.6k static budget green.
    expect(remaining).toBeLessThanOrEqual(3_650);
  });

  it('selects by default now, and still sends everything when told to', async () => {
    // The default flipped on 2026-09-11 and the reason is arithmetic, not
    // taste: the free Groq pool refuses any request over 8 000 tokens per
    // minute, and the unselected prompt is ~9 100 in tool mode — so with
    // selection off, that pool could not answer a single message. A greeting
    // does not need the pricing section; the escape hatch stays for anyone
    // who wants the whole brief.
    expect(buildCatSystemPrompt({ turnDescriptor: 'hi' })).not.toContain('## Pricing Guidance');
    expect(buildCatSystemPrompt({ turnDescriptor: 'what should I charge?' })).toContain(
      '## Pricing Guidance'
    );

    vi.resetModules();
    vi.stubEnv('CAT_PROMPT_SECTION_SELECTION', '0');
    const off = await import('@/services/cat/system-prompt');
    expect(off.SECTION_SELECTION_ENABLED).toBe(false);
    expect(off.buildCatSystemPrompt({ turnDescriptor: 'hi' })).toContain('## Pricing Guidance');
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it('every situational section can actually be reached by some turn', () => {
    // A section nothing can trigger is dead weight that still costs review time.
    for (const { heading, when } of SITUATIONAL_SECTIONS) {
      expect(when.source.length).toBeGreaterThan(0);
      expect(heading.length).toBeGreaterThan(0);
    }
  });
});
