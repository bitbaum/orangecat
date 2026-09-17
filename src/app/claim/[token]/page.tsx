import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { getProfileClaimPreview } from '@/domain/profileClaims/service';
import ClaimPageClient from '@/components/claim/ClaimPageClient';
import { APP_NAME } from '@/config/brand';
import { publicProfilePath } from '@/config/public-profile-path';

interface PageProps {
  params: Promise<{ token: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { token } = await params;
  const result = await getProfileClaimPreview(token);
  if (!result.ok) {
    return { title: 'Claim link not found' };
  }
  const { profile } = result.data.draft;
  return {
    title: `Claim ${profile.name}’s profile`,
    description: `${profile.name} has a profile waiting on ${APP_NAME}. Claim it to make it yours.`,
    robots: { index: false, follow: false },
  };
}

export default async function ClaimPage({ params }: PageProps) {
  const { token } = await params;
  // The one place a visit is counted — `generateMetadata` above deliberately
  // does not, or every page load would register as two views.
  const result = await getProfileClaimPreview(token, { countView: true });

  if (!result.ok) {
    notFound();
  }

  const preview = result.data;

  // Already claimed — send anyone who still has the old link straight to the
  // live profile instead of showing them a dead-end "already claimed" page.
  if (preview.status === 'claimed' && preview.claimedUsername) {
    redirect(publicProfilePath(preview.claimedUsername));
  }

  return <ClaimPageClient preview={preview} />;
}
