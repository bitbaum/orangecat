/**
 * The server half of the group-wallets fix (the page half is in
 * __tests__/unit/components/group-wallets-truth.test.tsx).
 *
 * 1. Whether a group can be paid is resolved on the server, once, by the same
 *    resolution the payment runs (resolveSellerReceiveInfo → resolveSellerWallet),
 *    and only the yes/no reaches the browser: a group's wallets are members-only.
 *    On production (2026-11-12) every public group offered a live pay card
 *    without that check, beside "0 Wallets".
 * 2. A group wallet's balance carries the time it was read, so a balance nobody
 *    read (the column's default 0) is not shown as an empty treasury.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { isValidElement, type ReactElement } from 'react';

const payments = vi.hoisted(() => ({ resolveSellerReceiveInfo: vi.fn() }));
const chain = vi.hoisted(() => ({ fetchAddressBalance: vi.fn() }));

vi.mock('@/domain/payments', () => payments);
vi.mock('@/lib/bitcoin/addressBalance', () => chain);
vi.mock('@/lib/supabase/browser', () => ({ default: {} }));
vi.mock('@/lib/supabase/server', () => ({
  createServerClient: async () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          single: async () => ({
            data: { id: 'g1', name: 'Record Shop', description: null },
            error: null,
          }),
        }),
      }),
    }),
  }),
}));
// The page hands its props to a dynamically loaded client component.
vi.mock('next/dynamic', () => ({
  default: () =>
    function GroupDetailClient() {
      return null;
    },
}));

async function groupPageProps() {
  const { default: GroupDetailPage } = await import('@/app/groups/[slug]/page');
  const page = (await GroupDetailPage({
    params: Promise.resolve({ slug: 'record-shop' }),
  })) as ReactElement<{ children: unknown[] }>;
  const client = (page.props.children as unknown[]).find(
    child => isValidElement(child) && typeof child.type === 'function'
  ) as ReactElement<{ groupSlug: string; canReceive: boolean }>;
  return client.props;
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('the group page asks the server whether the group can be paid', () => {
  it('says no when the payment would find no wallet', async () => {
    payments.resolveSellerReceiveInfo.mockResolvedValue(null);
    const props = await groupPageProps();
    expect(payments.resolveSellerReceiveInfo).toHaveBeenCalledWith('group', 'g1');
    expect(props).toEqual({ groupSlug: 'record-shop', canReceive: false });
  });

  it('says yes, and only yes, when it would find one', async () => {
    payments.resolveSellerReceiveInfo.mockResolvedValue({
      method: 'lightning_address',
      address: 'shop@example.com',
    });
    const props = await groupPageProps();
    expect(props).toEqual({ groupSlug: 'record-shop', canReceive: true });
    // The members-only address never travels to the browser.
    expect(JSON.stringify(props)).not.toContain('shop@example.com');
  });
});

describe("a group wallet's balance says when it was read", () => {
  it('stores the read time with the balance', async () => {
    chain.fetchAddressBalance.mockResolvedValue({ balance_btc: 0.25 });
    const updates: Record<string, unknown>[] = [];
    const client = {
      from: () => ({
        select: () => ({
          eq: () => ({
            single: async () => ({ data: { bitcoin_address: 'bc1qtreasury' }, error: null }),
          }),
        }),
        update: (payload: Record<string, unknown>) => {
          updates.push(payload);
          return { eq: async () => ({ error: null }) };
        },
      }),
    };
    const { refreshWalletBalance } = await import('@/services/groups/mutations/treasury');
    const result = await refreshWalletBalance('w1', client as never);
    expect(result).toEqual({ success: true, balance: 0.25 });
    expect(updates).toHaveLength(1);
    expect(updates[0].current_balance_btc).toBe(0.25);
    expect(Number.isNaN(Date.parse(String(updates[0].balance_updated_at)))).toBe(false);
  });

  it('adds the read time as a nullable column, so "never read" stays expressible', () => {
    const sql = readFileSync(
      join(
        process.cwd(),
        'supabase/migrations/20261112202000_a_group_wallet_balance_says_when_it_was_read.sql'
      ),
      'utf8'
    ).replace(/^[ \t]*--.*$/gm, '');
    expect(sql).toMatch(
      /ALTER TABLE public\.group_wallets\s+ADD COLUMN IF NOT EXISTS balance_updated_at TIMESTAMPTZ;/
    );
    expect(sql).not.toMatch(/DEFAULT|NOT NULL|UPDATE public\.group_wallets/);
  });
});
