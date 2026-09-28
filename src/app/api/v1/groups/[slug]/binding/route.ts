/**
 * Public API — GET /api/v1/groups/:slug/binding
 *
 * Who owns this public organisation, what kind of body it is and where it
 * belongs — the facts Solon checks before founding an organization that IS
 * this group. No auth: the answer names an actor id, never a user, and only
 * for groups already listed publicly.
 */
import { NextRequest } from 'next/server';
import { getGroupBinding } from '@/domain/groups/binding.server';
import { apiNotFound, apiSuccess } from '@/lib/api/standardResponse';
import { createServerClient } from '@/lib/supabase/server';

export async function GET(_request: NextRequest, context: { params: Promise<{ slug: string }> }) {
  const { slug } = await context.params;
  const supabase = await createServerClient();
  const binding = await getGroupBinding(supabase, slug.toLowerCase());
  if (!binding) {
    return apiNotFound('Group not found');
  }
  return apiSuccess(binding);
}
