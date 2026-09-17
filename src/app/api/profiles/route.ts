import { apiSuccessPaginated, handleApiError } from '@/lib/api/standardResponse';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { getAdminClient } from '@/lib/supabase/admin';
import { DATABASE_TABLES } from '@/config/database-tables';

// GET /api/profiles - List profiles (basic fields)
export const GET = withAuth(async (request: AuthenticatedRequest) => {
  try {
    // Deliberately the SERVICE-ROLE client, not the caller's.
    //
    // The query below selects `email` for EVERY profile, not just the caller's,
    // because isEmailDerivedHandle() needs it to decide whether a handle gives
    // away its owner's email local part. `authenticated` no longer holds SELECT
    // on that column (20260917163100) and must not get it back: a column grant
    // covers every signed-in user at once, so granting it to run this one
    // heuristic would reopen exactly the hole that migration closed.
    //
    // What the role change does NOT widen: the only SELECT policy on profiles
    // is "Public profiles are viewable by everyone" (USING (true)), so there is
    // no row filtering to lose. The projection is fixed, the email is read for
    // the filter and stripped before the response is built (see below), and the
    // route is still behind withAuth. The alternative — reimplementing the
    // heuristic in SQL inside the view — would put a second, untested copy of a
    // rule that already has one tested definition in @/config/public-directory.
    const supabase = getAdminClient();

    const search = request.nextUrl.searchParams.get('search')?.trim() || '';
    const limit = Math.min(Number(request.nextUrl.searchParams.get('limit') || 50), 200);
    const page = Math.max(Number(request.nextUrl.searchParams.get('page') || 1), 1);
    const offset = (page - 1) * limit;

    let query = supabase
      .from(DATABASE_TABLES.PROFILES)
      .select(
        `id, username, name, bio, avatar_url, bitcoin_address, lightning_address, created_at, updated_at, email`,
        { count: 'exact' }
      )
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Hide anonymous-user and CI fixture profiles from the people picker.
    query = query
      .not('username', 'ilike', 'user\\_________')
      .not('username', 'ilike', 'e2e-reset-%')
      .not('username', 'ilike', 'e2e\\_%');

    if (search) {
      // Search across username OR name (escape % and _ for LIKE patterns)
      const escapedSearch = search.replace(/[%_]/g, '\\$&');
      query = query.or(`username.ilike.%${escapedSearch}%,name.ilike.%${escapedSearch}%`);
    }

    const { data, error, count } = await query;
    if (error) {
      throw error;
    }

    const { isFixtureProfile, isEmailDerivedHandle } = await import('@/config/public-directory');
    const rows = (data || []).filter(p => !isFixtureProfile(p));
    // Defense in depth for accounts not yet through the (manual, deliberate —
    // see scripts/rename-email-derived-usernames.sql) backfill: keep them out
    // of the unprompted default suggestion list, the surface this was
    // reported from. An explicit search still finds them — hiding a real
    // person from someone typing their exact name would be an availability
    // regression, not a privacy fix.
    const filtered = search ? rows : rows.filter(p => !isEmailDerivedHandle(p));
    // Never ship the email column to the client — it was only selected for
    // the filter above.
    const profiles = filtered.map(({ email: _email, ...rest }) => rest);
    return apiSuccessPaginated(profiles, page, limit, count ?? profiles.length);
  } catch (error) {
    return handleApiError(error);
  }
});
