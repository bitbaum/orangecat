/**
 * partitionTabs — splits profile tabs into up-front vs. "More" overflow.
 *
 * The invariants that keep the tab bar sane: order is preserved on both sides,
 * only present tabs count (a primary id with no tab just doesn't show), and an
 * unknown id never lands in primary.
 */

import { partitionTabs, PRIMARY_PROFILE_TAB_IDS } from '@/components/profile/profileTabLayout';

const tab = (id: string) => ({ id, label: id });

describe('partitionTabs', () => {
  it('keeps primary tabs and pushes the rest to overflow, preserving order', () => {
    const tabs = ['overview', 'info', 'timeline', 'projects', 'causes', 'wallets'].map(tab);
    const { primary, overflow } = partitionTabs(tabs, ['timeline', 'overview', 'projects']);
    expect(primary.map(t => t.id)).toEqual(['overview', 'timeline', 'projects']);
    expect(overflow.map(t => t.id)).toEqual(['info', 'causes', 'wallets']);
  });

  it('ignores primary ids with no matching tab (already-filtered visitor tabs)', () => {
    const tabs = ['timeline', 'overview'].map(tab);
    const { primary, overflow } = partitionTabs(tabs, [
      'timeline',
      'overview',
      'projects',
      'people',
    ]);
    expect(primary.map(t => t.id)).toEqual(['timeline', 'overview']);
    expect(overflow).toEqual([]);
  });

  it('puts everything in overflow when nothing is primary', () => {
    const tabs = ['a', 'b', 'c'].map(tab);
    const { primary, overflow } = partitionTabs(tabs, []);
    expect(primary).toEqual([]);
    expect(overflow.map(t => t.id)).toEqual(['a', 'b', 'c']);
  });

  it('defaults to PRIMARY_PROFILE_TAB_IDS', () => {
    const tabs = ['timeline', 'assets', 'companions'].map(tab);
    const { primary, overflow } = partitionTabs(tabs);
    expect(primary.map(t => t.id)).toEqual(['timeline']);
    expect(overflow.map(t => t.id)).toEqual(['assets', 'companions']);
  });

  it('never loses or duplicates a tab', () => {
    const tabs = [
      'timeline',
      'overview',
      'projects',
      'products',
      'services',
      'people',
      'info',
      'wallets',
    ].map(tab);
    const { primary, overflow } = partitionTabs(tabs);
    expect(primary.length + overflow.length).toBe(tabs.length);
    const seen = new Set([...primary, ...overflow].map(t => t.id));
    expect(seen.size).toBe(tabs.length);
  });
});

describe('PRIMARY_PROFILE_TAB_IDS', () => {
  it('is the intended up-front set (default tab included)', () => {
    expect(PRIMARY_PROFILE_TAB_IDS).toContain('timeline'); // ProfileViewTabs defaultTab
    expect(PRIMARY_PROFILE_TAB_IDS).toContain('overview');
    expect(PRIMARY_PROFILE_TAB_IDS).toContain('projects');
    // Long-tail entity + meta tabs live in the overflow menu.
    expect(PRIMARY_PROFILE_TAB_IDS).not.toContain('companions');
  });

  it('keeps wallets up front — the payment surface is never overflow', () => {
    // This assertion was previously inverted, and the inversion was the bug:
    // a profile with two live wallets read as a profile with no way to be paid.
    // GET /api/wallets returned both, countPublicWallets saw both, so the tab
    // was built and shown — inside the "More" menu, where its own owner did not
    // find it. On a platform whose premise is "get paid by anyone", the tab
    // answering "how do I pay this person?" is the one that cannot be tucked
    // away. If this ever flips back, the payment surface has gone missing again.
    expect(PRIMARY_PROFILE_TAB_IDS).toContain('wallets');

    const tabs = ['timeline', 'overview', 'wallets', 'companions'].map(tab);
    const { primary, overflow } = partitionTabs(tabs);
    expect(primary.map(t => t.id)).toContain('wallets');
    expect(overflow.map(t => t.id)).not.toContain('wallets');
  });
});
