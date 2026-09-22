import { ArrowUpRight, Bot } from 'lucide-react';

/**
 * "This project is being built in Loki — here is the record."
 *
 * The other half of LokiBuildCta, and the half that was missing. That card
 * sells the idea of building here; this one states a fact about a project that
 * already is, and it is shown to EVERYONE rather than only to the owner.
 *
 * Who it is really for: someone deciding whether to put money into this. A
 * funding page is a set of promises, and the one thing that turns promises
 * into evidence is a dated account of what has actually been built. That
 * account exists — purpose, roadmap, changelog, what moved last — and until
 * now nothing on this page pointed at it.
 *
 * The owner gets this INSTEAD of the build cross-sell, not as well as it:
 * offering to create what someone already has is how a page tells its most
 * invested reader that it has not been paying attention.
 */
export default function LokiBuildRecordCard({
  profileUrl,
  projectName,
}: {
  profileUrl: string;
  projectName?: string | null;
}) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-base p-4">
      <div className="flex items-start gap-3">
        <div className="rounded-md border border-subtle bg-surface-page p-2">
          <Bot className="h-5 w-5 text-accent-warm" aria-hidden="true" />
        </div>
        <div className="min-w-0">
          <h3 className="text-sm font-medium text-fg-primary">Built in public with Loki</h3>
          <p className="mt-1 text-sm text-fg-secondary">
            Purpose, roadmap and a dated changelog of what has actually shipped
            {projectName ? ` on ${projectName}` : ''} — kept by the agents doing the work, not
            written for this page.
          </p>
        </div>
      </div>
      <a
        href={profileUrl}
        target="_blank"
        rel="noreferrer"
        className="mt-3 inline-flex min-h-11 w-full items-center justify-center rounded-md border border-subtle px-3 py-2 text-sm font-medium text-fg-primary transition-colors hover:border-strong hover:bg-surface-raised/40"
      >
        See the build record
        <ArrowUpRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
      </a>
    </div>
  );
}
