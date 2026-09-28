// @vitest-environment jsdom
/**
 * The two pure civic-split surfaces render what they are given: the sliders
 * with the person's own place names and a bar that adds up, and the profile
 * card only when there is something to show. Server-rendered on purpose — the
 * profile card ships in a server component tree.
 */
import { renderToString } from 'react-dom/server';
import ShareSliders, { SplitBar } from '@/components/civic-split/ShareSliders';
import ProfileCivicSplit from '@/components/profile/ProfileCivicSplit';
import { CIVIC_SPLIT_CAVEAT } from '@/config/civic-split';

const shares = { locality: 60, region: 30, nation: 10 };

describe('ShareSliders', () => {
  it('names each level after the place typed above it', () => {
    const html = renderToString(
      <ShareSliders
        shares={shares}
        onChange={() => {}}
        placeNames={{ locality: 'Witikon', region: 'Zürich', nation: 'CH' }}
      />
    );
    expect(html).toContain('Witikon');
    expect(html).toContain('Zürich');
    expect(html).toContain('60%');
    expect(html.match(/type="range"/g)).toHaveLength(3);
  });

  it('the bar describes the whole split for a screen reader', () => {
    const html = renderToString(<SplitBar shares={shares} />);
    expect(html).toContain('Locality 60%, Region 30%, Nation 10%');
  });
});

describe('ProfileCivicSplit', () => {
  it('renders nothing without a public split', () => {
    expect(renderToString(<ProfileCivicSplit split={null} />)).toBe('');
  });

  it('shows the split, the note and the caveat', () => {
    const html = renderToString(
      <ProfileCivicSplit
        split={{
          country_code: 'CH',
          region: 'Zürich',
          locality: 'Witikon',
          shares,
          note: 'My street first.',
        }}
      />
    );
    expect(html).toContain('Witikon');
    expect(html).toContain('My street first.');
    expect(html).toContain(CIVIC_SPLIT_CAVEAT.slice(0, 40));
  });
});
