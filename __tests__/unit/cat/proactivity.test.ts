/**
 * Proactive suggestions, and the switch that settles them per person.
 *
 * Cat should sometimes volunteer — a draft nobody can find, an entity nothing
 * can pay into. An agent that only ever answers is a search box with manners.
 * But an unasked suggestion spends someone's attention, so two things have to
 * hold: a switch, and a BAR strict enough that the default can be ON.
 *
 * The switch is tested here. The bar is prose in the prompt and cannot be unit
 * tested — what IS tested is that turning the switch off removes the section
 * entirely, rather than adding a "do not be proactive" instruction. Telling a
 * model not to do something still puts the idea in front of it, and pays for
 * the words twice.
 */

import { buildCatSystemPrompt, PROACTIVITY_SECTION } from '@/services/cat/system-prompt';
import { PROACTIVITY_DEFAULT } from '@/services/cat/proactivity';

const heading = `## ${PROACTIVITY_SECTION}`;

describe('the switch', () => {
  it('is on by default, because opt-in features are never seen', () => {
    // An opt-IN default means almost nobody meets the behaviour, so it never
    // gets better and never earns its keep. The safety is the bar, not the
    // default. Flip this constant to change the product's mind.
    expect(PROACTIVITY_DEFAULT).toBe(true);
  });

  it('includes the section when the preference is absent', () => {
    // Absent must mean the default, not "off": a user with no preferences row
    // is a new user, not someone who opted out.
    expect(buildCatSystemPrompt({})).toContain(heading);
  });

  it('includes it when explicitly on', () => {
    expect(buildCatSystemPrompt({ proactivity: true })).toContain(heading);
  });

  it('REMOVES it when off, rather than forbidding it', () => {
    const off = buildCatSystemPrompt({ proactivity: false });
    expect(off).not.toContain(heading);
    // And no consolation instruction in its place — the section is simply gone.
    expect(off.toLowerCase()).not.toContain('do not be proactive');
  });

  it('removes only that section', () => {
    const on = buildCatSystemPrompt({ proactivity: true });
    const off = buildCatSystemPrompt({ proactivity: false });
    expect(off.length).toBeLessThan(on.length);
    // The rest of the brief is untouched: the rules that must survive every
    // preference are still there.
    for (const kept of ['## Critical Rules', 'Not every turn is a proposal.']) {
      expect(off).toContain(kept);
    }
  });
});

describe('the bar is written down', () => {
  const prompt = buildCatSystemPrompt({ proactivity: true });

  it('requires the suggestion to be anchored in their own context', () => {
    expect(prompt).toContain('It is anchored.');
  });

  it('forbids repeating a suggestion, which is how people learn to skim', () => {
    expect(prompt).toContain('You have not raised it before.');
  });

  it('allows a turn with no suggestion at all', () => {
    // The failure mode this prevents is filler: an assistant that must always
    // have something to add will invent something to add.
    expect(prompt).toContain('A turn with no suggestion is a perfectly good turn.');
  });

  it('never goes proactive on sensitive ground, or to upsell', () => {
    expect(prompt).toContain('Never proactive about');
    expect(prompt).toContain('move them up a\nplan');
  });
});
