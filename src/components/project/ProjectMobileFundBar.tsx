'use client';

/**
 * The phone's floating "Fund" bar on a project page: appears once the reader
 * has scrolled past the header, sits above the bottom nav, and takes them to
 * the page's one payment section (#pay).
 */

import { useEffect, useState } from 'react';
import { Bitcoin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { Z_INDEX_CLASSES } from '@/constants/z-index';
import { formatCurrency } from '@/services/currency';
import { useMobileActionBar } from '@/hooks/useMobileActionBar';

interface FundBarProject {
  goal_amount?: number | null;
  raised_amount?: number | null;
  currency: string;
}

/**
 * Whether the bar shows: `eligible` (someone else's project that can be paid)
 * and scrolled past 300px. While it shows, the page is marked as carrying a
 * mobile action bar, so the floating Cat button rises above it.
 */
export function useMobileFundBar(eligible: boolean): boolean {
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 300);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);
  const visible = eligible && scrolled;
  useMobileActionBar(visible);
  return visible;
}

export function ProjectMobileFundBar({ project }: { project: FundBarProject }) {
  const progressPercentage = project.goal_amount
    ? Math.min(((project.raised_amount || 0) / project.goal_amount) * 100, 100)
    : 0;

  // The payment section. This used to target #bitcoin-support-section, which
  // only existed on projects with a legacy address — on every other project
  // the button did nothing.
  const scrollToSupport = () => {
    document.getElementById('pay')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div
      className={`lg:hidden fixed inset-x-0 oc-above-mobile-nav ${Z_INDEX_CLASSES.MOBILE_ACTION_BAR} bg-surface-base border-t border-default shadow-sm`}
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
  );
}
