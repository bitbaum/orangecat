import { describe, expect, it, vi } from 'vitest';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { extractAndStoreEconomicProfile } from '@/services/cat/economic-profile';

// Use the real consent reader: a disabled preference or failed read must stop
// passive learning before either the economic store or model is accessed.
describe('economic profile passive learning consent', () => {
  it.each([
    { data: { memory_enabled: false }, error: null },
    { data: null, error: { message: 'unavailable' } },
  ])('does not extract when consent is unavailable: %j', async preference => {
    const maybeSingle = vi.fn().mockResolvedValue(preference);
    const from = vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({ eq: vi.fn().mockReturnValue({ maybeSingle }) }),
    });
    const aiService = { chatCompletion: vi.fn() };
    await extractAndStoreEconomicProfile(
      { from } as unknown as AnySupabaseClient,
      'user',
      'I am a carpenter and I own a workshop.',
      'Tell me more.',
      aiService,
      'test-model'
    );
    expect(maybeSingle).toHaveBeenCalledOnce();
    expect(from).toHaveBeenCalledOnce();
    expect(aiService.chatCompletion).not.toHaveBeenCalled();
  });
});
