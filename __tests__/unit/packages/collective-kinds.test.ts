import { describe, expect, it } from 'vitest';
import {
  COLLECTIVE_KINDS,
  COLLECTIVE_KIND_IDS,
  COLLECTIVE_KIND_LIST,
  LEGAL_STATUSES,
  formatPlace,
  isCollectiveKindId,
  kindOf,
  legalProblem,
  legalRank,
  mayClaimDeductibleGifts,
  normalizePlace,
  placeKey,
  placeKeys,
  placeProblem,
} from '@bitbaum/collective-kinds';

describe('kinds', () => {
  it('every id has an entry whose id matches its key, in declared order', () => {
    for (const id of COLLECTIVE_KIND_IDS) {
      expect(COLLECTIVE_KINDS[id].id).toBe(id);
    }
    expect(COLLECTIVE_KIND_LIST.map(k => k.id)).toEqual([...COLLECTIVE_KIND_IDS]);
  });

  it('every kind says what it is in one line and whether it needs a place', () => {
    for (const kind of COLLECTIVE_KIND_LIST) {
      expect(kind.name.length).toBeGreaterThan(1);
      expect(kind.description.length).toBeGreaterThan(20);
      expect(typeof kind.needsPlace).toBe('boolean');
      expect(typeof kind.canBeTaxExempt).toBe('boolean');
    }
  });

  it('a town and a local fund are bound to a place; a DAO is not', () => {
    expect(COLLECTIVE_KINDS.town.needsPlace).toBe(true);
    expect(COLLECTIVE_KINDS.local_fund.needsPlace).toBe(true);
    expect(COLLECTIVE_KINDS.dao.needsPlace).toBe(false);
  });

  it('recognises ids totally, never by throwing', () => {
    expect(isCollectiveKindId('association')).toBe(true);
    expect(isCollectiveKindId('nonprofit')).toBe(false);
    expect(kindOf(undefined)).toBeUndefined();
    expect(kindOf('town')?.name).toBe('Town');
  });
});

describe('place', () => {
  it('keys the way SQL lower(btrim(x)) does', () => {
    expect(placeKey('  Witikon ')).toBe('witikon');
    expect(placeKeys({ country_code: 'ch', region: ' Zürich', locality: 'WITIKON ' })).toEqual({
      country_code: 'CH',
      region_key: 'zürich',
      locality_key: 'witikon',
    });
  });

  it('names the first missing field, in form order', () => {
    expect(placeProblem(null)).toBe('country_code');
    expect(placeProblem({ country_code: 'Switzerland' })).toBe('country_code');
    expect(placeProblem({ country_code: 'CH', region: '', locality: 'Witikon' })).toBe('region');
    expect(placeProblem({ country_code: 'CH', region: 'Zürich', locality: ' ' })).toBe('locality');
    expect(placeProblem({ country_code: 'ch', region: 'Zürich', locality: 'Witikon' })).toBeNull();
  });

  it('normalises or refuses, never half-normalises', () => {
    expect(
      normalizePlace({ country_code: ' ch', region: ' Zürich ', locality: 'Witikon' })
    ).toEqual({
      country_code: 'CH',
      region: 'Zürich',
      locality: 'Witikon',
    });
    expect(normalizePlace({ country_code: 'CH', region: 'Zürich' })).toBeNull();
    expect(formatPlace({ country_code: 'CH', region: 'Zürich', locality: 'Witikon' })).toBe(
      'Witikon, Zürich, CH'
    );
  });
});

describe('legal status', () => {
  it('is strictly ordered', () => {
    expect(LEGAL_STATUSES.map(legalRank)).toEqual([0, 1, 2]);
  });

  it('refuses a status without its evidence instead of downgrading it', () => {
    expect(legalProblem({ status: 'informal' })).toBeNull();
    expect(legalProblem({ status: 'registered' })).toBe('legal_form');
    expect(legalProblem({ status: 'registered', legal_form: 'Verein', jurisdiction: 'ch' })).toBe(
      'jurisdiction'
    );
    expect(legalProblem({ status: 'registered', legal_form: 'Verein', jurisdiction: 'CH' })).toBe(
      'register_id'
    );
    const registered = {
      status: 'registered' as const,
      legal_form: 'Verein (Art. 60 ZGB)',
      jurisdiction: 'CH',
      register_id: 'CHE-123.456.789',
    };
    expect(legalProblem(registered)).toBeNull();
    expect(legalProblem({ ...registered, status: 'tax_exempt' })).toBe('recognised_on');
    expect(
      legalProblem({ ...registered, status: 'tax_exempt', recognised_on: '2026-11-01' })
    ).toBeNull();
  });

  it('never lets a kind that cannot be tax-exempt claim deductible gifts', () => {
    const record = {
      status: 'tax_exempt' as const,
      legal_form: 'GmbH',
      jurisdiction: 'CH',
      register_id: 'CHE-1',
      recognised_on: '2026-01-01',
    };
    expect(mayClaimDeductibleGifts(record, COLLECTIVE_KINDS.company)).toBe(false);
    expect(mayClaimDeductibleGifts(record, COLLECTIVE_KINDS.local_fund)).toBe(true);
    expect(mayClaimDeductibleGifts({ status: 'registered' }, COLLECTIVE_KINDS.local_fund)).toBe(
      false
    );
  });
});
