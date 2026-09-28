/**
 * Open science on research — the rules a funder relies on.
 *
 * A pre-registration is only evidence if it cannot move after the results do,
 * and an output link is only open science if it points somewhere anyone can
 * reach. These pin both.
 */

import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  commitPreregistration,
  decidePreregistration,
  isAllowedOutputLink,
  isContentAddressed,
  isOpenLicense,
  openScienceFields,
  outputKindOf,
} from '@/domain/research/openScience';
import { RESEARCH_LICENSES } from '@/config/open-science';

const schema = z.object(openScienceFields);

describe('output links', () => {
  it.each([
    'https://github.com/someone/soil-health',
    'ipfs://bafybeigdyrzt5sfp7udm7hu76uh7y26nf3efuylqabf3oclgtqy55fbzdi',
    'ipns://k51qzi5uqu5dh',
    'ar://bNbA3TEQVL60xlgCcqdz4ZPHFZ711cZ3hmkpGttDt_U',
  ])('accepts %s', link => {
    expect(isAllowedOutputLink(link)).toBe(true);
  });

  it.each(['javascript:alert(1)', 'ftp://example.org/x', 'not a link', 'ipfs://', 'data:,x'])(
    'refuses %s',
    link => {
      expect(isAllowedOutputLink(link)).toBe(false);
    }
  );

  it('marks only ipfs:// and ar:// as content-addressed', () => {
    expect(isContentAddressed('ipfs://bafy')).toBe(true);
    expect(isContentAddressed('ar://tx')).toBe(true);
    expect(isContentAddressed('ipns://name')).toBe(false); // a mutable pointer
    expect(isContentAddressed('https://zenodo.org/records/1')).toBe(false);
  });

  it('derives the kind from known hosts and never guesses for unknown ones', () => {
    expect(outputKindOf('https://arxiv.org/abs/2401.00001')).toBe('preprint');
    expect(outputKindOf('https://www.biorxiv.org/content/1')).toBe('preprint');
    expect(outputKindOf('https://zenodo.org/records/42')).toBe('dataset');
    expect(outputKindOf('https://codeberg.org/x/y')).toBe('code');
    expect(outputKindOf('https://doi.org/10.1000/182')).toBe('link');
    expect(outputKindOf('https://notgithub.com/x')).toBe('link');
    expect(outputKindOf('ipfs://bafy')).toBe('link');
  });

  it('the schema refuses an unsafe link with a reason', () => {
    const parsed = schema.safeParse({ output_links: ['javascript:alert(1)'] });
    expect(parsed.success).toBe(false);
  });
});

describe('licence', () => {
  it("treats an untouched select ('') as not stated", () => {
    const parsed = schema.parse({ license: '' });
    expect(parsed.license).toBeNull();
  });

  it('refuses a licence that is not in the list', () => {
    expect(schema.safeParse({ license: 'WTFPL' }).success).toBe(false);
  });

  it('knows open from closed', () => {
    expect(isOpenLicense('CC0-1.0')).toBe(true);
    expect(isOpenLicense('all-rights-reserved')).toBe(false);
    expect(isOpenLicense(null)).toBe(false);
    // Stating closed terms must stay possible — honesty over pressure.
    expect(RESEARCH_LICENSES.some(l => !l.open)).toBe(true);
  });
});

describe('pre-registration', () => {
  it('commits a hash anyone can recompute from the text', async () => {
    const text = 'H1: cover crops raise soil organic carbon by >0.2% in 2 seasons.';
    const cols = await commitPreregistration(text, new Date('2026-09-28T12:00:00Z'));
    expect(cols.preregistration_sha256).toBe(createHash('sha256').update(text).digest('hex'));
    expect(cols.preregistered_at).toBe('2026-09-28T12:00:00.000Z');
  });

  it('commits the first text on an uncommitted row', () => {
    expect(decidePreregistration('plan', null)).toEqual({ kind: 'commit', text: 'plan' });
    expect(
      decidePreregistration('plan', { preregistration: null, preregistered_at: null })
    ).toEqual({ kind: 'commit', text: 'plan' });
  });

  it('does nothing for a blank value, even on a committed row (never clears it)', () => {
    const committed = { preregistration: 'plan', preregistered_at: '2026-01-01T00:00:00Z' };
    expect(decidePreregistration('', committed)).toEqual({ kind: 'none' });
    expect(decidePreregistration(undefined, committed)).toEqual({ kind: 'none' });
  });

  it('accepts the same text resent by the edit form, refuses a different one', () => {
    const committed = { preregistration: 'plan', preregistered_at: '2026-01-01T00:00:00Z' };
    expect(decidePreregistration('plan', committed)).toEqual({ kind: 'none' });
    expect(decidePreregistration('a better plan', committed)).toEqual({ kind: 'locked' });
  });
});
