import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { LADDER, PARTNER_GUILD, foundGuildHref, guildHref } from '@/config/partners';
import { ROUTES } from '@/config/routes';
import { ECOSYSTEM } from '@/config/ecosystem';

/**
 * Who is a partner is membership of one guild, never a list here. These pin
 * that the ladder is complete, points at real pages, and that the guild is
 * reached through the group routes the registry already owns.
 */
describe('the ladder', () => {
  it('has the three rungs, in order, each with a way forward', () => {
    expect(LADDER.map(r => r.id)).toEqual(['studio', 'partner', 'yourself']);
    for (const rung of LADDER) {
      // Internal, or the studio's own hire page (it lives on bitbaum's site).
      const internal = rung.cta.href.startsWith('/') || rung.cta.href.startsWith('#');
      expect(internal || rung.cta.href === ECOSYSTEM.studio.hireUrl).toBe(true);
      expect(rung.price.length).toBeGreaterThan(10);
    }
  });

  it('sends do-it-yourself to the map', () => {
    expect(LADDER.find(r => r.id === 'yourself')?.cta.href).toBe(ROUTES.WHAT_YOU_CAN_DO);
  });

  it('never calls the studio’s appreciation a donation', () => {
    for (const rung of LADDER) {
      expect(`${rung.what} ${rung.price}`).not.toMatch(/donat|tip\b|charit/i);
    }
  });
});

describe('the guild', () => {
  it('is reached through the group routes, by its configured slug', () => {
    expect(guildHref()).toBe(`${ENTITY_REGISTRY.group.publicBasePath}/${PARTNER_GUILD.slug}`);
    const url = new URL(foundGuildHref(), 'https://orangecat.ch');
    expect(url.pathname).toBe(ENTITY_REGISTRY.group.createPath);
    expect(url.searchParams.get('description')).toContain(PARTNER_GUILD.name);
    expect(url.searchParams.get('autofill')).toBe('1');
  });
});
