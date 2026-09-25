/**
 * A Cat draft the model returned without a title (it did, live, for "sell this
 * photo as a digital download for CHF 15") disabled Publish and Save draft.
 * The card now starts from the draft's own source instead of a blank.
 */

import { fallbackTitle } from '@/components/ai-chat/ModernChatPanel/components/PrefilledFormCard';

describe('fallbackTitle', () => {
  it('takes the first clause of the source description', () => {
    expect(fallbackTitle('Digital download of a sunset photograph for CHF 15.')).toBe(
      'Digital download of a sunset photograph for CHF 15'
    );
  });

  it('is capped and never empty for a real source', () => {
    const long = 'A'.repeat(200);
    expect(fallbackTitle(long).length).toBeLessThanOrEqual(71);
    expect(fallbackTitle('  ')).toBe('');
  });
});
