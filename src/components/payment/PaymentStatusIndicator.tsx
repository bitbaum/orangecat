/**
 * PaymentStatusIndicator — Animated status badge during polling
 */

'use client';

import { Loader2, CheckCircle2, XCircle, Clock, AlertCircle } from 'lucide-react';
import type { PaymentIntentStatus } from '@/domain/payments/types';

interface PaymentStatusIndicatorProps {
  status: PaymentIntentStatus | 'initiating';
}

const STATUS_CONFIG: Record<
  string,
  { icon: React.ElementType; label: string; color: string; animate?: boolean }
> = {
  initiating: {
    icon: Loader2,
    label: 'Creating payment request…',
    color: 'text-fg-secondary',
    animate: true,
  },
  created: {
    icon: Loader2,
    label: 'Generating invoice...',
    color: 'text-fg-secondary',
    animate: true,
  },
  invoice_ready: {
    icon: Clock,
    label: 'Waiting for payment...',
    color: 'text-status-warning',
    animate: true,
  },
  paid: {
    icon: CheckCircle2,
    label: 'Payment confirmed!',
    color: 'text-status-positive',
  },
  // The payer said "I've paid" — nothing has checked it yet. A green
  // "Payment sent!" here read as a confirmation that had not happened.
  buyer_confirmed: {
    icon: Clock,
    label: 'Waiting for the recipient to confirm',
    color: 'text-fg-secondary',
  },
  expired: {
    icon: XCircle,
    label: 'Payment request expired',
    color: 'text-status-negative',
  },
  failed: {
    icon: AlertCircle,
    label: 'Payment failed',
    color: 'text-status-negative',
  },
};

export function PaymentStatusIndicator({ status }: PaymentStatusIndicatorProps) {
  const config = STATUS_CONFIG[status] || STATUS_CONFIG.created;
  const Icon = config.icon;

  return (
    <div className={`flex items-center gap-2 ${config.color}`}>
      <Icon className={`h-5 w-5 ${config.animate ? 'animate-spin' : ''}`} />
      <span className="text-sm font-medium">{config.label}</span>
    </div>
  );
}
