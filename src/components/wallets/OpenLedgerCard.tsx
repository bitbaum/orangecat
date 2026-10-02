import Link from 'next/link';
import { ArrowRight, BookOpenCheck } from 'lucide-react';
import { ROUTES } from '@/config/routes';

/**
 * "This fund accounts for itself — here is the ledger."
 *
 * Shown on a fundraising entity's page when its receiving wallet publishes its
 * ledger (services/wallets/entityOpenLedger.ts decides when). Same reader as
 * LokiBuildRecordCard: someone deciding whether to put money in. That card
 * points at what was built; this one at where the money went, with the
 * owner's own note on each transaction.
 *
 * It states no score of its own. The transparency score is computed on the
 * ledger page from what the chain shows, beside its components; a number
 * repeated here without them would be a bare grade.
 */
export default function OpenLedgerCard({ walletId }: { walletId: string }) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-base p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-subtle bg-surface-page p-2">
          <BookOpenCheck className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg-primary">This fund publishes its ledger</h3>
          <p className="mt-1 text-sm text-fg-secondary">
            Every transaction its wallet received or sent, read from the chain, with the
            owner&apos;s note on what each one was for.
          </p>
        </div>
      </div>
      <Link
        href={ROUTES.WALLETS.VIEW(walletId)}
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-subtle px-3 py-2 text-sm font-medium text-fg-primary transition-colors hover:border-strong hover:bg-surface-raised/40"
      >
        See where the money went
        <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </Link>
    </div>
  );
}
