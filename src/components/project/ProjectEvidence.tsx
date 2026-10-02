'use client';

import dynamic from 'next/dynamic';
import { ROUTES } from '@/config/routes';
import type { LokiProjectLink } from '@/services/loki/project-link';

const LokiBuildCta = dynamic(() => import('@/components/integrations/LokiBuildCta'));
const LokiBuildRecordCard = dynamic(() => import('@/components/integrations/LokiBuildRecordCard'));
const OpenLedgerCard = dynamic(() => import('@/components/wallets/OpenLedgerCard'));

/**
 * The two records a reader deciding whether to fund a project can check for
 * themselves: where the money went (the receiving wallet's public ledger) and
 * what was actually built (Loki's build record). Both are shown to EVERYONE,
 * because the reader who needs them most is the one who has not paid yet.
 */
export default function ProjectEvidence({
  projectId,
  isOwner,
  lokiBuild,
  openLedgerWalletId,
}: {
  projectId: string;
  isOwner: boolean;
  lokiBuild?: LokiProjectLink | null;
  openLedgerWalletId?: string | null;
}) {
  return (
    <>
      {openLedgerWalletId && <OpenLedgerCard walletId={openLedgerWalletId} />}

      {/* Two states, never both. A project already building in Loki shows its
          build record; a project that is not shows the owner how to start one.
          Offering to create what someone already has is how a page tells its
          most invested reader it has not been paying attention. */}
      {lokiBuild?.linked && lokiBuild.profileUrl ? (
        <LokiBuildRecordCard profileUrl={lokiBuild.profileUrl} projectName={lokiBuild.name} />
      ) : (
        isOwner && (
          <LokiBuildCta
            variant="card"
            entityType="project"
            entityId={projectId}
            sourcePath={ROUTES.PROJECTS.VIEW(projectId)}
          />
        )
      )}
    </>
  );
}
