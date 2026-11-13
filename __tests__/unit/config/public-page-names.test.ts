/**
 * A public page has one name wherever it is listed.
 *
 * The header and the footer used to label the same routes on their own:
 * "Pricing" in the header was "Cat plans" in the footer, "Docs" was
 * "Documentation", and the header's top-level "Support" opened the page where
 * people fund OrangeCat, not where they get help. Every public link is built
 * from PUBLIC_PAGES now.
 */
import { footerNavigation, getHeaderNavigationItems, PUBLIC_PAGES } from '@/config/navigation';
import { ROUTES } from '@/config/routes';

type Link = { name: string; href?: string; external?: boolean; children?: Link[] };

const flatten = (items: Link[]): Link[] =>
  items.flatMap(item => (item.children?.length ? flatten(item.children) : [item]));

describe('public page names', () => {
  const header = flatten(getHeaderNavigationItems());
  const { social: _social, ...columns } = footerNavigation;
  const footer = Object.values(columns).flat() as Link[];

  it('calls every internal header and footer link by its one name', () => {
    for (const link of [...header, ...footer].filter(l => !l.external)) {
      const page = PUBLIC_PAGES[link.href as keyof typeof PUBLIC_PAGES];
      expect(page, link.href).toBeDefined();
      expect(link.name).toBe(page.name);
    }
  });

  it('puts Pricing and Blog at the top level, and no bare "Support"', () => {
    const top = getHeaderNavigationItems();
    const topLinks = top.filter(item => !item.children?.length).map(item => item.href);
    expect(topLinks).toEqual(expect.arrayContaining([ROUTES.PRICING, ROUTES.BLOG]));
    expect(top.map(item => item.name)).not.toContain('Support');
  });

  it('keeps what the product does apart from the company pages', () => {
    const group = (name: string) =>
      getHeaderNavigationItems()
        .find(item => item.name === name)
        ?.children?.map(child => child.href);
    expect(group('Product')).toEqual([
      ROUTES.HOW_IT_WORKS,
      ROUTES.WHAT_YOU_CAN_DO,
      ROUTES.DISCOVER,
      ROUTES.PAY_LANDING,
    ]);
    expect(group('About')).toEqual(
      expect.arrayContaining([ROUTES.ABOUT, ROUTES.ROADMAP, ROUTES.DOCS, ROUTES.SUPPORT])
    );
  });
});
