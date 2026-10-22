import { canSuggestAssetListing, isEligibleNudge } from '@/services/cat/nudge-eligibility';
import { NUDGE_COPY } from '@/services/cat/nudge-copy';

it.each(['bitcoin', 'BTC', 'my bitcoin', '0.5 BTC', 'CHF', 'cash', 'money', 'Swiss Franc'])(
  'does not turn a monetary holding (%s) into a rental-listing suggestion',
  name => {
    expect(canSuggestAssetListing(name)).toBe(false);
    expect(isEligibleNudge({ dedupe_key: `growth:asset:${name.toLowerCase()}` })).toBe(false);
  }
);
it.each(['camera', 'bitcoin mining rig', 'spare room'])(
  'keeps a legitimate listing candidate: %s',
  name => expect(canSuggestAssetListing(name)).toBe(true)
);
it.each(['en', 'de'] as const)('does not invent idle usage or earnings in %s copy', language => {
  const copy = NUDGE_COPY[language].growthAsset({ asset: 'camera', wanted: false });
  expect(copy.body).not.toMatch(/idle|earn|ungenutzt|verdien/i);
});
