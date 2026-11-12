// @vitest-environment jsdom
/**
 * A request asked in a currency (say CHF 20) carries the Bitcoin it was worth
 * when it was made in its link (`?amount=…&request=…`). The pay page already
 * works out today's Bitcoin for an open ask (getOpenAskBtcNow) and showed it
 * in its other-ways panel, but seeded the payment itself with the link's old
 * figure — so a payer paid a stale amount and the request could stay unpaid
 * (review of production, 2026-11-12). The flow now starts from today's figure.
 */
import { render } from '@testing-library/react';
import { PayPageClient } from '@/app/(public)/pay/[username]/PayPageClient';

const seen: Array<number | undefined> = [];
vi.mock('@/components/payment/PayFlow', () => ({
  PayFlow: (props: { initialAmountBtc?: number }) => {
    seen.push(props.initialAmountBtc);
    return null;
  },
}));
let search = '';
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(search),
  useRouter: () => ({ push: vi.fn() }),
  usePathname: () => '/pay/cato',
}));

const base = {
  username: 'cato',
  recipientName: 'Cato',
  recipientId: 'u1',
  canReceive: true,
  methods: [],
};

beforeEach(() => {
  seen.length = 0;
});

describe('a pay link that answers a request', () => {
  it("pays today's Bitcoin for the ask, not the figure frozen into the link", () => {
    search = 'amount=0.0005&request=r1';
    render(<PayPageClient {...base} requestAmountBtc={0.00031} />);
    expect(seen.at(-1)).toBe(0.00031);
  });

  it("keeps the link's amount when there is no open ask to re-price", () => {
    search = 'amount=0.0005';
    render(<PayPageClient {...base} />);
    expect(seen.at(-1)).toBe(0.0005);
  });
});
