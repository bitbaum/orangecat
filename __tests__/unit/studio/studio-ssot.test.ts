/**
 * Guards the Studio's SSOT seams.
 *
 * Every one of these fails the SAME way in production if it drifts: the UI
 * offers a medium the API then refuses, or refuses one the API would serve.
 * That failure is invisible in a type-check because the two sides talk over
 * JSON, so it is a test instead.
 */

import {
  STUDIO_FILE_MEDIUMS,
  STUDIO_MEDIA,
  STUDIO_MEDIUMS,
  STUDIO_NEXT_MOVES,
  STUDIO_PROMPT_LIMITS,
  STUDIO_REVISION_LIMITS,
  isStudioMedium,
} from '@/config/studio';
import { ENTITY_TYPES } from '@/config/entity-registry';
import { SITUATIONAL_SECTIONS } from '@/config/cat-prompt-sections';

describe('Studio SSOT invariants', () => {
  it('every medium has metadata under its own id', () => {
    for (const medium of STUDIO_MEDIUMS) {
      expect(STUDIO_MEDIA[medium].id).toBe(medium);
      expect(STUDIO_MEDIA[medium].name.length).toBeGreaterThan(0);
      // The revise placeholder is the feature's whole argument — a medium
      // without one ships a box with no hint of what to type in it.
      expect(STUDIO_MEDIA[medium].revisePlaceholder.length).toBeGreaterThan(0);
    }
  });

  it('isStudioMedium accepts every medium and nothing else', () => {
    for (const medium of STUDIO_MEDIUMS) {
      expect(isStudioMedium(medium)).toBe(true);
    }
    expect(isStudioMedium('sculpture')).toBe(false);
  });

  it('file mediums are exactly those whose output is persisted', () => {
    for (const medium of STUDIO_FILE_MEDIUMS) {
      expect(STUDIO_MEDIA[medium].outputKind).toBe('file');
    }
    // Writing is the one that is not a file; if that ever changes, the poll
    // route's medium enum has to change with it.
    expect(STUDIO_FILE_MEDIUMS).not.toContain('writing');
  });

  it('every next move points at a real entity type', () => {
    for (const move of STUDIO_NEXT_MOVES) {
      expect(ENTITY_TYPES).toContain(move.entityType);
    }
  });

  it('limits leave room for a real brief and a short note', () => {
    expect(STUDIO_PROMPT_LIMITS.min).toBeLessThan(STUDIO_PROMPT_LIMITS.max);
    expect(STUDIO_REVISION_LIMITS.min).toBeLessThan(STUDIO_REVISION_LIMITS.max);
    // A revision note longer than the brief it revises means the fallback
    // (prompt + note appended) would blow the prompt ceiling.
    expect(STUDIO_REVISION_LIMITS.max).toBeLessThan(STUDIO_PROMPT_LIMITS.max);
  });

  it("Cat's Studio section fires on the words people actually use", () => {
    const section = SITUATIONAL_SECTIONS.find(s => s.heading === 'Making Things (the Studio)');
    expect(section).toBeDefined();
    for (const phrase of [
      'i want to record an album',
      'help me write a novel',
      'can i make a short film',
      'i need a cover for my music',
      'how do i fund my podcast',
    ]) {
      expect(section?.when.test(phrase)).toBe(true);
    }
  });
});
