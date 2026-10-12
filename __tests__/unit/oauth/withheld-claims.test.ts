/**
 * The consent screen and Connected apps both edit one list: which profile
 * claims an app is NOT sent. These two helpers are the only place that list is
 * built or cleaned, so a form field or a stored row can never withhold (or
 * reveal) anything the list does not name.
 */
import { PROFILE_CLAIMS, cleanWithheldClaims, withheldFromChoices } from '@/lib/oauth/config';

describe('PROFILE_CLAIMS', () => {
  it('never lists sub or email: identity and the email scope are not this setting', () => {
    const names: string[] = PROFILE_CLAIMS.map(c => c.claim);
    expect(names).toEqual(['name', 'preferred_username', 'picture']);
    expect(names).not.toContain('sub');
    expect(names).not.toContain('email');
  });
});

describe('cleanWithheldClaims', () => {
  it('keeps known claims once each, in list order', () => {
    expect(cleanWithheldClaims(['picture', 'name', 'picture'])).toEqual(['name', 'picture']);
  });
  it('drops anything unknown', () => {
    expect(cleanWithheldClaims(['email', 'sub', '', 7, null, 'name'])).toEqual(['name']);
  });
  it('turns a non-list into nothing withheld', () => {
    expect(cleanWithheldClaims(undefined)).toEqual([]);
    expect(cleanWithheldClaims('name')).toEqual([]);
    expect(cleanWithheldClaims({ name: true })).toEqual([]);
  });
});

describe('withheldFromChoices', () => {
  it('withholds exactly what was not ticked', () => {
    expect(withheldFromChoices(['name'])).toEqual(['preferred_username', 'picture']);
  });
  it('withholds nothing when everything is ticked', () => {
    expect(withheldFromChoices(['name', 'preferred_username', 'picture'])).toEqual([]);
  });
  it('withholds everything when nothing is ticked', () => {
    expect(withheldFromChoices([])).toEqual(['name', 'preferred_username', 'picture']);
  });
  it('ignores ticked values it does not know', () => {
    expect(withheldFromChoices(['name', 'email', 'x'])).toEqual(['preferred_username', 'picture']);
  });
});
