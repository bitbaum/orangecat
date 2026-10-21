import { describe, expect, it } from 'vitest';
import { leavesTemporary, TEMPORARY_CHAT_MAX_AGE_MS } from '@/lib/chat/temporary-chat';

/**
 * A temporary chat is gone when the person leaves it — a new chat, a switch
 * to another thread — and never earlier.
 */
describe('temporary chat', () => {
  it('is left by a new chat or a switch, not by entering or staying', () => {
    expect(leavesTemporary('t', null, 't')).toBe(true);
    expect(leavesTemporary('t', 'other', 't')).toBe(true);
    expect(leavesTemporary(null, 't', 't')).toBe(false);
    expect(leavesTemporary('t', 't', 't')).toBe(false);
  });

  it('deletes nothing when there is no temporary chat, or another thread is left', () => {
    expect(leavesTemporary('a', 'b', null)).toBe(false);
    expect(leavesTemporary('a', null, 't')).toBe(false);
  });

  it('is swept after a day regardless', () => {
    expect(TEMPORARY_CHAT_MAX_AGE_MS).toBe(24 * 60 * 60 * 1000);
  });
});
