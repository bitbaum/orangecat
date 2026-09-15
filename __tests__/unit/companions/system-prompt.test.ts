import { describe, it, expect } from 'vitest';
import {
  buildCompanionSystemPrompt,
  MEMORY_SECTION_HEADING,
} from '@/services/companions/system-prompt';

/**
 * The creator's prompt is sovereign: the only thing the platform adds is what
 * the companion remembers about this person, and only when there is any.
 */
describe('buildCompanionSystemPrompt', () => {
  it('returns the definition untouched when there are no memories', () => {
    const definition = 'You are Mira. You sit with a problem until it moves.';
    expect(buildCompanionSystemPrompt({ definition, memories: [] })).toBe(definition);
  });

  it('appends a memory section after the definition', () => {
    const out = buildCompanionSystemPrompt({
      definition: 'You are Mira.',
      memories: ['Lives in Zürich', ' Prefers one question at a time '],
    });
    expect(out?.startsWith('You are Mira.')).toBe(true);
    expect(out).toContain(MEMORY_SECTION_HEADING);
    expect(out).toContain('- Lives in Zürich');
    expect(out).toContain('- Prefers one question at a time');
    expect(out?.indexOf(MEMORY_SECTION_HEADING)).toBeGreaterThan(out!.indexOf('You are Mira.'));
  });

  it('never claims memory it does not have', () => {
    const out = buildCompanionSystemPrompt({ definition: 'x', memories: ['A fact'] });
    expect(out).toContain('never claim to remember something that is not here');
  });

  it('returns undefined when there is nothing to send', () => {
    expect(buildCompanionSystemPrompt({ definition: null, memories: [] })).toBeUndefined();
    expect(buildCompanionSystemPrompt({ definition: '  ', memories: ['', ' '] })).toBeUndefined();
  });

  it('adds nothing that smells of the platform', () => {
    const out = buildCompanionSystemPrompt({ definition: 'You are Mira.', memories: ['A fact'] })!;
    for (const forbidden of ['OrangeCat', 'Bitcoin', 'quick_replies', 'exec_action', 'My Cat']) {
      expect(out).not.toContain(forbidden);
    }
  });
});
