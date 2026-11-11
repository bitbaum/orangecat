/**
 * GET /api/ai-assistants/fleet — the fleet's own bots that can sit in a room.
 *
 * Read from the fleet map Loki publishes (names, what each is, where it
 * runs) joined with the ask contract in src/config/fleet-bots.ts. When the
 * map cannot be reached the list is empty and `mapReachable` says so, so the
 * rail can tell the person instead of showing a stale name.
 */

import { apiSuccess } from '@/lib/api/standardResponse';
import { getCacheControl } from '@/lib/api/helpers';
import { fleetBots } from '@/services/companions/rooms/fleet';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await fleetBots();
  return apiSuccess(result, { headers: { 'Cache-Control': getCacheControl(false) } });
}
