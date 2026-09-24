/**
 * My Cat — Home API
 *
 * GET /api/cat/suggestions — what the Cat opens an empty chat with for THIS
 * user: ranked openers in the Cat's voice (each with its replies) and a few
 * personal chips. Generated from their real state and what the Cat remembers.
 *
 * Contract: @/config/cat-prompts. Rules: services/cat/prompt-suggestions.ts.
 */

import { apiSuccess } from '@/lib/api/standardResponse';
import { withOptionalAuth } from '@/lib/api/withAuth';
import { fetchFullContextForCat } from '@/services/ai/document-context';
import { generateCatHome } from '@/services/cat/prompt-suggestions';
import { listMemories } from '@/services/cat/memory';
import { STARTER_HOME } from '@/config/cat-prompts';
import { logger } from '@/utils/logger';

export const GET = withOptionalAuth(async request => {
  try {
    const { user, supabase } = request;

    if (!user) {
      return apiSuccess(STARTER_HOME);
    }

    const [context, memories] = await Promise.all([
      fetchFullContextForCat(supabase, user.id),
      listMemories(supabase, user.id),
    ]);
    const home = await generateCatHome(
      user.id,
      context,
      memories.map(m => m.content)
    );

    return apiSuccess(home);
  } catch (error) {
    logger.error('Cat home error', error, 'CatSuggestionsAPI');
    return apiSuccess(STARTER_HOME);
  }
});
