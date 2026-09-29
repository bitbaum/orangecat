/**
 * Research on Nostr — the server may only link an event that is validly
 * signed and about THIS research, with THIS pre-registration. Signed here with
 * a throwaway key, exactly as a NIP-07 extension would.
 */

import { finalizeEvent, generateSecretKey, getPublicKey, nip19 } from 'nostr-tools';
import {
  buildResearchNostrEvent,
  researchNostrViewUrl,
  verifyResearchNostrEvent,
} from '@/domain/research/nostr';
import { RESEARCH_NOSTR } from '@/config/open-science';

const research = {
  id: '11111111-1111-4111-8111-111111111111',
  title: 'Cover crops and soil carbon',
  description: 'Does a winter cover crop raise soil organic carbon within two seasons?',
  field: 'environmental_science',
  license: 'CC-BY-4.0',
  output_links: ['https://github.com/x/soil', 'ipfs://bafydata'],
  preregistration: 'H1: SOC rises by >0.2% by season two.',
  preregistration_sha256: 'a'.repeat(64),
  preregistered_at: '2026-09-28T12:00:00.000Z',
};
const PAGE = 'https://orangecat.ch/research/11111111-1111-4111-8111-111111111111';

function sign(template: ReturnType<typeof buildResearchNostrEvent>) {
  return finalizeEvent(template, generateSecretKey());
}

describe('buildResearchNostrEvent', () => {
  it('is an addressable long-form event keyed by the research id', () => {
    const e = buildResearchNostrEvent(research, PAGE, new Date('2026-09-28T13:00:00Z'));
    expect(e.kind).toBe(RESEARCH_NOSTR.KIND);
    expect(e.tags).toContainEqual(['d', research.id]);
    expect(e.tags).toContainEqual(['license', 'CC-BY-4.0']);
    expect(e.tags).toContainEqual(['r', 'ipfs://bafydata']);
    expect(e.tags).toContainEqual(['preregistration_sha256', research.preregistration_sha256]);
    expect(e.content).toContain(research.preregistration);
    expect(e.content).toContain(PAGE);
  });
});

describe('verifyResearchNostrEvent', () => {
  it('accepts a signed event about this research', () => {
    const signed = sign(buildResearchNostrEvent(research, PAGE));
    expect(verifyResearchNostrEvent(signed, research).ok).toBe(true);
  });

  it('refuses a forged signature', () => {
    const signed = sign(buildResearchNostrEvent(research, PAGE));
    const forged = { ...signed, content: `${signed.content} (edited)` };
    expect(verifyResearchNostrEvent(forged, research)).toMatchObject({ ok: false });
  });

  it('refuses an event about other research', () => {
    const signed = sign(buildResearchNostrEvent({ ...research, id: 'other' }, PAGE));
    expect(verifyResearchNostrEvent(signed, research)).toMatchObject({ ok: false });
  });

  it('refuses an event missing the committed pre-registration', () => {
    const signed = sign(
      buildResearchNostrEvent({ ...research, preregistration_sha256: null }, PAGE)
    );
    expect(verifyResearchNostrEvent(signed, research)).toMatchObject({ ok: false });
  });

  it('refuses nothing at all', () => {
    expect(verifyResearchNostrEvent(null, research).ok).toBe(false);
  });
});

it('links to an naddr that decodes back to this research and key', () => {
  const pubkey = getPublicKey(generateSecretKey());
  const url = researchNostrViewUrl(research.id, pubkey);
  const decoded = nip19.decode(url.slice(RESEARCH_NOSTR.VIEWER_BASE_URL.length));
  expect(decoded.type).toBe('naddr');
  expect(decoded.data).toMatchObject({ identifier: research.id, pubkey, kind: 30023 });
});
