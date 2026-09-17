/**
 * Walked live 2026-09-11: "Марина" produced an empty ASCII slug, the claim
 * fell back to "someone", and on claim that word became her handle.
 */

import { claimSlugFor, transliterate } from '@/domain/profileClaims/slug';

describe('claimSlugFor', () => {
  it('transliterates Cyrillic and accented names', () => {
    expect(claimSlugFor('Марина')).toBe('marina');
    expect(claimSlugFor('Аннушка')).toBe('annushka');
    expect(claimSlugFor('Юлія Щербак')).toBe('yuliya-shcherbak');
    expect(claimSlugFor('Zoë Müller-Straße')).toBe('zoe-muller-strasse');
    expect(claimSlugFor('Maria')).toBe('maria');
  });

  it('never falls back to a dictionary word', () => {
    expect(claimSlugFor('日本')).toMatch(/^person-[0-9a-f]{6}$/);
    expect(claimSlugFor('   ')).toMatch(/^person-[0-9a-f]{6}$/);
    expect(transliterate('ъ')).toBe('');
  });
});
