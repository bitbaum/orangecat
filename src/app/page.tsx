import { fromTable } from '@/lib/supabase/untyped';
import { redirect } from 'next/navigation';
import { createServerClient } from '@/lib/supabase/server';
import HomePublic from '@/components/home/HomePublic';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE } from '@/config/brand';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';
import { findOwnedEntityType } from '@/services/profile/findOwnedEntityType';
import { pageMetadata } from '@/lib/seo/metadata';
import { logger } from '@/utils/logger';

// The homepage's own share card and canonical URL. They sat in the root
// layout, where every page that set none of its own inherited them.
export const metadata = pageMetadata({
  title: `${APP_NAME} — ${APP_TAGLINE}`,
  description: APP_DESCRIPTION,
  path: ROUTES.HOME,
});

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
        // The same first screen every way in leads to (lib/auth/landing.ts):
        // the Cat's welcome. The logo used to open the onboarding form here,
        // every time, for anyone who had not filled it in. The form is still
        // one tap away from the welcome ("Tell Cat who you are").
        redirect(ROUTES.DASHBOARD.CAT_WELCOME);
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
