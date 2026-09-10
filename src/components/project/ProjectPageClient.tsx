'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import Button from '@/components/ui/Button';
import { ArrowLeft, Bitcoin } from 'lucide-react';
import dynamic from 'next/dynamic';
import { ROUTES } from '@/config/routes';
import { useState, useEffect } from 'react';
import { formatCurrency } from '@/services/currency';
import { getStatusInfo } from '@/config/status-config';
import { PublicEntityPaymentSection } from '@/components/payment';
import { Z_INDEX_CLASSES } from '@/constants/z-index';
import type { SellerReceiveInfo } from '@/domain/payments';

const MissingWalletBanner = dynamic(() => import('@/components/project/MissingWalletBanner'));
const ProjectShare = dynamic(() => import('@/components/sharing/ProjectShare'));
const ProjectMediaGallery = dynamic(() => import('@/components/project/ProjectMediaGallery'));
const ProjectSummaryRail = dynamic(() => import('@/components/project/ProjectSummaryRail'));
const ProjectHeader = dynamic(() => import('@/components/project/ProjectHeader'));
const ProjectContent = dynamic(() => import('@/components/project/ProjectContent'));
const ProjectTimeline = dynamic(() => import('@/components/project/ProjectTimeline'));
const FleetCrownBuildCta = dynamic(() => import('@/components/integrations/FleetCrownBuildCta'));

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
}: ProjectPageClientProps) {
  const router = useRouter();
  const { user } = useAuth();
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showFloatingCTA, setShowFloatingCTA] = useState(false);

  const isOwner = canManage ?? project.user_id === user?.id;
  const projectId = project.id;

  // Show floating CTA on mobile after scrolling past 300px
  useEffect(() => {
    const handleScroll = () => {
      setShowFloatingCTA(window.scrollY > 300);
    };

    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Scroll to support section
  const scrollToSupport = () => {
    const supportSection = document.getElementById('bitcoin-support-section');
    if (supportSection) {
      supportSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Calculate progress for mobile CTA
  const progressPercentage = project.goal_amount
    ? Math.min(((project.raised_amount || 0) / project.goal_amount) * 100, 100)
    : 0;

  return (
    <div className="bg-surface-page min-h-screen">
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

            {/* Cross-sell: owners can run AI agents on this project in
                FleetCrown (sibling product, shared OrangeCat login). */}
            {isOwner && (
              <FleetCrownBuildCta
                variant="card"
                entityType="project"
                entityId={project.id}
                sourcePath={ROUTES.PROJECTS.VIEW(project.id)}
              />
            )}
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
      {!isOwner && sellerReceive && showFloatingCTA && (
        <div
          className={`lg:hidden fixed inset-x-0 oc-above-mobile-nav ${Z_INDEX_CLASSES.MOBILE_ACTION_BAR} bg-surface-base border-t border-default shadow-sm transition-transform duration-300 ${
            showFloatingCTA ? 'translate-y-0' : 'translate-y-full'
          }`}
        >
          <div className="max-w-lg mx-auto px-4 py-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="text-xs text-fg-secondary">
                  Goal: {formatCurrency(project.goal_amount ?? 0, project.currency)}
                </div>
                <div className="text-lg font-bold text-fg-primary truncate">
                  {formatCurrency(project.raised_amount ?? 0, project.currency)}
                </div>
                <div className="h-1.5 bg-surface-raised rounded-full mt-1">
                  <div
                    className="h-1.5 bg-bitcoinOrange rounded-full transition-all duration-300"
                    style={{ width: `${progressPercentage}%` }}
                  />
                </div>
              </div>
              <Button
                onClick={scrollToSupport}
                variant="accent"
                className="flex-shrink-0 px-6 py-3 shadow-sm"
              >
                <Bitcoin className="w-4 h-4 mr-2" aria-hidden="true" />
                Fund
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
