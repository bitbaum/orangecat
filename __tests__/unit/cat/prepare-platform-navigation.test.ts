import { getMessagesForContext } from '@/services/cat/conversation-history';
import { prepareCatChat } from '@/services/cat/chat-prepare';
import { buildPlatformNavigationContext } from '@/services/cat/platform-navigation';
import type { AnySupabaseClient } from '@/lib/supabase/types';
import { buildFullContextString, fetchFullContextForCat } from '@/services/ai/document-context';
vi.mock('@/services/ai/document-context', () => ({
  fetchFullContextForCat: vi.fn(async () => ({ profile: { username: 'review-guest' } })),
  buildFullContextString: vi.fn(() => 'PROFILE: review-guest. No saved projects or documents.'),
}));
vi.mock('@/services/cat/memory', () => ({ recallMemories: vi.fn(async () => []) }));
vi.mock('@/services/cat/custom-instructions', () => ({
  getCustomInstructions: vi.fn(async () => null),
}));
vi.mock('@/services/cat/proactivity', () => ({ proactivityEnabled: vi.fn(async () => false) }));
vi.mock('@/services/cat/conversation-history', () => ({
  resolveConversationIdOrDefault: vi.fn(async () => 'conversation'),
  getMessagesForContext: vi.fn(async () => []),
  isEphemeralConversation: vi.fn(async () => false),
}));
it('keeps verified navigation after grounding rules and admits it as evidence for a new account', async () => {
  const result = await prepareCatChat({} as AnySupabaseClient, 'review-guest', {
    message: 'I want to write an article. Where is the article editor?',
    actionsVia: 'tools',
    tokenBudget: 6826,
  });
  const capability = buildPlatformNavigationContext();
  expect(result.budget.fits).toBe(true);
  expect(result.systemPrompt).toContain(capability);
  expect(result.systemPrompt.indexOf(capability)).toBeGreaterThan(
    result.systemPrompt.indexOf('Grounding rules')
  );
  expect(result.grounding.evidence[0]).toBe(capability);
  expect(result.systemPrompt).toContain('not these verified navigation destinations');
});

it('keeps navigation available when personal context is empty', async () => {
  vi.mocked(buildFullContextString).mockReturnValueOnce('');
  const result = await prepareCatChat({} as AnySupabaseClient, 'review-guest', {
    message: 'I wanna see and use investor room',
  });
  expect(result.systemPrompt).toContain(buildPlatformNavigationContext());
  expect(result.grounding.evidence).toContain(buildPlatformNavigationContext());
});

it('carries a real project room into both the model prompt and grounding evidence', async () => {
  const entities = [{ id: 'venture-one', type: 'project', title: 'Venture', status: 'draft' }];
  vi.mocked(fetchFullContextForCat).mockResolvedValueOnce({ entities } as Awaited<
    ReturnType<typeof fetchFullContextForCat>
  >);
  const result = await prepareCatChat({} as AnySupabaseClient, 'review-guest', {
    message: 'I wanna see and use investor room',
  });
  expect(result.systemPrompt).toContain('/projects/venture-one/room');
  expect(result.grounding.evidence[0]).toContain('/projects/venture-one/room');
});

it('skips durable learning when history/privacy preparation fails', async () => {
  vi.mocked(getMessagesForContext).mockRejectedValueOnce(new Error('unavailable'));
  const result = await prepareCatChat({} as AnySupabaseClient, 'review-guest', {
    message: 'Hello',
  });
  expect(result.ephemeral).toBe(true);
});
