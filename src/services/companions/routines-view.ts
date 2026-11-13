/**
 * What a bot's details read about its routines: the list, the first of it
 * (what a page loaded before a bot could hold several still reads), whether
 * they can run (only on the person's own key) and how many a bot may hold.
 */

import type { AnySupabaseClient } from '@/lib/supabase/types';
import { createApiKeyService } from '@/services/ai/api-key-service';
import { readOwnKey } from '@/services/ai/own-key';
import { sharedLokiOwnKeys } from '@/services/loki/shared-keys';
import { ROUTINES_PER_BOT, listRoutines, type Routine } from './routines-store';

export interface RoutinesView {
  routines: Routine[];
  routine: Routine | null;
  canRun: boolean;
  max: number;
}

export async function routinesView(
  supabase: AnySupabaseClient,
  userId: string,
  assistantId: string
): Promise<RoutinesView> {
  const [routines, own] = await Promise.all([
    listRoutines(supabase, userId, assistantId),
    readOwnKey(createApiKeyService(supabase), userId, () => sharedLokiOwnKeys(supabase, userId)),
  ]);
  return { routines, routine: routines[0] ?? null, canRun: own.hasByok, max: ROUTINES_PER_BOT };
}
