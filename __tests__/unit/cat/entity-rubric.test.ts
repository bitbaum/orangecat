/**
 * The rubric may not know about fewer types than exist.
 *
 * Its hand-written predecessor covered 8 of the 15 registry types. Nothing told
 * Cat when to reach for a Research entity, a Wishlist, an Investment or a
 * Companion — so a funded enquiry came back as a Project and a list of wanted
 * things came back as a Cause. That is not a model failing to reason; it is a
 * model being handed an incomplete map.
 *
 * Deriving the rubric makes the coverage gap impossible rather than unlikely,
 * and these tests are what stop it reopening the next time a type is added.
 */

import { entityRubric, ENTITY_CONFUSIONS } from '@/services/cat/entity-rubric';
import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';
import { CAT_CREATABLE_ENTITY_TYPES } from '@/types/cat';
import { BASE_SYSTEM_PROMPT_FOR_TEST } from '@/services/cat/system-prompt';

describe('every type Cat can create has a rule', () => {
  const rubric = entityRubric();

  it.each([...CAT_CREATABLE_ENTITY_TYPES])('names %s by the word a person reads', type => {
    // The display name, not the id: `ai_assistant` reads as "Companion", and a
    // rubric that says "ai_assistant" teaches Cat to say it too.
    expect(rubric).toContain(`**${ENTITY_REGISTRY[type].name}**`);
  });

  it.each([...ENTITY_TYPES])('%s states when to choose it', type => {
    const choose = ENTITY_REGISTRY[type].choose;
    expect(choose.trim()).not.toBe('');
    // Long enough to be a situation rather than a restated label.
    expect(choose.length).toBeGreaterThan(30);
  });

  it('does not offer wallet, which is never proposed to anyone', () => {
    expect(rubric).not.toContain('**Wallet**');
  });

  it('covers every type the nightly eval probes for', () => {
    // The 8 canonical probes (PR #375) expect these types. A rubric that stops
    // naming one of them regresses the gate that runs at 04:30 while nobody is
    // watching — so it fails here first, in a second, for free.
    for (const type of ['service', 'product', 'cause', 'project', 'loan', 'event', 'group', 'circle'] as const) {
      expect(rubric).toContain(`**${ENTITY_REGISTRY[type].name}**`);
    }
  });
});

describe('the confusions are the ones that actually happen', () => {
  it('keeps the list short enough to be read', () => {
    // A table of every possible pair is noise, and noise in a brief is
    // indistinguishable from no guidance.
    expect(ENTITY_CONFUSIONS.length).toBeLessThanOrEqual(8);
    expect(ENTITY_CONFUSIONS.length).toBeGreaterThan(0);
  });

  it('asks a question that separates the pair in one step', () => {
    for (const c of ENTITY_CONFUSIONS) {
      expect(c.pair).toContain('vs');
      expect(c.ask.length).toBeGreaterThan(40);
    }
  });

  it('keeps the rule that a repayment is always a loan', () => {
    // The failure this pins: answering a money NEED with only "sell something".
    const rubric = entityRubric().toLowerCase();
    expect(rubric).toContain('repay');
  });
});

describe('the brief carries the generated rubric, not a copy of it', () => {
  it('contains it verbatim', () => {
    expect(BASE_SYSTEM_PROMPT_FOR_TEST).toContain(entityRubric());
  });

  it('no longer hard-codes the old eight-type list', () => {
    expect(BASE_SYSTEM_PROMPT_FOR_TEST).not.toContain('Selling your time, skill, or labor');
  });
});
