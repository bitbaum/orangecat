/**
 * A key the person holds on Loki is suggested here, by name, once.
 *
 * 2026-11-11: the owner's xAI key was on Loki only. Loki's chat answered on
 * Grok; the Cat, for the same linked account, ran on an exhausted free pool,
 * and nothing on either side said the other product had a key.
 */
import { keysOnLokiNotHere } from '@/services/ai/keys-elsewhere';
import { parseActorStatus } from '@/services/loki/actor-status';

describe('keysOnLokiNotHere', () => {
  it('suggests a provider Loki holds and this account does not', () => {
    const found = keysOnLokiNotHere([{ vendor: 'xai', keyHint: '…VWhN' }], []);
    expect(found).toHaveLength(1);
    expect(found[0]).toMatchObject({ provider: 'xai', keyHint: '…VWhN' });
    expect(found[0].name).toMatch(/xAI/);
    expect(found[0].apiKeyUrl).toMatch(/^https:\/\//);
  });

  it('says nothing about a provider already added here', () => {
    expect(keysOnLokiNotHere([{ vendor: 'xai', keyHint: '…VWhN' }], ['xai'])).toEqual([]);
  });

  it('leaves out a vendor the Cat cannot run on, and repeats nothing', () => {
    const found = keysOnLokiNotHere(
      [
        { vendor: 'moonshot', keyHint: '…aaaa' },
        { vendor: 'xai', keyHint: '…VWhN' },
        { vendor: 'xai', keyHint: '…VWhN' },
      ],
      []
    );
    expect(found.map(k => k.provider)).toEqual(['xai']);
  });
});

describe('parseActorStatus model keys', () => {
  it('reads names and hints, and nothing that looks like a key', () => {
    const status = parseActorStatus(
      JSON.stringify({
        ok: true,
        linked: true,
        projects: [],
        modelKeys: [
          { vendor: 'xai', model: 'grok-4.7', keyHint: '…VWhN', apiKey: 'xai-secret' },
          { model: 'no-vendor' },
          'junk',
        ],
      })
    );
    expect(status?.modelKeys).toEqual([{ vendor: 'xai', keyHint: '…VWhN' }]);
    expect(JSON.stringify(status)).not.toContain('xai-secret');
  });

  it('is empty when Loki sends none (an older Loki)', () => {
    const status = parseActorStatus(JSON.stringify({ ok: true, linked: true, projects: [] }));
    expect(status?.modelKeys).toEqual([]);
  });
});
