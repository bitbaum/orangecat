import { prepareCatChat } from '@/services/cat/chat-prepare';
import { buildPlatformNavigationContext } from '@/services/cat/platform-navigation';
import type { AnySupabaseClient } from '@/lib/supabase/types';
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
