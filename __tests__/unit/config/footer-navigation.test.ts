/**
 * The footer lists each destination once.
 *
 * It used to end in a second row of links ("Documentation", "Source Code",
 * "Roadmap", "Support") that repeated four it already carried, and "Security"
 * sat under both Support and Legal: 31 links on a phone where 26 destinations
 * existed.
 */
import { footerNavigation } from '@/config/navigation';

describe('footer navigation', () => {
  it('has no destination twice, across the columns and the social icons', () => {
    const { product, learn, support, ecosystem, legal, social } = footerNavigation;
    const hrefs = [...product, ...learn, ...support, ...ecosystem, ...legal, ...social].map(
      item => item.href
    );
    const repeated = hrefs.filter((href, index) => hrefs.indexOf(href) !== index);
    expect(repeated).toEqual([]);
  });

  it('has no second row of links beside the copyright line', () => {
    expect(Object.keys(footerNavigation).sort()).toEqual([
      'ecosystem',
      'learn',
      'legal',
      'product',
      'social',
      'support',
    ]);
  });
});
