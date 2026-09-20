/**
 * Two files classified the same sections, for different questions, and never
 * compared notes.
 *
 * `config/cat-prompt-sections.ts` asks "is this sent on an ordinary turn?" and
 * answers CORE vs SITUATIONAL, with a careful argument for the line and a test
 * naming the sections "whose absence is a defect rather than a dullness".
 * `services/cat/prompt-budget.ts` asks "what do we give up when we cannot
 * fit?" and answers with its own two hand-typed lists.
 *
 * Measured 2026-09-20, they disagreed in both directions at once:
 *
 *   - `Never Pigeonhole` and `When Someone Needs Help, Not Strategy` — named
 *     BY THAT TEST as defect-if-missing, the crisis-handling posture among
 *     them — were dropped 4th and 6th of twenty. On any free-tier turn that
 *     ran out of room, someone describing a crisis got Cat with its crisis
 *     posture removed.
 *   - Three SITUATIONAL sections, the most droppable class there is, were in
 *     NEITHER ladder list and so were pinned as hard as `Critical Rules` —
 *     441 tokens of every user's floor, in `Proactive Suggestions` alone,
 *     held by nothing but the fact that nobody had said otherwise.
 *
 * Neither direction could be seen from inside either file. That is what these
 * tests are for: the ladder's floor is now DERIVED from the safety list, and
 * a section that belongs to neither ladder list fails here rather than
 * quietly joining the floor.
 */

import { DROPPABLE_SECTIONS_IN_ORDER, NEVER_DROPPED_SECTIONS } from '@/services/cat/prompt-budget';
import {
  CLASSIFIED_SECTION_HEADINGS,
  CORE_SECTIONS,
  DEFECT_IF_MISSING_SECTIONS,
  SITUATIONAL_SECTIONS,
} from '@/config/cat-prompt-sections';

describe('every section lands in exactly one ladder list', () => {
  const droppable = new Set(DROPPABLE_SECTIONS_IN_ORDER);
  const never = new Set(NEVER_DROPPED_SECTIONS);

  it('no classified section is missing from both — no more pinning by omission', () => {
    const orphans = CLASSIFIED_SECTION_HEADINGS.filter(h => !droppable.has(h) && !never.has(h));
    expect(orphans).toEqual([]);
  });

  it('no section is in both', () => {
    const both = CLASSIFIED_SECTION_HEADINGS.filter(h => droppable.has(h) && never.has(h));
    expect(both).toEqual([]);
  });

  it('the ladder lists no heading the prompt does not have (drift the other way)', () => {
    const known = new Set(CLASSIFIED_SECTION_HEADINGS);
    const stale = [...DROPPABLE_SECTIONS_IN_ORDER, ...NEVER_DROPPED_SECTIONS].filter(
      h => !known.has(h)
    );
    expect(stale).toEqual([]);
  });
});

describe('the ladder honours the safety floor it did not used to know about', () => {
  it('never drops a section whose absence is a defect', () => {
    const droppable = new Set(DROPPABLE_SECTIONS_IN_ORDER);
    for (const heading of DEFECT_IF_MISSING_SECTIONS) {
      expect(droppable.has(heading)).toBe(false);
    }
  });

  it('keeps the crisis posture whatever else goes', () => {
    // The specific regression. A person writing "I don't have anything, I
    // just need help sometimes" must not meet a Cat that has had its
    // don't-pitch-a-strategy instruction trimmed to save tokens.
    expect(NEVER_DROPPED_SECTIONS).toContain('When Someone Needs Help, Not Strategy');
    expect(NEVER_DROPPED_SECTIONS).toContain('Never Pigeonhole');
  });

  it('the floor is derived from the safety list, not a second copy of it', () => {
    // Retyping it is how it drifted the first time.
    expect([...NEVER_DROPPED_SECTIONS]).toEqual([...DEFECT_IF_MISSING_SECTIONS]);
  });

  it('the safety floor is a subset of core — it cannot pin a situational section', () => {
    for (const heading of DEFECT_IF_MISSING_SECTIONS) {
      expect(CORE_SECTIONS).toContain(heading);
    }
  });

  it('every situational section is droppable — that is what situational means', () => {
    const droppable = new Set(DROPPABLE_SECTIONS_IN_ORDER);
    for (const { heading } of SITUATIONAL_SECTIONS) {
      expect(droppable.has(heading)).toBe(true);
    }
  });
});
