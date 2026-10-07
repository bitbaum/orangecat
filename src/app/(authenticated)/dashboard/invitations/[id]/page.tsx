import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { MailX } from 'lucide-react';
import EmptyState from '@/components/ui/EmptyState';
import Button from '@/components/ui/Button';
import { InvitationAnswer } from '@/components/groups/invitations/InvitationAnswer';
import { ROUTES } from '@/config/routes';
import { getInvitationForInvitee } from '@/domain/groups/invitations.server';
import { getAdminClient } from '@/lib/supabase/admin';
import { createServerClient } from '@/lib/supabase/server';
import type { AnySupabaseClient } from '@/lib/supabase/types';

export const metadata: Metadata = { title: 'Group invitation' };
export const dynamic = 'force-dynamic';

/**
 * Where an invitee answers a group invitation — the notification links here.
 * Not the group page: a private group is unreadable to someone who has not
 * joined yet, so it would answer "not found" to the very person invited.
 */
export default async function InvitationPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`${ROUTES.AUTH}?from=${encodeURIComponent(ROUTES.DASHBOARD.INVITATION(id))}`);
  }

  const invitation = await getInvitationForInvitee(
    supabase,
    getAdminClient() as unknown as AnySupabaseClient,
    id,
    user.id
  );

  return (
    <div className="oc-page">
      <div className="oc-page-container oc-page-stack max-w-xl pb-20 sm:pb-8">
        {invitation?.group ? (
          <InvitationAnswer invitation={invitation} />
        ) : (
          <EmptyState
            icon={MailX}
            title="This invitation isn't here"
            description="It may have been withdrawn, or it was sent to a different account."
            action={
              <Button href={ROUTES.DASHBOARD.HOME} variant="outline">
                Back to dashboard
              </Button>
            }
          />
        )}
      </div>
    </div>
  );
}
