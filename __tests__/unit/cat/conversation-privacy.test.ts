import { describe, expect, it, vi } from 'vitest';
import { isEphemeralConversation } from '@/services/cat/conversation-history';
import type { AnySupabaseClient } from '@/lib/supabase/types';

describe('conversation privacy before durable learning', () => {
  it.each([
    [{ data: { ephemeral: false }, error: null }, false],
    [{ data: { ephemeral: true }, error: null }, true],
    [{ data: null, error: null }, true],
    [{ data: null, error: { message: 'unavailable' } }, true],
  ] as const)('requires an explicitly persistent owned row: %j', async (row, temporary) => {
    const query = {
      select: vi.fn().mockReturnThis(),
      eq: vi.fn().mockReturnThis(),
      maybeSingle: vi.fn().mockResolvedValue(row),
    };
    const client = { from: vi.fn().mockReturnValue(query) } as unknown as AnySupabaseClient;
    expect(await isEphemeralConversation(client, 'owner', 'conversation')).toBe(temporary);
    expect(query.eq).toHaveBeenCalledWith('user_id', 'owner');
    expect(query.eq).toHaveBeenCalledWith('id', 'conversation');
  });
});
