/**
 * /profiles/me — redirects to the current user's public profile.
 * Used by the sidebar "Profile" link which can't resolve username at build time.
 */

import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';

export default async function MyProfilePage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect(ROUTES.AUTH_LOGIN);
  }

  const { data: profileData } = await supabase
    .from(DATABASE_TABLES.PROFILES)
    .select('username')
    .eq('id', user.id)
    .maybeSingle();
  const profile = profileData as { username: string | null } | null;

  if (!profile?.username) {
    redirect(ROUTES.DASHBOARD.INFO_EDIT);
  }

  redirect(ROUTES.PROFILES.VIEW(profile.username));
}
