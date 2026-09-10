'use client';

/**
 * Domain availability search for /domains.
 *
 * A thin client over /api/v1/domains — deliberately thin, because FleetCrown
 * calls that same endpoint and any rule implemented here instead of there
 * would apply to one of the two products and not the other. In particular the
 * "a .ch not-found proves nothing" rule is server-side; this component only
 * renders what it is told.
 */

import React, { useCallback, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, Loader2, Search } from 'lucide-react';
import Button from '@/components/ui/Button';
import { DOMAIN_STATUS_COPY, type DomainStatus } from '@/config/domain-search';
import {
  canOfferPurchase,
  primaryRegistrar,
  purchaseUrl,
  REGISTRARS,
} from '@/config/domain-purchase';
import { freeSubdomainHost, WEBSITE_BUILD_SERVICE_URL } from '@/config/domains-offer';

interface DomainResult {
  domain: string;
  status: DomainStatus;
  reason: string;
  rdapSupported: boolean;
}

const STATUS_CLASS: Record<DomainStatus, string> = {
  unregistered: 'bg-status-positive-subtle text-status-positive',
  registered: 'bg-surface-raised text-fg-tertiary',
  unknown: 'bg-status-warning-subtle text-status-warning',
};

/** Free names first — they are the answer. Then unresolved, then taken. */
const STATUS_ORDER: Record<DomainStatus, number> = { unregistered: 0, unknown: 1, registered: 2 };

export function DomainSearch() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<DomainResult[] | null>(null);
  // The label the free address is built from. Comes from the SERVER (see the
  // `seed` field in /api/v1/domains) rather than being re-derived here — the
  // reducer reaches server-only code, and two copies of a normalisation rule
  // is how `Causius Legal` becomes one host in the search and another at setup.
  const [seed, setSeed] = useState('');
  const [disclaimer, setDisclaimer] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const search = useCallback(
    async (event: React.FormEvent) => {
      event.preventDefault();
      const trimmed = query.trim();
      if (trimmed.length < 2) {
        setError('Type at least two characters.');
        return;
      }

      setIsSearching(true);
      setError(null);
      try {
        const response = await fetch(`/api/v1/domains?q=${encodeURIComponent(trimmed)}`);
        const body = await response.json();
        if (!response.ok) {
          setError(body?.error?.message ?? 'Search failed. Try again in a moment.');
          setResults(null);
          return;
        }
        const payload = body.data ?? body;
        setResults(
          [...(payload.results ?? [])].sort(
            (a: DomainResult, b: DomainResult) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status]
          )
        );
        setSeed(payload.seed ?? '');
        setDisclaimer(payload.disclaimer ?? '');
      } catch {
        setError('Could not reach the registry lookup. Try again in a moment.');
        setResults(null);
      } finally {
        setIsSearching(false);
      }
    },
    [query]
  );

  return (
    <div className="mx-auto max-w-3xl">
      <form onSubmit={search} className="flex flex-col gap-3 sm:flex-row">
        <label htmlFor="domain-query" className="sr-only">
          Name to check
        </label>
        <input
          id="domain-query"
          type="text"
          value={query}
          onChange={event => setQuery(event.target.value)}
          placeholder="yourname"
          autoComplete="off"
          className="min-h-11 flex-1 rounded-lg border border-subtle bg-surface-base px-4 py-2.5 text-fg-primary placeholder:text-fg-muted focus-visible:border-interactive focus-visible:outline-none"
        />
        <Button type="submit" variant="accent" disabled={isSearching} className="min-h-11">
          {isSearching ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          {isSearching ? 'Checking registries' : 'Check availability'}
        </Button>
      </form>

      {error && <p className="mt-3 text-sm text-status-negative">{error}</p>}

      {results && results.length === 0 && (
        <p className="mt-6 text-sm text-fg-secondary">
          Nothing to check — that query has no usable domain label.
        </p>
      )}

      {results && results.length > 0 && (
        <div className="mt-6">
          <ul className="divide-y divide-subtle overflow-hidden rounded-lg border border-subtle bg-surface-base">
            {results.map(result => (
              <li
                key={result.domain}
                className="flex flex-col gap-1 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4"
              >
                <span className="font-mono text-sm text-fg-primary">{result.domain}</span>
                <span className="flex items-center gap-3">
                  <span className="text-xs text-fg-muted sm:max-w-md sm:text-right">
                    {result.reason}
                  </span>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${STATUS_CLASS[result.status]}`}
                  >
                    {DOMAIN_STATUS_COPY[result.status].label}
                  </span>
                  {/* Only on `unregistered`. An `unknown` result concluded
                      nothing, and a Register button there would turn a
                      non-answer into an invitation. */}
                  {canOfferPurchase(result.status) && (
                    <a
                      href={purchaseUrl(primaryRegistrar(), result.domain)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex min-h-11 shrink-0 items-center gap-1 rounded-lg border border-interactive px-3 text-xs font-medium text-fg-primary hover:bg-surface-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-interactive"
                    >
                      Register
                      <ArrowUpRight className="h-3.5 w-3.5" aria-hidden="true" />
                      <span className="sr-only">
                        {result.domain} at {primaryRegistrar().name} (opens in a new tab)
                      </span>
                    </a>
                  )}
                </span>
              </li>
            ))}
          </ul>
          {disclaimer && <p className="mt-3 text-xs leading-relaxed text-fg-muted">{disclaimer}</p>}
          <p className="mt-2 text-xs leading-relaxed text-fg-muted">
            Registration happens at {REGISTRARS.map(r => r.name).join(' or ')} — they become your
            registrar and your counterparty for the domain. OrangeCat is not a registrar, takes no
            commission on this, and never sees your payment.
          </p>

          {/* The default, and deliberately AFTER the results: someone who just
              learned their name is free should see how to take it first. This is
              the answer for everyone else — the reason "I have not bought a
              domain yet" stops being a reason not to start. */}
          {freeSubdomainHost(seed) && (
            <div className="mt-6 rounded-xl border border-interactive bg-surface-raised p-5">
              <h3 className="text-base font-semibold text-fg-primary">
                Or start today without buying anything
              </h3>
              <p className="mt-2 text-sm text-fg-secondary">
                Your site can go live at{' '}
                <span className="font-mono text-fg-primary">{freeSubdomainHost(seed)}</span> — a
                real, working address, free, with certificates and monitoring. Buy a domain whenever
                you are ready and it moves across; the old address keeps redirecting, so nothing you
                have shared breaks.
              </p>
              <div className="mt-4">
                <Link href={WEBSITE_BUILD_SERVICE_URL}>
                  <Button variant="accent" className="min-h-11">
                    Start at {freeSubdomainHost(seed)}
                  </Button>
                </Link>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
