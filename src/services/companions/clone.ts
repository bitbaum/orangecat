/**
 * Cloning a companion copies the definition and nothing else.
 *
 * The clone is a new, private companion owned by the cloner, with
 * `cloned_from` pointing at the source. No memories travel: memory belongs to
 * the relationship between a companion and one person, so "sell it without
 * its memory of me" is not a feature here, it is the shape of the data.
 *
 * Visibility of the source is enforced by RLS on the read: a person can read
 * a public, active companion or their own, and nothing else.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { DATABASE_TABLES } from '@/config/database-tables';
import { aiAssistantSchema } from '@/lib/validation';
import { createAssistant } from '@/services/ai/assistant-service';

/** The columns that define a companion; everything else is state or ownership. */
export const COMPANION_DEFINITION_COLUMNS = [
  'title',
  'description',
  'category',
  'tags',
  'avatar_url',
  'system_prompt',
  'welcome_message',
  'personality_traits',
  'model_preference',
  'max_tokens_per_response',
  'temperature',
] as const;

interface DefinitionRow {
  id: string;
  title: string;
  description: string | null;
  category: string | null;
  tags: string[] | null;
  avatar_url: string | null;
  system_prompt: string;
  welcome_message: string | null;
  personality_traits: string[] | null;
  model_preference: string | null;
  max_tokens_per_response: number | null;
  temperature: number | null;
}

export type CloneResult =
  | { ok: true; data: Record<string, unknown> }
  | { ok: false; notFound: true }
  | { ok: false; dbError: unknown };

export async function cloneCompanion(
  supabase: AnySupabaseClient,
  userId: string,
  sourceId: string
): Promise<CloneResult> {
  const { data, error } = await supabase
    .from(DATABASE_TABLES.AI_ASSISTANTS)
    .select(['id', ...COMPANION_DEFINITION_COLUMNS].join(', '))
    .eq('id', sourceId)
    .maybeSingle();

  if (error) {
    return { ok: false, dbError: error };
  }
  if (!data) {
    return { ok: false, notFound: true };
  }
  const source = data as unknown as DefinitionRow;

  // Through the schema so every default the create route applies applies here
  // too; the clone starts private and free regardless of the source's pricing.
  const input = aiAssistantSchema.parse({
    title: source.title,
    description: source.description ?? undefined,
    category: source.category ?? undefined,
    tags: source.tags ?? [],
    avatar_url: source.avatar_url ?? undefined,
    system_prompt: source.system_prompt,
    welcome_message: source.welcome_message ?? undefined,
    personality_traits: source.personality_traits ?? [],
    model_preference: source.model_preference ?? 'any',
    max_tokens_per_response: source.max_tokens_per_response ?? 1000,
    temperature: source.temperature ?? 0.7,
    pricing_model: 'free',
    is_public: false,
  });

  return createAssistant(supabase, userId, input, { clonedFrom: source.id });
}
