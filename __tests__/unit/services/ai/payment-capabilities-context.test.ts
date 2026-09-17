/**
 * The one context block that decides whether a user can ever be paid.
 *
 * The context builder snapshot only covers a fully set-up account (NWC wallet +
 * Lightning address), which is 3 of 76 production profiles. The branch every
 * other user actually gets — "no receiving wallet" — was rendered by nobody's
 * test, and for months it said only that the address was missing plus a link to
 * Settings. A diagnosis with no cure is why the Cat never fixed this for anyone.
 */

import { renderPaymentCapabilities } from '@/services/ai/context-sections';
import { LIGHTNING_ADDRESS_PROVIDERS, WALLET_PROVIDERS } from '@/config/wallet-providers';

const withAddress = { hasNwcWallet: true, lightningAddress: 'hello@orangecat.ch' };
const withoutAddress = { hasNwcWallet: false, lightningAddress: null };

describe('payment capabilities context', () => {
  it('gives a user who cannot be paid both routes out, not just the diagnosis', () => {
    const rendered = renderPaymentCapabilities(withoutAddress as never);

    // Route 1: they already have a wallet — the verb that ends with them payable.
    expect(rendered).toContain('connect_wallet');
    // Route 2: they have no wallet — somewhere concrete to get one.
    expect(rendered).toContain(WALLET_PROVIDERS.primal.website);
  });

  it('only lists providers that actually hand out a Lightning address', () => {
    const rendered = renderPaymentCapabilities(withoutAddress as never);

    // A wallet can support Lightning and still never give the user a
    // name@domain address — which is the only thing OrangeCat can store. Listing
    // one of those sends someone through a full setup that ends unpayable.
    const wrongfullyListed = Object.values(WALLET_PROVIDERS).filter(
      p => !p.lightningAddress && rendered.includes(p.website)
    );
    expect(wrongfullyListed.map(p => p.name)).toEqual([]);
    expect(LIGHTNING_ADDRESS_PROVIDERS.length).toBeGreaterThan(0);
  });

  it('is honest that custodial providers are custodial', () => {
    const rendered = renderPaymentCapabilities(withoutAddress as never);
    const custodial = LIGHTNING_ADDRESS_PROVIDERS.filter(p => p.custody === 'custodial');

    // Every fast option starts custodial today. Recommending one without saying
    // so would have the Cat quietly trading away the platform's own premise.
    expect(custodial.length).toBeGreaterThan(0);
    expect(rendered).toContain('custodial');
  });

  it('spends nothing on setup instructions for a user who is already payable', () => {
    const rendered = renderPaymentCapabilities(withAddress as never);

    expect(rendered).toContain('hello@orangecat.ch');
    expect(rendered).not.toContain(WALLET_PROVIDERS.primal.website);
    expect(rendered).not.toContain('CANNOT BE PAID');
  });
});
