import type { Metadata } from 'next';
import Link from 'next/link';
import { redirect } from 'next/navigation';
import { PageHeading } from '@/components/layout/PageHeading';
import { MyThingsList } from '@/components/things/MyThingsList';
import { ROUTES } from '@/config/routes';
import { THINGS_PAGE } from '@/config/things';
import { listMyThings } from '@/domain/things/service';
import { createServerClient } from '@/lib/supabase/server';

export const metadata: Metadata = {
  title: THINGS_PAGE.title,
  description: THINGS_PAGE.lede,
};

export const dynamic = 'force-dynamic';

/** Everything the person made or joined — the one page the fifteen dashboards fold into. */
export default async function MyThingsPage() {
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(ROUTES.AUTH);
  }
  const things = await listMyThings(supabase, user.id);

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack pb-20 sm:pb-8">
        <header className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <PageHeading>{THINGS_PAGE.title}</PageHeading>
            <p className="mt-1 text-sm text-fg-secondary">{THINGS_PAGE.lede}</p>
          </div>
          <Link
            href={ROUTES.CREATE}
            className="inline-flex min-h-11 items-center rounded-lg bg-accent-warm px-4 text-sm font-semibold text-on-accent"
          >
            Create
          </Link>
        </header>
        <MyThingsList things={things} />
      </div>
    </div>
  );
}
