// @vitest-environment jsdom
/**
 * "Ask about this" leaves a draft in the conversation's composer — typed FOR
 * the buyer, never sent for them — and it is read exactly once.
 */

import { inquiryDraft, stashMessageDraft, takeMessageDraft } from '@/features/messaging/lib/draft';

describe('message drafts', () => {
  beforeEach(() => window.sessionStorage.clear());

  it('names the listing and leaves room for the question', () => {
    expect(inquiryDraft('Morning with Cat', 'https://orangecat.ch/products/1')).toBe(
      'Hi! I have a question about “Morning with Cat” (https://orangecat.ch/products/1): '
    );
  });

  it('is read once, per conversation', () => {
    stashMessageDraft('c1', 'hello');
    expect(takeMessageDraft('c2')).toBeNull();
    expect(takeMessageDraft('c1')).toBe('hello');
    expect(takeMessageDraft('c1')).toBeNull();
  });
});
