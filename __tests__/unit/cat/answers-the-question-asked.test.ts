/**
 * The turn where someone asks Cat to THINK.
 *
 * Someone sketched a product idea in four sentences and asked two things —
 * what do you think of it, and how would you set it up. Cat answered with
 * three OrangeCat objects to create and a funding goal, and never touched the
 * idea. It was not malfunctioning: it was obeying a brief in which every path
 * ends at a proposal, on a model chosen for simple tasks, picked by a router
 * that scored the message 0.0.
 *
 * Each block below pins one link in that chain. HARD_ASK is a STAND-IN, not
 * the message that prompted this: that one described someone's unlaunched
 * business, and this repository is public. It is written to preserve every
 * property the original tripped over — four sentences, ~460 characters,
 * typos, evaluative phrasing, the word `project` meaning an endeavour rather
 * than the entity, `hi` buried inside other words, and NO question mark,
 * because the person who found this does not type them.
 */

import { SITUATIONAL_SECTIONS } from '@/config/cat-prompt-sections';
import { createAutoRouter, qualityRank } from '@/services/ai/auto-router';
import { getFreeModels, getModelMetadata } from '@/config/ai-models';
import { servingChain, shouldEscalateForComplexity } from '@/services/cat/provider-catalog';

/** A stand-in with the same shape as the message that produced the bad answer. */
const HARD_ASK =
  'tooltrade.example is available. renting out tools will be more and more common. this will ' +
  'let people lend the things they already own. each listing will have all the info needed, ' +
  "including what condition the item is in, which ones need a deposit and who'd benefit from " +
  'borrowing it and why. maybe some otehr reasons. what do you thinkj of trhis idea and how ' +
  'would you set it up. take iontop accont orangecat, but also loki and solon, which could ' +
  'also be used for this project.';

describe('the matcher matches words, not letters inside words', () => {
  const opening = SITUATIONAL_SECTIONS.find(s => s.heading === 'Opening a Conversation')!;

  it('does not read "hi" out of this, which and hiring', () => {
    expect(opening.when.test('this is which hiring')).toBe(false);
    expect(opening.when.test('hi')).toBe(true);
    expect(opening.when.test('hey cat')).toBe(true);
  });

  it('does not let the first-message marker trigger notification triage', () => {
    const notifications = SITUATIONAL_SECTIONS.find(s =>
      s.heading.startsWith('Helping With Notifications')
    )!;
    expect(notifications.when.test('first-message')).toBe(false);
    expect(notifications.when.test('why did i get this message')).toBe(true);
  });

  it('stops selecting almost everything for one ordinary message', () => {
    // 7 of 11 situational sections fired for this ask before the fixes, which
    // is not selection — it is the whole brief with extra steps, on a budget
    // that cannot afford the whole brief. Three of those seven fired on the
    // letters "hi" inside "which", on the literal marker "first-message", and
    // on the conjunction "also". Now 7 of 13, two of them the new sections
    // that make the turn answerable at all.
    const fired = SITUATIONAL_SECTIONS.filter(s => s.when.test(`${HARD_ASK} | first-message`));
    // Raised 7 -> 8 when `Proactive Suggestions` landed. It fires here on the
    // `first-message` marker, which is correct: an opener is exactly the turn
    // where volunteering something is welcome. The ratio is what this test is
    // really about, and 8 of 14 is still selection — it was 7 of 11 before any
    // of this work, when three of those seven fired on nothing at all.
    expect(fired.length).toBeLessThanOrEqual(8);
  });
});

describe('the router can see a hard question', () => {
  const analyze = (m: string) => createAutoRouter().analyzeComplexity(m, []);

  it('no longer scores a product strategy question at zero', () => {
    expect(analyze(HARD_ASK).score).toBeGreaterThanOrEqual(0.5);
  });

  it('does not need a question mark to know a question was asked', () => {
    // The user does not type '?'. The old heuristic leaned on it.
    expect(HARD_ASK).not.toContain('?');
    expect(analyze('what do you think, should i build this').score).toBeGreaterThan(0);
  });

  it('still treats small talk as small talk', () => {
    expect(analyze('hi').score).toBeLessThan(0.3);
    expect(analyze('what is my product called').score).toBeLessThan(0.3);
  });

  it('ranks the free pool by what the models are FOR, not by registry order', () => {
    const reasoning = getModelMetadata('nvidia/nemotron-3-super-120b-a12b:free')!;
    const fast = getModelMetadata('openai/gpt-oss-20b:free')!;
    expect(qualityRank(reasoning)).toBeGreaterThan(qualityRank(fast));
  });

  it('picks a reasoning model over a simple-tasks one when both are free', () => {
    const picked = createAutoRouter().selectModel({
      message: HARD_ASK,
      allowedModels: getFreeModels().map(m => m.id),
    });
    expect(qualityRank(getModelMetadata(picked.model)!)).toBeGreaterThan(0);
  });
});

describe('a hard turn is worth a better free model', () => {
  const ids = (msg?: string) => servingChain(msg).map(p => p.id);

  it('escalates on the hard ask and not on a greeting', () => {
    expect(shouldEscalateForComplexity(HARD_ASK)).toBe(true);
    expect(shouldEscalateForComplexity('hi')).toBe(false);
  });

  it('leads with a free vendor on a hard turn, and with Groq otherwise', () => {
    expect(ids(HARD_ASK)[0]).toBe('google');
    expect(ids('hi')[0]).toBe('groq');
  });

  it('never drains the shared OpenRouter pool first', () => {
    // That key is split across every app on this box. Whatever leads, it is
    // not the scarcest bucket.
    for (const msg of [HARD_ASK, 'hi']) {
      expect(ids(msg)[0]).not.toBe('openrouter');
      expect(ids(msg).indexOf('openrouter')).toBeGreaterThan(ids(msg).indexOf('groq'));
    }
  });

  it('keeps Groq in the chain when it escalates past it', () => {
    // Escalation reorders; it must never remove the link that answers when the
    // vendor is drained.
    expect(ids(HARD_ASK)).toContain('groq');
  });
});
