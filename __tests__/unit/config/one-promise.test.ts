/**
 * One promise, written once (config/brand.ts). The 2026-11-13 review found it
 * in four wordings: the home hero, the sign-in panel, the share description
 * and the share card. These hold every one of them to the same constants.
 */
import { readFileSync } from 'fs';
import path from 'path';
import {
  APP_DESCRIPTION,
  APP_NAME,
  APP_PROMISE,
  APP_PROMISE_HOW,
  APP_TAGLINE,
} from '@/config/brand';
import { catBeyondFreeCopy, catRoutesCopy } from '@/config/cat-plans';
import { COMMERCE_CLOSED } from '@/config/commerce';
import { CTA_LABELS, FEE_CLAIMS, HERO_COPY, PRICING_COPY } from '@/config/landing-page';
import { PAY_LANDING_COPY, PAY_LINK_PLACEHOLDER, payLinkDisplay } from '@/config/pay';
import { ROUTES } from '@/config/routes';

const read = (file: string) => readFileSync(path.join(process.cwd(), file), 'utf8');

describe('the promise', () => {
  it('is what the hero says, and the description is the promise and its how', () => {
    expect(HERO_COPY.headline).toBe(APP_PROMISE);
    expect(HERO_COPY.lede).toBe(APP_PROMISE_HOW);
    expect(APP_DESCRIPTION).toBe(`${APP_PROMISE} ${APP_PROMISE_HOW}`);
    expect(`${APP_TAGLINE}.`).toBe(APP_PROMISE);
  });

  it('states the fee the fee config states', () => {
    expect(APP_PROMISE_HOW).toContain(`${FEE_CLAIMS.platformFee} platform fee`);
  });

  it('is in the install manifest', () => {
    const manifest = JSON.parse(read('public/manifest.json'));
    expect(manifest.name).toBe(`${APP_NAME} — ${APP_TAGLINE}`);
    expect(manifest.description).toBe(APP_DESCRIPTION);
  });

  it.each([
    'src/app/auth/AuthHeroPanel.tsx',
    'src/app/opengraph-image.tsx',
    'src/app/(public)/about/page.tsx',
    'src/components/layout/Footer.tsx',
    'src/app/auth/layout.tsx',
    'src/app/layout.tsx',
  ])('%s reads the promise and words none of its own', file => {
    const source = read(file);
    expect(source).toMatch(/APP_PROMISE|APP_DESCRIPTION/);
    expect(source).not.toMatch(/Fund, lend, invest|'Fund', 'Invest'|start funding, lending/);
    expect(source).not.toMatch(/Your AI economic agent — and the platform/);
  });
});

describe('the pay link the hero promises', () => {
  it('is the address the pay page is served at', () => {
    expect(payLinkDisplay('anna')).toBe(`orangecat.ch${ROUTES.PAY('anna')}`);
    expect(HERO_COPY.claim.prefix + PAY_LINK_PLACEHOLDER).toBe(
      payLinkDisplay(PAY_LINK_PLACEHOLDER)
    );
    expect(HERO_COPY.claim.catSentence('anna')).toContain('orangecat.ch/pay/anna');
  });

  it('gives the start action the name /pay gives it', () => {
    expect(CTA_LABELS.primaryAction).toBe(PAY_LANDING_COPY.ctaOwn);
  });
});

describe('pricing', () => {
  it('leads with what it costs to sell, from the fee config', () => {
    expect(PRICING_COPY.title).toBe(`${FEE_CLAIMS.platformFee} to sell`);
    expect(FEE_CLAIMS.platformFee).toBe('0%');
  });
});

describe('what /faq says about more Cat', () => {
  it('offers Cat Credits only while they are on sale', () => {
    expect(catBeyondFreeCopy(true)).toContain('add credits');
    expect(catBeyondFreeCopy(false)).not.toContain('add credits');
    expect(catBeyondFreeCopy(false)).toContain(COMMERCE_CLOSED.badge.toLowerCase());
    expect(catRoutesCopy(true, 10, 'cost + 20%')).toMatch(/^Four routes/);
    const closed = catRoutesCopy(false, 10, 'cost + 20%');
    expect(closed).toMatch(/^Three routes today/);
    expect(closed).toContain(COMMERCE_CLOSED.badge.toLowerCase());
    expect(closed).toContain('10 messages a day');
  });
});
