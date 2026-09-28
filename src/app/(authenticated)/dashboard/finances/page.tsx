import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/layout/PageHeading';
import { PersonalFinances } from '@/components/finances/PersonalFinances';
import { DATABASE_TABLES } from '@/config/database-tables';
import { FINANCES_PAGE } from '@/config/finances';
import { ROUTES } from '@/config/routes';
import { getPersonalFinances } from '@/domain/finances/service';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = { title: FINANCES_PAGE.title, description: FINANCES_PAGE.lede };
export const dynamic = 'force-dynamic';

/** One person's money picture — what came in, what is owed, the civic split, the tax estimate. */
export default async function FinancesPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH);
  }
  const { data: actors } = await supabase
    .from(DATABASE_TABLES.ACTORS)
    .select('id')
    .eq('user_id', user.id);
  const actorIds = ((actors ?? []) as Array<{ id: string }>).map(a => a.id);
  const finances = await getPersonalFinances(supabase, user.id, actorIds);

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <header>
          <PageHeading>{FINANCES_PAGE.title}</PageHeading>
          <p className="mt-1 max-w-2xl text-sm text-fg-secondary">{FINANCES_PAGE.lede}</p>
        </header>
        <PersonalFinances finances={finances} />
      </div>
    </div>
  );
}
