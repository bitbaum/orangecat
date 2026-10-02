/**
 * /governance — the public record of the platform's Solon-governed policies.
 *
 * Shows the version history of the Cat's platform-wide spending leash: what
 * each version says, its content hash (what voters signed over), and the
 * Solon decision that legitimated it. The genesis version is labeled as the
 * bootstrap — its first change requires a Bitcoin-signed Solon vote.
 */
import { Metadata } from 'next';
import Link from 'next/link';
import { createAdminClient } from '@/lib/supabase/admin';
import { ALLOCATION_POLICY_KEY, SOLON_BASE_URL_DEFAULT } from '@/config/solon';
import { DATABASE_TABLES } from '@/config/database-tables';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: 'Governance',
  description:
    "The platform's allocation policies and the Solon decisions that legitimated them — every version, every hash, independently verifiable.",
};

export const dynamic = 'force-dynamic';

interface PolicyVersionRow {
  version: number;
  content: Record<string, number>;
  content_hash: string;
  status: string;
  solon_decision_id: string | null;
  activated_at: string | null;
}

export default async function GovernancePage() {
  const solonBase = process.env.SOLON_BASE_URL || SOLON_BASE_URL_DEFAULT;
  let versions: PolicyVersionRow[] = [];
  let dbError = false;
  try {
    const { data, error } = await createAdminClient()
      .from(DATABASE_TABLES.ALLOCATION_POLICIES)
      .select('version, content, content_hash, status, solon_decision_id, activated_at')
      .eq('policy_key', ALLOCATION_POLICY_KEY)
      .order('version', { ascending: false });
    if (error) {
      dbError = true;
    } else {
      versions = (data ?? []) as unknown as PolicyVersionRow[];
    }
  } catch {
    dbError = true;
  }

  return (
    <div className="bg-surface-page pb-16">
      <div className="bg-surface-base border-b border-subtle">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 text-center">
          <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary">
            Platform Governance
          </h1>
          <p className="mt-3 text-lg text-fg-secondary max-w-2xl mx-auto">
            The Cat&apos;s platform-wide spending limits are set by governance, not by us: changing
            them requires a Bitcoin-signed vote on{' '}
            <a href={solonBase} className="underline" rel="noopener">
              Solon
            </a>
            , and every decision is independently verifiable.
          </p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-4">
        <h2 className="text-xl font-semibold text-fg-primary">
          Allocation policy — version history
        </h2>
        {dbError && (
          <p className="text-fg-secondary">
            The governance record is currently unreachable. No policy can be shown.
          </p>
        )}
        {!dbError && versions.length === 0 && (
          <p className="text-fg-secondary">
            No allocation policy is recorded yet — the genesis version has not been seeded.
          </p>
        )}
        {versions.map(v => (
          <div key={v.version} className="bg-surface-base border border-subtle rounded-lg p-5">
            <div className="flex items-baseline justify-between gap-4">
              <span className="font-semibold text-fg-primary">
                v{v.version}
                <span className="ml-2 text-sm font-normal text-fg-secondary">({v.status})</span>
              </span>
              {v.activated_at && (
                <span className="text-xs text-fg-secondary">
                  activated {v.activated_at.slice(0, 10)}
                </span>
              )}
            </div>
            <dl className="mt-3 space-y-1 text-sm">
              {Object.entries(v.content).map(([key, value]) => (
                <div key={key} className="flex justify-between gap-4">
                  <dt className="text-fg-secondary font-mono">{key}</dt>
                  <dd className="text-fg-primary font-mono">{String(value)}</dd>
                </div>
              ))}
            </dl>
            <div className="mt-3 text-xs text-fg-secondary font-mono break-all">
              content_hash: {v.content_hash}
            </div>
            <div className="mt-2 text-sm">
              {v.solon_decision_id ? (
                <a
                  href={`${solonBase}/api/v1/decisions/${v.solon_decision_id}`}
                  className="underline text-fg-primary"
                  rel="noopener"
                >
                  Solon decision {v.solon_decision_id.slice(0, 8)}… — verify the signed votes
                </a>
              ) : (
                <span className="text-fg-secondary">
                  Bootstrap — seeded at genesis; the first change requires a Solon vote.
                </span>
              )}
            </div>
          </div>
        ))}

        {/* Closing: point readers at the primary sources so "independently
            verifiable" is a link, not just a claim. */}
        <div className="mt-8 border-t border-subtle pt-8">
          <h2 className="text-xl font-semibold text-fg-primary">Verify it yourself</h2>
          <p className="mt-2 text-fg-secondary">
            Don&apos;t take this page&apos;s word for it. Every proposal and how its vote went is
            published on{' '}
            <a href={`${solonBase}/proposals`} className="underline" rel="noopener">
              Solon&apos;s decisions page
            </a>
            , and the live governed state of the whole stack is published at{' '}
            <a href={`${solonBase}/ecosystem`} className="underline" rel="noopener">
              solon.orangecat.ch/ecosystem
            </a>
            .
          </p>
          <p className="mt-3 text-fg-secondary">
            For why the governance layer sits outside the product it governs, see{' '}
            <Link href={ROUTES.ECOSYSTEM} className="underline text-fg-primary">
              the three-pillar stack
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
