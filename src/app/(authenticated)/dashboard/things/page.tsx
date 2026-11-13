import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { redirect } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import Button from '@/components/ui/Button';
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
      {/* One column, the dashboard's width: this is a list, not a grid. The
          shared page header, and an in-app primary action (the warm accent is
          for bringing someone in, not for actions inside the app). */}
      <div className="oc-page-container oc-page-stack mx-auto max-w-2xl pb-20 sm:pb-8">
        <PageHeader
          title={THINGS_PAGE.title}
          subtitle={THINGS_PAGE.lede}
          actions={
            <Button href={ROUTES.CREATE} variant="primary" className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              Create
            </Button>
          }
        />
        <MyThingsList things={things} />
      </div>
    </div>
  );
}
