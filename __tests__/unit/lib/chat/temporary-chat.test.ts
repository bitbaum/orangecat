import { describe, expect, it } from 'vitest';
import { TEMPORARY_CHAT_MAX_AGE_MS } from '@/lib/chat/temporary-chat';

/**
 * A temporary chat is gone when the person leaves it (chatkit's ChatApp, and
 * useCatTransport for its unlisted server row) — and the sweep takes any the
 * page could not, after a day.
 */
describe('temporary chat', () => {
  it('is swept after a day regardless', () => {
    expect(TEMPORARY_CHAT_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
