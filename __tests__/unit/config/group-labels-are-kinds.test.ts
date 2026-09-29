/**
 * Group labels are the kinds in @bitbaum/collective-kinds and nothing else.
 *
 * Until 2026-09-28 OrangeCat kept its own eight-word list here, Solon kept two
 * of its own, and none of them agreed. Now one package says what kinds exist
 * and this file says only what OrangeCat does with each. These tests hold the
 * seam: every kind has a row, no row is not a kind, the retired word is gone,
 * the place rule is enforced where a group is created, and the place key here
 * is the civic split's key.
 */
import { COLLECTIVE_KIND_IDS, placeKey } from '@bitbaum/collective-kinds';
import { GROUP_TEMPLATES } from '@/components/create/templates/group-templates';
import { GROUP_LABELS, GROUP_LABEL_IDS, PLACE_BOUND_LABELS } from '@/config/group-labels';
import { createGroupSchema } from '@/services/groups/validation';
import { readFileSync } from 'fs';
import { join } from 'path';

describe('group labels are collective kinds', () => {
  it('has exactly one row per kind, in the package order', () => {
    expect([...GROUP_LABEL_IDS]).toEqual([...COLLECTIVE_KIND_IDS]);
    expect(Object.keys(GROUP_LABELS).sort()).toEqual([...COLLECTIVE_KIND_IDS].sort());
  });

  it('takes name and description from the kind, not from a local copy', () => {
    expect(GROUP_LABELS.association.name).toBe('Association');
    expect(GROUP_LABELS.local_fund.needsPlace).toBe(true);
  });

  it('no longer knows the retired word', () => {
    expect((GROUP_LABEL_IDS as readonly string[]).includes('nonprofit')).toBe(false);
    for (const file of [
      'src/config/group-labels.ts',
      'src/services/cat/system-prompt.ts',
      'src/services/cat/handlers/organization.ts',
      'src/components/create/templates/group-templates.ts',
    ]) {
      const src = readFileSync(join(process.cwd(), file), 'utf8');
      expect(src.includes("'nonprofit'"), `${file} still spells the retired label`).toBe(false);
    }
  });

  it('gives every template a label that exists', () => {
    for (const template of GROUP_TEMPLATES) {
      expect(GROUP_LABEL_IDS).toContain(template.defaults.label);
    }
  });

  it('ships a local fund template bound to a place', () => {
    const fund = GROUP_TEMPLATES.find(t => t.defaults.label === 'local_fund');
    expect(fund?.defaults.locality).toBe('Witikon');
    expect(fund?.defaults.country_code).toBe('CH');
  });
});

describe('a place-bound kind cannot be created without a place', () => {
  const base = { name: 'Witikon Fund', label: 'local_fund' as const };

  it('names the first missing place field', () => {
    const result = createGroupSchema.safeParse(base);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['country_code']);
    }
  });

  it('accepts a complete place and upper-cases the country', () => {
    const result = createGroupSchema.safeParse({
      ...base,
      country_code: 'ch',
      region: 'Zürich',
      locality: 'Witikon',
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.country_code).toBe('CH');
    }
  });

  it('does not ask a circle for a place', () => {
    expect(createGroupSchema.safeParse({ name: 'Old friends', label: 'circle' }).success).toBe(
      true
    );
  });

  it('refuses a tax-exempt claim on a kind that cannot hold one', () => {
    const result = createGroupSchema.safeParse({
      name: 'Acme',
      label: 'company',
      legal_status: 'tax_exempt',
      legal_form: 'GmbH',
      jurisdiction: 'CH',
      register_id: 'CHE-1',
      recognised_on: '2026-01-01',
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.path).toEqual(['legal_status']);
    }
  });

  it('lists the place-bound kinds from the package', () => {
    expect(PLACE_BOUND_LABELS).toEqual(['town', 'charter_city', 'local_fund']);
  });
});

describe('the place key is the civic split key', () => {
  it('matches SQL lower(btrim(x)), which civic_splits and groups both use', () => {
    expect(placeKey('  Witikon ')).toBe('witikon');
    expect(placeKey('ZÜRICH')).toBe('zürich');
  });
});
