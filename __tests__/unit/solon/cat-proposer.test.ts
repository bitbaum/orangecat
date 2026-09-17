/**
 * @vitest-environment node
 *
 * The Cat's proposer edge — "the Cat proposes; Solon disposes."
 *
 * Pins: (1) the canonical proposal message stays byte-identical to Solon's
 * proposalMessage(); (2) the Cat's signature verifies with our own verifier
 * (so Solon will accept it); (3) the handler files nothing when unconfigured,
 * validates ceilings, records a draft before filing, attaches the Solon
 * proposal id on success, and marks the draft rejected when Solon refuses.
 */
import {
  addressFromPrivateKey,
  signBitcoinMessage,
  solonProposalMessage,
  verifyBitcoinMessage,
} from '@/services/solon/bitcoin-message';
import { governanceHandlers } from '@/services/cat/handlers/governance';
import { contentHashOf } from '@/services/solon/canonical';

import type { Mock } from 'vitest';

vi.mock('@/utils/logger', () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

const PRIV = '1111111111111111111111111111111111111111111111111111111111111111';
const handler = governanceHandlers.propose_governance_change!;

describe('proposal message + signing (cross-repo contract)', () => {
  it('matches Solon proposalMessage() byte-for-byte (golden string)', () => {
    expect(
      solonProposalMessage({
        orgSlug: 'orangecat',
        category: 'ALLOCATION_POLICY',
        title: 'Raise the ceiling',
        proposerAddress: '1abc',
      })
    ).toBe(
      'Solon proposal\norg:orangecat\ncategory:ALLOCATION_POLICY\ntitle:Raise the ceiling\nproposer:1abc'
    );
    expect(
      solonProposalMessage({
        orgSlug: 'orangecat',
        category: 'ALLOCATION_POLICY',
        title: 'Raise the ceiling',
        proposerAddress: '1abc',
        contentHash: 'deadbeef',
      })
    ).toBe(
      'Solon proposal\norg:orangecat\ncategory:ALLOCATION_POLICY\ntitle:Raise the ceiling\nproposer:1abc\ncontent:deadbeef'
    );
  });

  it('signs with the fixed key to the known address, and the signature verifies', () => {
    const address = addressFromPrivateKey(PRIV);
    expect(address).toBe('1Q1pE5vPGEEMqRcVRMbtBK842Y6Pzo6nK9');
    const message = solonProposalMessage({
      orgSlug: 'orangecat',
      category: 'ALLOCATION_POLICY',
      title: 'T',
      proposerAddress: address,
      contentHash: contentHashOf({ a: 1 }),
    });
    const signature = signBitcoinMessage(message, PRIV);
    expect(verifyBitcoinMessage(message, address, signature).valid).toBe(true);
    expect(verifyBitcoinMessage(message.replace('T', 'X'), address, signature).valid).toBe(false);
  });
});

// ── handler ──────────────────────────────────────────────────────────────────

function buildSupabase() {
  const writes: { op: string; payload: unknown }[] = [];
  const makeChain = () => {
    const chain: Record<string, unknown> = {};
    for (const method of ['select', 'eq', 'order', 'limit']) {
      chain[method] = vi.fn().mockReturnValue(chain);
    }
    chain.maybeSingle = vi.fn().mockResolvedValue({ data: { version: 1 }, error: null });
    chain.single = vi.fn().mockResolvedValue({ data: { id: 'draft-1' }, error: null });
    chain.insert = vi.fn((payload: unknown) => {
      writes.push({ op: 'insert', payload });
      return chain;
    });
    chain.update = vi.fn((payload: unknown) => {
      writes.push({ op: 'update', payload });
      return chain;
    });
    chain.then = (resolve: (v: { data: unknown; error: null }) => unknown) =>
      Promise.resolve(resolve({ data: null, error: null }));
    return chain;
  };
  return { from: vi.fn(() => makeChain()), _writes: writes };
}

const PARAMS = {
  title: 'Raise the daily ceiling',
  rationale: 'Volume grew.',
  max_cat_daily_spend_btc: 0.002,
  max_cat_btc_per_action: 0.0005,
};

describe('propose_governance_change handler', () => {
  const OLD_ENV = process.env;
  beforeEach(() => {
    process.env = { ...OLD_ENV, CAT_SOLON_PRIVKEY: PRIV, SOLON_AGENT_API_KEY: 'sk_solon_test' };
    global.fetch = vi.fn();
  });
  afterAll(() => {
    process.env = OLD_ENV;
  });

  it('refuses when Solon env is not configured — inert by default', async () => {
    delete process.env.CAT_SOLON_PRIVKEY;
    const supabase = buildSupabase();
    const result = await handler(supabase as never, 'u', 'a', PARAMS);
    expect(result.success).toBe(false);
    expect(result.error).toContain('not configured');
    expect(supabase.from).not.toHaveBeenCalled();
  });

  it('refuses a per-action ceiling above the daily ceiling', async () => {
    const supabase = buildSupabase();
    const result = await handler(supabase as never, 'u', 'a', {
      ...PARAMS,
      max_cat_btc_per_action: 1,
    });
    expect(result.success).toBe(false);
    expect(result.error).toContain('cannot exceed');
  });

  it('records a draft, files on Solon, and stores the proposal id', async () => {
    (global.fetch as Mock).mockResolvedValue({
      json: async () => ({ created: true, verified: true, proposalId: 'prop-42' }),
    });
    const supabase = buildSupabase();

    const result = await handler(supabase as never, 'u', 'a', PARAMS);

    expect(result.success).toBe(true);
    const insert = supabase._writes.find(w => w.op === 'insert')!.payload as {
      status: string;
      content_hash: string;
    };
    expect(insert.status).toBe('draft');
    expect(insert.content_hash).toBe(
      contentHashOf({ max_cat_daily_spend_btc: 0.002, max_cat_btc_per_action: 0.0005 })
    );
    const update = supabase._writes.find(w => w.op === 'update')!.payload as {
      solon_proposal_id: string;
    };
    expect(update.solon_proposal_id).toBe('prop-42');

    // The POST body carried a signature Solon will accept.
    const body = JSON.parse((global.fetch as Mock).mock.calls[0][1].body as string);
    expect(
      verifyBitcoinMessage(
        solonProposalMessage({
          orgSlug: 'orangecat',
          category: 'ALLOCATION_POLICY',
          title: PARAMS.title,
          proposerAddress: body.proposerAddress,
          contentHash: body.signature && insert.content_hash,
        }),
        body.proposerAddress,
        body.signature
      ).valid
    ).toBe(true);
  });

  it('marks the draft rejected when Solon refuses the filing', async () => {
    (global.fetch as Mock).mockResolvedValue({
      json: async () => ({
        created: false,
        verified: true,
        reason: 'API key does not belong to this agent member',
      }),
    });
    const supabase = buildSupabase();

    const result = await handler(supabase as never, 'u', 'a', PARAMS);

    expect(result.success).toBe(false);
    expect(result.error).toContain('Solon refused');
    const update = supabase._writes.find(w => w.op === 'update')!.payload as { status: string };
    expect(update.status).toBe('rejected');
  });
});
