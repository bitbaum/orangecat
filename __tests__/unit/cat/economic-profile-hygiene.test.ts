/**
 * The two leaks that filled a real public profile with 22 skills and assets
 * like "Event Ticket" and "drafts" — see economic-profile-hygiene.ts.
 */
import {
  dedupeEntries,
  existingEntriesNote,
  isGroundedInUserMessage,
} from '@/services/cat/economic-profile-hygiene';

describe('dedupeEntries', () => {
  it('treats the same name in different case or spacing as one entry', () => {
    const out = dedupeEntries([
      { name: 'Web development' },
      { name: 'web  development ' },
      { name: 'web development', level: 'expert' },
      { name: 'photography' },
    ]);
    expect(out).toEqual([{ name: 'Web development' }, { name: 'photography' }]);
  });

  it('dedupes goals by their text and plain strings as before', () => {
    expect(
      dedupeEntries([
        { text: 'Open a bar', kind: 'build' },
        { text: 'open a bar', kind: 'earn' },
      ])
    ).toHaveLength(1);
    expect(dedupeEntries(['Only weekends', 'only weekends'])).toEqual(['Only weekends']);
  });
});

describe('isGroundedInUserMessage', () => {
  it('keeps an asset the user named', () => {
    expect(isGroundedInUserMessage('drone', 'I have a drone I barely use')).toBe(true);
    expect(isGroundedInUserMessage('music studio', 'My music studio sits empty on weekdays')).toBe(
      true
    );
  });

  it('drops a listing title the assistant mentioned and the user did not', () => {
    const user = 'how do I boost sales?';
    expect(isGroundedInUserMessage('Loki Pro — 30-Day Muscle & Strength Program', user)).toBe(
      false
    );
    expect(isGroundedInUserMessage('Event Ticket', user)).toBe(false);
    expect(isGroundedInUserMessage('drafts', user)).toBe(false);
  });

  it('needs every significant word, not just one', () => {
    expect(isGroundedInUserMessage('digital photograph', 'sell this photograph')).toBe(false);
  });

  it('rejects a name with no significant words', () => {
    expect(isGroundedInUserMessage('a', 'a b c')).toBe(false);
  });
});

describe('existingEntriesNote', () => {
  it('is empty for an empty profile', () => {
    expect(existingEntriesNote({ skills: [], assets: [] })).toBe('');
  });

  it('lists what is already there so the model does not reword it', () => {
    const note = existingEntriesNote({ skills: ['full-stack web development'], assets: [] });
    expect(note).toContain('full-stack web development');
    expect(note).toContain('Assets: (none)');
    expect(note).toMatch(/reworded/);
  });
});
