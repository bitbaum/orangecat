'use client';

/**
 * Receive, Send, and Request — one money surface, three routes.
 *
 * They share one sidebar entry and switch here. Receive is "anyone can pay
 * me". Send is "I pay". Request is "I ask one OrangeCat account".
 */

import { usePathname } from 'next/navigation';
import { ArrowDownLeft, ArrowUpRight, HandCoins } from 'lucide-react';
import { SegmentedControl, type SegmentedItem } from '@/components/ui/SegmentedControl';
import { ROUTES } from '@/config/routes';

const TABS: readonly SegmentedItem<string>[] = [
  { value: ROUTES.RECEIVE, href: ROUTES.RECEIVE, label: 'Receive', icon: ArrowDownLeft },
  { value: ROUTES.SEND, href: ROUTES.SEND, label: 'Send', icon: ArrowUpRight },
  { value: ROUTES.REQUESTS, href: ROUTES.REQUESTS, label: 'Request', icon: HandCoins },
];

export function MoneyTabs({ className }: { className?: string }) {
  const pathname = usePathname();

  return (
    <SegmentedControl className={className} label="Money" items={TABS} value={pathname ?? ''} />
  );
}
