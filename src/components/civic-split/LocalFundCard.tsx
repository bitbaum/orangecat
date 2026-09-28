'use client';

/**
 * The locality share, turned into a destination: the place's local fund when
 * it has one, and the way to start one when it does not. Reads the public
 * fund endpoint for the saved place, so it says nothing until the split is
 * declared — a fund for a place you have not named is nobody's.
 */
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowRight, PiggyBank } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { LOCAL_FUND_COPY } from '@/config/civic-split';
import type { CivicShares } from '@/domain/civic-split/schema';
import { fetchLocalFund, type LocalFundAnswer } from '@/services/civic-split/client';
import { logger } from '@/utils/logger';

interface LocalFundCardProps {
  countryCode: string;
  region: string;
  locality: string;
  shares: CivicShares;
}

export function LocalFundCard({ countryCode, region, locality, shares }: LocalFundCardProps) {
  const [answer, setAnswer] = useState<LocalFundAnswer | null>(null);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setAnswer(null);
    setFailed(false);
    fetchLocalFund({ country_code: countryCode, region, locality })
      .then(a => {
        if (!cancelled) {
          setAnswer(a);
        }
      })
      .catch(error => {
        logger.error('Failed to load local fund', error, 'CivicSplit');
        if (!cancelled) {
          setFailed(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [countryCode, region, locality]);

  if (failed) {
    return null;
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-6">
        <div className="flex items-start gap-3">
          <div className="oc-icon-tile h-10 w-10 shrink-0">
            <PiggyBank className="h-5 w-5 text-fg-secondary" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h2 className="font-heading text-base text-fg-primary">{LOCAL_FUND_COPY.title}</h2>
            <p className="mt-1 text-sm text-fg-secondary">
              {answer === null
                ? LOCAL_FUND_COPY.loading
                : answer.fund
                  ? LOCAL_FUND_COPY.has(answer.fund.name, locality, shares.locality)
                  : LOCAL_FUND_COPY.none(locality)}
            </p>
          </div>
        </div>
        {answer?.fund && (
          <Link
            href={answer.fund.href}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg bg-accent-warm px-4 text-sm font-semibold text-on-accent"
          >
            {LOCAL_FUND_COPY.give}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
        {answer && !answer.fund && answer.start_href && (
          <Link
            href={answer.start_href}
            className="inline-flex min-h-11 items-center gap-1 rounded-lg border border-default bg-surface-base px-4 text-sm font-semibold text-fg-primary hover:border-interactive"
          >
            {LOCAL_FUND_COPY.start}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}

export default LocalFundCard;
