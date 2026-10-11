'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { ArrowLeft } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ROUTES } from '@/config/routes';
import { useState } from 'react';
import { getStatusInfo } from '@/config/status-config';
import { PublicEntityPaymentSection } from '@/components/payment';
import type { SellerReceiveInfo } from '@/domain/payments';
import type { LokiProjectLink } from '@/services/loki/project-link';
import type { FleetTile } from '@/components/ecosystem/studio-fleet';
import { WishlistDonationTiers } from '@/components/wishlist/WishlistDonationTiers';
import { ProjectMobileFundBar, useMobileFundBar } from './ProjectMobileFundBar';

const MissingWalletBanner = dynamic(() => import('@/components/project/MissingWalletBanner'));
const ProjectShare = dynamic(() => import('@/components/sharing/ProjectShare'));
const ProjectMediaGallery = dynamic(() => import('@/components/project/ProjectMediaGallery'));
const ProjectSummaryRail = dynamic(() => import('@/components/project/ProjectSummaryRail'));
const ProjectHeader = dynamic(() => import('@/components/project/ProjectHeader'));
const ProjectContent = dynamic(() => import('@/components/project/ProjectContent'));
const ProjectTimeline = dynamic(() => import('@/components/project/ProjectTimeline'));
const ProjectEvidence = dynamic(() => import('@/components/project/ProjectEvidence'));
const StudioProjectBanner = dynamic(() => import('@/components/project/StudioProjectBanner'));

interface Project {
  id: string;
  title: string;
  description: string;
  user_id: string;
  goal_amount: number | null;
  currency: string;
  funding_purpose: string | null;
  work_status?: string | null;
  bitcoin_address: string | null;
  lightning_address: string | null;
  website_url: string | null;
  category: string | null;
  tags: string[] | null;
  status: string;
  raised_amount: number | null;
  created_at: string;
  updated_at: string;
  // Extended fields that may be present
  /** Honest settled-contributions total in BTC (from get_entity_funding_stats). */
  settled_raised_btc?: number | null;
  bitcoin_balance_btc?: number | null;
  bitcoin_balance_updated_at?: string | null;
  supporters_count?: number | null;
  last_support_at?: string | null;
  /**
   * When the creator says the work will be done. The page fetch is `select('*')`
   * and spreads the whole row, so this value was ALREADY arriving here — it was
   * this interface not declaring it that kept it off the screen. A narrow prop
   * type hides a wide payload, and the compiler cannot warn about a field it was
   * never told exists.
   */
  target_completion?: string | null;
  profiles?: {
    username: string | null;
    name: string | null;
    avatar_url: string | null;
  };
}

interface ProjectPageClientProps {
  project: Project;
  sellerReceive: SellerReceiveInfo | null;
  /**
   * Resolved on the server: the OWNER (by actor, not by who created the row)
   * or the steward of a page set up for someone who has not claimed it yet
   * (ADR-0005 D5). `user_id` alone is wrong twice — it names the steward as
   * owner after the claim, and hides the controls from the person it now
   * belongs to.
   */
  canManage?: boolean;
  /** What Loki says about this project, resolved on the server. */
  lokiBuild?: LokiProjectLink | null;
  /** The studio product this project IS, when the fleet map knows it. */
  studio?: FleetTile | null;
  /** The receiving wallet whose ledger is public, if any (services/wallets/entityOpenLedger). */
  openLedgerWalletId?: string | null;
}

/**
 * Project Page Client Component
 *
 * Handles all client-side interactivity for project pages.
 * The server component handles data fetching and SEO metadata.
 */
export default function ProjectPageClient({
  project,
  sellerReceive,
  canManage,
  lokiBuild,
  studio,
  openLedgerWalletId,
}: ProjectPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [showShareDialog, setShowShareDialog] = useState(false);

  const isOwner = canManage ?? project.user_id === user?.id;
  const projectId = project.id;

  const showMobileFundBar = useMobileFundBar(!isOwner && !!sellerReceive);

  return (
    // While the Fund bar shows, the page needs the room under it too — nav
    // clearance alone left the last content behind the bar.
    <div
      className={`bg-surface-page min-h-screen ${showMobileFundBar ? 'oc-mobile-action-stack-padding' : ''}`}
    >
      <div className="max-w-6xl mx-auto px-4 py-8">
        {/* Header with Back Button */}
        <div className="mb-6">
          <Button
            onClick={() => router.back()}
            variant="ghost"
            size="sm"
            className="mb-6"
            aria-label="Go back to previous page"
            onKeyDown={e => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                router.back();
              }
            }}
          >
            <ArrowLeft className="w-4 h-4 mr-2" aria-hidden="true" />
            Back
          </Button>
        </div>

        {/* Layout: main + rail */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            {/* One of the studio's own products wears its face first */}
            {studio && <StudioProjectBanner studio={studio} />}

            {/* Project Header */}
            <ProjectHeader
              project={project}
              isOwner={isOwner}
              onShare={() => setShowShareDialog(true)}
              getStatusInfo={getStatusInfo}
            />

            {/* Missing Wallet Banner */}
            {!sellerReceive && (
              <MissingWalletBanner projectId={projectId} isOwner={isOwner} className="mb-6" />
            )}

            {/* Gallery */}
            <ProjectMediaGallery projectId={projectId} className="mb-6" />

            {/* Project Content */}
            <ProjectContent
              project={{
                ...project,
                id: project.id,
                bitcoin_address: project.bitcoin_address,
                lightning_address: project.lightning_address,
                isOwner,
              }}
            />

            {/* Project Timeline */}
            <div className="mt-8">
              <ProjectTimeline
                projectId={project.id}
                projectTitle={project.title}
                isOwner={isOwner}
              />
            </div>
          </div>
          <div className="space-y-6">
            <div id="pay" className="scroll-mt-24">
              <PublicEntityPaymentSection
                entityType="project"
                entityId={project.id}
                entityTitle={project.title}
                sellerProfileId={project.user_id}
                sellerUserId={project.user_id}
                sellerReceive={sellerReceive}
                signInRedirect={ROUTES.PROJECTS.VIEW(project.id)}
              />
            </div>

            {!isOwner && project.user_id && (
              <WishlistDonationTiers
                userId={project.user_id}
                projectId={project.id}
                projectTitle={project.title}
              />
            )}

            <ProjectSummaryRail
              project={{
                id: project.id,
                goal_amount: project.goal_amount,
                currency: project.currency,
                bitcoin_address: project.bitcoin_address,
                bitcoin_balance_btc: project.bitcoin_balance_btc || 0,
                bitcoin_balance_updated_at: project.bitcoin_balance_updated_at || null,
                supporters_count: project.supporters_count || 0,
                last_support_at: project.last_support_at || null,
                user_id: project.user_id,
                target_completion: project.target_completion ?? null,
              }}
              settledRaisedBtc={project.settled_raised_btc || 0}
              isOwner={isOwner}
            />

            <ProjectEvidence
              projectId={project.id}
              isOwner={isOwner}
              lokiBuild={lokiBuild}
              openLedgerWalletId={openLedgerWalletId}
            />
          </div>
        </div>
      </div>

      {/* Share Dialog */}
      {showShareDialog && project && (
        <div className="fixed inset-0 z-50 flex items-start justify-end p-4 pointer-events-none">
          <div className="pointer-events-auto mt-20 mr-4">
            <ProjectShare
              projectId={project.id}
              projectTitle={project.title}
              projectDescription={project.description}
              currentUrl={
                typeof window !== 'undefined'
                  ? `${window.location.origin}${ROUTES.PROJECTS.VIEW(project.id)}`
                  : ''
              }
              onClose={() => setShowShareDialog(false)}
              variant="dropdown"
            />
          </div>
        </div>
      )}

      {/* Floating CTA - Mobile Only. Position + z sourced from SSOT
          so this bar consistently sits above MobileBottomNav. */}
      {showMobileFundBar && <ProjectMobileFundBar project={project} />}
    </div>
  );
}
