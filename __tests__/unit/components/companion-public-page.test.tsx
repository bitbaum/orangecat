// @vitest-environment jsdom
/**
 * A companion's public page: it can be supported (its "Pay into" wallet reaches
 * a payer), it wears its own face instead of a stock robot, and its share card
 * never carries an SVG face that link previews cannot draw.
 */
import { render } from '@testing-library/react';

vi.mock('@/hooks/useDisplayCurrency', () => ({
  useDisplayCurrency: () => ({
    formatAmountBtc: (n: number) => `${n} BTC`,
    formatAmount: (n: number) => `${n}`,
  }),
}));

import { aiAssistantDetailConfig as config } from '@/components/public/detail-configs/ai-assistant';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { avatarPath, shareImageFor } from '@/config/companion-avatars';

describe('a companion can be supported', () => {
  it('is a supportable type with nothing to buy', () => {
    expect(ENTITY_REGISTRY.ai_assistant.canReceiveSupport).toBe(true);
    expect(ENTITY_REGISTRY.ai_assistant.paymentPattern).toBe('none');
  });

  it('offers support only on a public companion', () => {
    expect(config.paymentSectionFor?.({ is_public: true })).toBe(true);
    expect(config.paymentSectionFor?.({ is_public: false })).toBe(false);
  });

  it('hides the card from visitors when no wallet can be reached', () => {
    expect(config.paymentNeedsWallet).toBe(true);
  });

  it('names the companion on the card', () => {
    expect(config.supportTitle?.({ title: 'Mira' })).toBe('Support Mira');
  });

  it('puts no sticky bar above Talk', () => {
    expect(config.mobileStickyCTA).toBeNull();
  });
});

describe('a companion wears its face', () => {
  it('draws the face its name picks when it has no picture', () => {
    const { container } = render(<>{config.renderHeaderIcon?.({ title: 'Mira' })}</>);
    expect(container.querySelector('svg path')).not.toBeNull();
  });

  it('shows an uploaded picture', () => {
    const { container } = render(
      <>{config.renderHeaderIcon?.({ title: 'Mira', avatar_url: 'https://x.test/mira.jpg' })}</>
    );
    expect(container.querySelector('img')?.getAttribute('src')).toContain('mira.jpg');
  });

  it('keeps "Active" for the owner only', () => {
    expect(config.statusBadge?.({ status: 'active' }, false)).toBeNull();
    expect(config.statusBadge?.({ status: 'active' }, true)).toBe('active');
  });
});

describe('share image', () => {
  it('drops a picked face (SVG) so the entity card stands in', () => {
    expect(shareImageFor(avatarPath('disc', 'teal'))).toBeUndefined();
    expect(shareImageFor('https://x.test/face.svg')).toBeUndefined();
    expect(shareImageFor(null)).toBeUndefined();
  });

  it('keeps an uploaded photo', () => {
    expect(shareImageFor('https://x.test/mira.jpg')).toBe('https://x.test/mira.jpg');
  });
});
