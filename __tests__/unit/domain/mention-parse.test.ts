/**
 * What a message could be mentioning, decided without a database.
 *
 * The cases that matter are the ones a single "username regex" gets wrong.
 * Production has four real accounts whose handles contain dots and plus signs
 * (`m.schaupensteiner`, `ana+test2`, …) because signup derives handles
 * from email addresses and bypasses the username validator. So the parser has
 * to offer dotted handles as candidates — while still reading `@alice.` at the
 * end of a sentence as `alice`, and never turning an email address into a
 * mention of its domain.
 */

import { parseMentionCandidates, collectMentionCandidates } from '@/domain/mentions/parse';

const first = (text: string) => parseMentionCandidates(text)[0];

describe('mention candidates', () => {
  it('reads a plain handle', () => {
    expect(first('hey @alice look')?.candidates).toEqual(['alice']);
  });

  it('offers a dotted handle before its prefix, because both could be real', () => {
    // `m.schaupensteiner` exists in production; `m` might too.
    expect(first('ping @m.schaupensteiner')?.candidates).toEqual(['m.schaupensteiner', 'm']);
  });

  it('drops sentence punctuation rather than inventing a handle', () => {
    expect(first('ask @alice.')?.candidates).toEqual(['alice']);
    expect(first('ask @alice, please')?.candidates).toEqual(['alice']);
    expect(first('(@alice)')?.candidates).toEqual(['alice']);
  });

  it('never turns an email address into a mention', () => {
    // The @ is preceded by a word character, so it does not start a mention.
    expect(parseMentionCandidates('mail me at bob@example.com')).toEqual([]);
  });

  it('handles the plus-sign handles signup generates', () => {
    expect(first('@ana+test2 hi')?.candidates).toEqual(['ana+test2', 'ana']);
  });

  it('cuts only at separators, not at every character', () => {
    // Without the boundary rule this would offer alic, ali, al, a…
    expect(first('@alice')?.candidates).toEqual(['alice']);
  });

  it('finds several mentions in one message, in order', () => {
    const found = parseMentionCandidates('@alice and @bob and @cat');
    expect(found.map(m => m.candidates[0])).toEqual(['alice', 'bob', 'cat']);
  });

  it('ignores an @ with nothing usable after it', () => {
    expect(parseMentionCandidates('@ @. @-- email@')).toEqual([]);
  });

  it('emits a doubled @ once, not twice', () => {
    // The first @ has no handle after it; the second does. One mention of bob.
    const found = parseMentionCandidates('@@bob');
    expect(found).toHaveLength(1);
    expect(found[0].candidates).toEqual(['bob']);
  });

  it('collects one deduped lowercase set for a single lookup', () => {
    const all = collectMentionCandidates('@Alice @alice @bob.smith');
    expect(all.sort()).toEqual(['alice', 'bob', 'bob.smith']);
  });

  it('is not fooled by a very long run', () => {
    const long = 'a'.repeat(60);
    const candidates = first(`@${long}`)?.candidates ?? [];
    expect(candidates.every(c => c.length <= 40)).toBe(true);
  });
});
