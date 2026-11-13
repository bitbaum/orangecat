// @vitest-environment jsdom
/**
 * A priced listing whose owner has no wallet used to show a price and stock,
 * then nothing to tap: the pay section said "hasn't connected a wallet yet"
 * and the phone's sticky bar disappeared. The visitor's one way forward is a
 * message to the owner about this listing; both places now offer it.
 *
 * Also pinned here: the sticky bar says what the tap costs, and a service's
 * bar leads to its Book button, not to the pay panel under the same words.
 */
import { render, screen } from '@testing-library/react';

vi.mock('@/hooks/useMobileActionBar', () => ({ useMobileActionBar: () => undefined }));
vi.mock('@/hooks/useSectionInView', () => ({ useSectionInView: () => false }));
// PriceDisplay is an async server component; this file is about the bar.
vi.mock('@/components/public/PriceDisplay', () => ({ default: () => null }));

import { MobileStickyCTA, stickyPayLabel } from '@/components/public/PublicEntityStickyCTA';
import { productDetailConfig } from '@/components/public/detail-configs/product';
import { serviceDetailConfig } from '@/components/public/detail-configs/service';
import { inquiryHref } from '@/features/messaging/lib/draft';
import { ROUTES } from '@/config/routes';

const product = { id: 'p-1', title: 'Honey', price: 20, currency: 'CHF' };

describe('a listing nobody can pay yet', () => {
  it('replaces the pay bar with "Ask how to pay", not with nothing', () => {
    const askHref = inquiryHref('u-1', { title: 'Honey', path: '/products/p-1' });
    render(
      <MobileStickyCTA
        config={productDetailConfig}
        entity={product}
        payable={false}
        isSignedIn={false}
        contactHref={askHref}
      />
    );
    const link = screen.getByRole('link', { name: 'Ask how to pay' });
    expect(link.getAttribute('href')).toBe(askHref);
  });

  it('shows no bar when there is no one to ask', () => {
    const { container } = render(
      <MobileStickyCTA
        config={productDetailConfig}
        entity={product}
        payable={false}
        isSignedIn={false}
        contactHref={null}
      />
    );
    expect(container.textContent).toBe('');
  });
});

describe('the message link', () => {
  it('names the owner, the listing and where it came from', () => {
    const href = inquiryHref('u-1', { title: 'Honey & wax', path: '/products/p-1' });
    const url = new URL(href, 'https://orangecat.ch');
    expect(url.pathname).toBe(ROUTES.MESSAGES);
    expect(url.searchParams.get('to')).toBe('u-1');
    expect(url.searchParams.get('about')).toBe('Honey & wax');
    expect(url.searchParams.get('ref')).toBe('/products/p-1');
  });
});

describe('the sticky bar says what the tap does', () => {
  it('puts the price in a priced listing’s pay bar', () => {
    expect(stickyPayLabel(productDetailConfig, product)).toBe('Buy now · CHF 20.00');
    render(
      <MobileStickyCTA
        config={productDetailConfig}
        entity={product}
        payable
        isSignedIn={false}
        contactHref={null}
      />
    );
    expect(screen.getByRole('link', { name: 'Buy now · CHF 20.00' }).getAttribute('href')).toBe(
      '#pay'
    );
  });

  it('leads a service to its Book button', () => {
    render(
      <MobileStickyCTA
        config={serviceDetailConfig}
        entity={{ id: 's-1', title: 'Roof repair' }}
        payable
        isSignedIn={false}
        contactHref={null}
      />
    );
    expect(screen.getByRole('link', { name: 'Book this service' }).getAttribute('href')).toBe(
      '#book'
    );
  });

  it('keeps one action on a product page: no second orange "Buy now" in the details', () => {
    render(
      <div>
        {productDetailConfig.renderDetails?.({ ...product, product_type: 'physical' }, true)}
      </div>
    );
    expect(screen.queryByRole('link', { name: 'Buy now' })).toBeNull();
  });
});
