import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { LOCAL_FUND_COPY } from '@/config/civic-split';
import { localFundStartHref, toLocalFund } from '@/domain/local-fund/service';

/**
 * The civic split's locality share needs somewhere to go. These pin the two
 * pure halves: how a fund is shaped for the screen, and where "start one"
 * lands — the group create form, with a sentence the AI prefill turns into a
 * local-fund draft for exactly this place.
 */
describe('local fund routing', () => {
  const place = { country_code: 'ch', region: ' Zürich', locality: 'Witikon ' };

  it('opens a fund on its public group page', () => {
    const fund = toLocalFund({
      id: 'g1',
      slug: 'witikon-fund',
      name: 'Witikon Fund',
      description: null,
      lightning_address: null,
      bitcoin_address: null,
    });
    expect(fund.href).toBe(`${ENTITY_REGISTRY.group.publicBasePath}/witikon-fund`);
  });

  it('starts a new fund in the group create form, pre-described and auto-filled', () => {
    const href = localFundStartHref(place);
    expect(href.startsWith(`${ENTITY_REGISTRY.group.createPath}?description=`)).toBe(true);
    const url = new URL(href, 'https://orangecat.ch');
    expect(url.searchParams.get('description')).toContain('Witikon, Zürich, CH');
    expect(url.searchParams.get('description')).toMatch(/local fund/i);
    expect(url.searchParams.get('autofill')).toBe('1');
  });

  it('never says the split changes what the law takes', () => {
    expect(LOCAL_FUND_COPY.has('Witikon Fund', 'Witikon', 60)).toMatch(/never instead of it/);
    expect(LOCAL_FUND_COPY.has('Witikon Fund', 'Witikon', 60)).toContain('60%');
  });
});
