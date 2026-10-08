/**
 * Whether a request to a room is an investor opening something — the one rule
 * every place that records an open asks (ADR-0012 D4). Server-only.
 *
 * Three things are not an open:
 * - a messenger drawing a link's preview card (isLinkPreviewBot);
 * - the browser fetching ahead of a click (isPrefetchRequest);
 * - the OWNER, previewing or clicking through their own room.
 *
 * It lives in one function because it used to live in two: the room page
 * skipped the owner and the click-through route did not, so an owner clicking
 * "Build record" in their own room was logged — and notified — as an investor.
 */

import { isLinkPreviewBot, isPrefetchRequest } from '@/lib/link-preview-bots';
import { createServerClient } from '@/lib/supabase/server';
import { checkOwnership } from '@/services/actors';

async function viewerOwns(actorId: string | null): Promise<boolean> {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return !!user && (await checkOwnership({ actor_id: actorId }, user.id, supabase));
}

export async function countsAsOpen(
  headers: Pick<Headers, 'get'>,
  projectActorId: string | null
): Promise<boolean> {
  if (isLinkPreviewBot(headers.get('user-agent')) || isPrefetchRequest(headers)) {
    return false;
  }
  return !(await viewerOwns(projectActorId));
}
