'use client';

/**
 * ProfileProjectCard — one project as an explore-and-fund card.
 *
 * Shared by the profile Overview's "Projects" section and the Projects tab so
 * a shared profile shows the owner's actual work (not just a count) and lets a
 * visitor jump straight to funding any project. The card body links to the
 * project; a separate "Support" button deep-links to the project's donate
 * panel (#pay) so backing something is one tap from the listing.
 */

import Link from 'next/link';
import Image from 'next/image';
import { Target, Bitcoin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { CurrencyDisplay } from '@/components/ui/CurrencyDisplay';
import { formatBitcoinDisplay } from '@/services/currency/formatting';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';
import { formatRelativeTimeCompact } from '@/utils/dates';
import { getStatusInfo } from '@/config/status-config';
import { PROJECT_STATUS } from '@/config/project-statuses';

/** Normalized shape — callers map their own row type (server Project / tab item) to this. */
export interface ProfileProjectCardData {
  id: string;
  title: string;
  description?: string | null;
  imageUrl?: string | null;
  goalAmount?: number | null;
  /** Legacy fiat "raised" total, used when there's no on-chain balance. */
  raisedAmount?: number;
  /** On-chain balance in BTC, preferred when present. */
  balanceBtc?: number;
  currency?: string;
  category?: string | null;
  status?: string | null;
  hasWallet?: boolean;
  createdAt: string;
}

export default function ProfileProjectCard({ project }: { project: ProfileProjectCardData }) {
  const currency = project.currency || PLATFORM_DEFAULT_CURRENCY;
  const balanceBTC = project.balanceBtc || 0;
  const goalAmount = project.goalAmount || 0;
  const raisedAmount = project.raisedAmount || 0;
  const currentAmount = balanceBTC > 0 ? balanceBTC : raisedAmount;
  const progress = goalAmount > 0 ? Math.min((currentAmount / goalAmount) * 100, 100) : 0;
  const statusInfo = getStatusInfo(project.status || PROJECT_STATUS.ACTIVE, 'project');
  const showStatusBadge =
    project.status &&
    !([PROJECT_STATUS.ACTIVE, PROJECT_STATUS.DRAFT] as string[]).includes(
      project.status.toLowerCase()
    );
  const viewHref = ROUTES.PROJECTS.VIEW(project.id);

  return (
    <div className="overflow-hidden rounded-lg border-2 border-default bg-surface-base transition-all duration-200 hover:border-strong hover:shadow-sm group">
      <Link href={viewHref} className="block">
        <div className="flex flex-col sm:flex-row">
          {/* Thumbnail */}
          <div className="relative h-48 w-full flex-shrink-0 bg-surface-raised sm:h-auto sm:w-32">
            {project.imageUrl ? (
              <Image
                src={project.imageUrl}
                alt={project.title}
                fill
                unoptimized
                className="object-cover transition-transform duration-300 group-hover:scale-105"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center">
                <Target className="h-12 w-12 text-fg-secondary" />
              </div>
            )}
            {project.category && (
              <div className="absolute left-2 top-2">
                <span className="rounded-md bg-surface-base/90 px-2 py-1 text-xs font-medium text-fg-primary backdrop-blur-sm">
                  {project.category}
                </span>
              </div>
            )}
            {showStatusBadge && (
              <div className="absolute right-2 top-2">
                <span
                  className={`rounded-md px-2 py-1 text-xs font-medium ${statusInfo.className}`}
                >
                  {statusInfo.label}
                </span>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="flex flex-1 flex-col p-4 sm:p-5">
            <div className="flex-1">
              <h4 className="mb-1.5 line-clamp-1 text-lg font-bold text-fg-primary">
                {project.title}
              </h4>
              {project.description && (
                <p className="mb-3 line-clamp-2 text-sm text-fg-secondary">{project.description}</p>
              )}
            </div>

            {/* Progress / balance */}
            {goalAmount > 0 ? (
              <div className="space-y-2">
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-secondary">Progress</span>
                  <span className="font-semibold text-fg-primary">{progress.toFixed(1)}%</span>
                </div>
                <div className="h-2 w-full overflow-hidden rounded-full bg-surface-raised">
                  <div
                    className="h-2 rounded-full bg-fg-primary transition-all duration-300"
                    style={{ width: `${progress}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className="text-fg-secondary">
                    <CurrencyDisplay amount={currentAmount} currency={currency} size="sm" />
                  </span>
                  <span className="text-fg-secondary">
                    of <CurrencyDisplay amount={goalAmount} currency={currency} size="sm" />
                  </span>
                </div>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <Bitcoin className="h-4 w-4 text-bitcoinOrange" />
                <span className="text-sm font-semibold text-fg-primary">
                  {balanceBTC > 0 ? (
                    formatBitcoinDisplay(balanceBTC)
                  ) : raisedAmount > 0 ? (
                    <CurrencyDisplay amount={raisedAmount} currency={currency} size="sm" />
                  ) : (
                    'No funds yet'
                  )}
                </span>
              </div>
            )}
          </div>
        </div>
      </Link>

      {/* Footer — meta + a one-tap Support that jumps to the donate panel */}
      <div className="flex items-center justify-between gap-3 border-t border-subtle px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3 text-xs text-fg-secondary">
          <span>{formatRelativeTimeCompact(project.createdAt)}</span>
          {project.hasWallet && (
            <span className="flex items-center gap-1 text-bitcoinOrange">
              <Bitcoin className="h-3 w-3" />
              Wallet
            </span>
          )}
        </div>
        <Button href={`${viewHref}#pay`} size="sm" className="gap-1.5">
          <Bitcoin className="h-4 w-4" />
          Support
        </Button>
      </div>
    </div>
  );
}
