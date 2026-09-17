'use client';

/**
 * Entity Creation Success Component
 *
 * Shown after successful entity creation. Offers the user a clear choice:
 * publish the entity immediately, or keep it as a draft.
 *
 * Created: 2026-03-28
 */

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { CheckCircle2, Rocket, FileText } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { SellerWalletBanner } from '@/components/payment/SellerWalletBanner';
import { logger } from '@/utils/logger';
import { entityEvents } from '@/lib/analytics';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_STATUS } from '@/config/database-constants';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { useAuth } from '@/hooks/useAuth';
import { useSellerPaymentMethods } from '@/hooks/useSellerPaymentMethods';
import { apiErrorMessage } from '@/lib/api/errorMessage';

interface EntityCreationSuccessProps {
  /** Entity type identifier (e.g. 'product', 'service') */
  entityType: string;
  /** ID of the newly created entity */
  entityId: string;
  /** Title of the newly created entity */
  entityTitle: string;
  /** Display name of the entity type (e.g. 'Product', 'Service') */
  entityTypeName: string;
  /** URL to redirect to after action (dashboard list page) */
  dashboardUrl: string;
  /** URL to the entity detail page (optional) */
  detailUrl?: string;
}

export function EntityCreationSuccess({
  entityType,
  entityId,
  entityTitle,
  entityTypeName,
  dashboardUrl,
  detailUrl,
}: EntityCreationSuccessProps) {
  const router = useRouter();
  const [isPublishing, setIsPublishing] = useState(false);

  // Soft-nudge (C-2): if this entity type receives payments and the owner has no
  // connected wallet, publishing produces a live-but-unpayable entity and they're
  // never told. Prompt them to connect one — without blocking publish. Skips
  // entity types that don't take payments (group/circle/asset/loan/document).
  const { user } = useAuth();
  const receivesPayments =
    !!ENTITY_REGISTRY[entityType as EntityType]?.paymentPattern &&
    ENTITY_REGISTRY[entityType as EntityType]?.paymentPattern !== 'none';
  const { hasWallet } = useSellerPaymentMethods(receivesPayments ? (user?.id ?? null) : null);

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      const response = await fetch(API_ROUTES.ENTITIES.STATUS(entityType, entityId), {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ status: ENTITY_STATUS.ACTIVE }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(apiErrorMessage(errorData, 'Failed to publish'));
      }

      entityEvents.published(entityType, entityId);
      toast.success(`${entityTypeName} published!`, {
        description: `"${entityTitle}" is now live and visible to others.`,
        duration: 4000,
      });

      // Navigate to detail page if available, otherwise dashboard
      router.push(detailUrl || dashboardUrl);
    } catch (error) {
      logger.error(
        'Failed to publish entity',
        { error, entityType, entityId },
        'EntityCreationSuccess'
      );
      toast.error('Failed to publish. You can publish later from your dashboard.');
      setIsPublishing(false);
    }
  };

  const handleKeepDraft = () => {
    router.push(dashboardUrl);
  };

  return (
    <div className="flex items-center justify-center min-h-[60vh] p-4">
      <Card className="max-w-md w-full">
        <CardContent className="pt-8 pb-6 px-6 text-center space-y-6">
          {/* Success icon */}
          <div className="flex justify-center">
            <div className="h-16 w-16 rounded-full bg-status-positive-subtle flex items-center justify-center">
              <CheckCircle2 className="h-8 w-8 text-status-positive" />
            </div>
          </div>

          {/* Success message */}
          <div className="space-y-2">
            <h2 className="text-xl font-semibold text-fg-primary">{entityTypeName} created!</h2>
            <p className="text-sm text-fg-secondary">
              &ldquo;{entityTitle}&rdquo; is saved as a <span className="font-medium">draft</span>.
              It&apos;s not visible to anyone yet.
            </p>
          </div>

          {/* Soft-nudge: connect a wallet so the entity is actually payable.
              Self-gates — renders nothing when the owner already has a wallet. */}
          {receivesPayments && (
            <div className="text-left">
              <SellerWalletBanner isOwner hasWallet={hasWallet} />
            </div>
          )}

          {/* Actions */}
          <div className="space-y-3">
            <Button
              onClick={handlePublish}
              disabled={isPublishing}
              className="w-full bg-status-positive hover:bg-status-positive/90 text-white"
            >
              <Rocket className="mr-2 h-4 w-4" />
              {isPublishing ? 'Publishing...' : 'Publish Now'}
            </Button>
            <Button
              onClick={handleKeepDraft}
              variant="outline"
              disabled={isPublishing}
              className="w-full"
            >
              <FileText className="mr-2 h-4 w-4" />
              Keep as Draft
            </Button>
          </div>

          {/* Hint */}
          <p className="text-xs text-fg-tertiary">
            You can always publish or unpublish from your dashboard.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
