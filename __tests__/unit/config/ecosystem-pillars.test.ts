/**
 * The three-pillar stack is described once. Before this, /support carried a
 * hand-copied second copy of it (with a comment admitting it "mirrors
 * ECOSYSTEM_PILLARS") and the footer carried a third, so a renamed product or
 * a moved domain had to be remembered in three files.
 *
 * These tests hold the two halves of the story: one — every surface derives
 * from the SSOT; and different — each pillar keeps a distinct role and a
 * distinct home.
 */
import { ECOSYSTEM, ECOSYSTEM_PILLARS } from '@/config/ecosystem';
import { footerNavigation, getHeaderNavigationItems } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

describe('ecosystem pillars SSOT', () => {
  it('describes exactly the three products of the stack', () => {
    expect(ECOSYSTEM_PILLARS.map(p => p.key)).toEqual(['orangecat', 'loki', 'solon']);
    expect(ECOSYSTEM_PILLARS.map(p => p.title)).toEqual([
      ECOSYSTEM.orangeCat.title,
      ECOSYSTEM.loki.title,
      ECOSYSTEM.solon.title,
    ]);
  });

  it('gives every pillar the copy each surface needs', () => {
    for (const pillar of ECOSYSTEM_PILLARS) {
      expect(pillar.role.length).toBeGreaterThan(0);
      expect(pillar.tagline.length).toBeGreaterThan(0);
      expect(pillar.summary.length).toBeGreaterThan(0);
      expect(pillar.boundary.length).toBeGreaterThan(0);
      expect(pillar.fundingBody.length).toBeGreaterThan(0);
      expect(pillar.icon).toBeDefined();
      expect(() => new URL(pillar.siteUrl)).not.toThrow();
      if (pillar.fundingUrl) {
        expect(() => new URL(pillar.fundingUrl as string)).not.toThrow();
      }
    }
  });

  it('keeps the pillars different — distinct roles and distinct homes', () => {
    const roles = ECOSYSTEM_PILLARS.map(p => p.role);
    const origins = ECOSYSTEM_PILLARS.map(p => new URL(p.siteUrl).origin);
    expect(new Set(roles).size).toBe(ECOSYSTEM_PILLARS.length);
    expect(new Set(origins).size).toBe(ECOSYSTEM_PILLARS.length);
  });

  it('marks exactly one pillar as this codebase, and it is OrangeCat', () => {
    const self = ECOSYSTEM_PILLARS.filter(p => p.isSelf);
    expect(self).toHaveLength(1);
    expect(self[0].key).toBe('orangecat');
  });
});

describe('navigation derives from the pillar SSOT', () => {
  const siblings = ECOSYSTEM_PILLARS.filter(p => !p.isSelf);

  it('lists every sibling product in the footer, and never links out to itself', () => {
    const names = footerNavigation.ecosystem.map(item => item.name);
    for (const sibling of siblings) {
      expect(names).toContain(sibling.title);
    }
    const externalHrefs = footerNavigation.ecosystem
      .filter(item => 'external' in item && item.external)
      .map(item => item.href);
    expect(externalHrefs).not.toContain(ECOSYSTEM.orangeCat.siteUrl);
  });

  it('points the footer and header at the page that explains the stack', () => {
    expect(footerNavigation.ecosystem.map(item => item.href)).toContain(ROUTES.ECOSYSTEM);

    const menu = getHeaderNavigationItems().find(item => item.name === 'Ecosystem');
    expect(menu?.children?.map(child => child.href)).toContain(ROUTES.ECOSYSTEM);
  });

  it('gathers the sibling products under one header menu, marked external', () => {
    const menu = getHeaderNavigationItems().find(item => item.name === 'Ecosystem');
    expect(menu).toBeDefined();

    for (const sibling of siblings) {
      const entry = menu?.children?.find(child => child.name === sibling.title);
      expect(entry).toBeDefined();
      expect(entry?.href).toBe(sibling.siteUrl);
      // Off-site links must be flagged, or the header renders them as
      // same-tab internal routes.
      expect(entry?.external).toBe(true);
    }
  });
});
