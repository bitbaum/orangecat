import { fromTable } from '@/lib/supabase/untyped';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import HomePublic from '@/components/home/HomePublic';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { findOwnedEntityType } from '@/services/profile/findOwnedEntityType';
import { logger } from '@/utils/logger';

export default async function Home() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    const { data: profile } = await supabase
      .from(DATABASE_TABLES.PROFILES)
      .select('onboarding_completed')
      .eq('id', user.id)
      .single<{ onboarding_completed: boolean | null }>();

    if (!profile?.onboarding_completed) {
      // Self-heal: if the user already owns anything — a wallet, a product,
      // a draft of any kind — the onboarding flag is stale; they clearly
      // didn't need the wizard. Catches users who abandoned the flow mid-way
      // or whose flag never got written. Otherwise every visit to / sends
      // them back to a wizard they don't want. Projects alone used to count.
      const ownedType = await findOwnedEntityType(supabase, user.id);

      if (ownedType) {
        await fromTable(supabase, DATABASE_TABLES.PROFILES)
          .update({ onboarding_completed: true })
          .eq('id', user.id);
        logger.info('Self-healed onboarding_completed for user with content', {
          userId: user.id,
          ownedType,
        });
      } else {
        // Land directly in the Cat-first flow. The previous /onboarding
        // route's first step was a tile-button to /onboarding/intelligent
        // anyway — collapse the indirection.
        redirect(ROUTES.ONBOARDING.INTELLIGENT);
      }
    }
    // Cat-first: an already-onboarded visitor landing on "/" (or the brand
    // mark, which points here) goes to the Cat hub. Deliberately NOT
    // DASHBOARD.HOME — /dashboard is the dashboard again, and the sidebar's
    // "Home" entry is what takes you there.
    redirect(ROUTES.DASHBOARD.CAT);
  }

  return <HomePublic />;
}
