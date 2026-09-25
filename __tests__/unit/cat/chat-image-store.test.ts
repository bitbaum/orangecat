/**
 * Chat photos are private to their owner, and a listing's photo only ever
 * comes from a real upload — never from a model writing a URL.
 */

import { isOwnChatImagePath } from '@/services/cat/chat-image-store';
import { imageFieldOf, resolveAiAssistTarget } from '@/lib/ai/assist-target';

vi.mock('@/lib/supabase/admin', () => ({ getAdminClient: vi.fn() }));

describe('isOwnChatImagePath', () => {
  const me = '6f1c2a3b-0000-4000-8000-000000000001';

  it('accepts only paths in the caller’s own chat folder', () => {
    expect(isOwnChatImagePath(`${me}/cat/abc-123.webp`, me)).toBe(true);
    expect(isOwnChatImagePath(`someone-else/cat/abc.webp`, me)).toBe(false);
    expect(isOwnChatImagePath(`${me}/avatar.png`, me)).toBe(false);
    expect(isOwnChatImagePath(`${me}/cat/../../x/cat/a.png`, me)).toBe(false);
    expect(isOwnChatImagePath(`${me}/cat/a/b.png`, me)).toBe(false);
  });
});

describe('listing photos', () => {
  it('a product form has a photo field', () => {
    expect(imageFieldOf('product')).toBe('thumbnail_url');
  });

  it('the prefill model is never offered an image field to invent a URL for', () => {
    const fields = resolveAiAssistTarget('product')?.fields ?? [];
    expect(fields.length).toBeGreaterThan(0);
    expect(fields.some(f => f.type === 'image')).toBe(false);
  });
});
