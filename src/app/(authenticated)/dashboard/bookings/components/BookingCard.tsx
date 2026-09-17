'use client';

import { useState } from 'react';
import { Calendar, Clock, User, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { cn } from '@/lib/utils';
import { STATUS } from '@/config/database-constants';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { BADGE_COLORS } from '@/config/badge-colors';
import type { Booking as BookingBase } from '@/services/bookings';
import { FormattedDate } from '@/components/ui/FormattedDate';

type Booking = BookingBase & {
  customer?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
};

interface BookingCardProps {
  booking: Booking;
  processingId: string | null;
  /** BTC-typed display formatter (formatAmountBtc from useDisplayCurrency) */
  formatBtc: (btc: number) => string;
  onAction: (
    bookingId: string,
    action: 'confirm' | 'reject' | 'complete' | 'cancel',
    reason?: string
  ) => void;
  onViewDetails: (bookingId: string) => void;
}

const BOOKING_STATUS_COLORS: Record<string, string> = {
  pending: BADGE_COLORS.warning,
  confirmed: BADGE_COLORS.info,
  in_progress: BADGE_COLORS.orange,
  completed: BADGE_COLORS.success,
  cancelled: BADGE_COLORS.neutral,
  rejected: BADGE_COLORS.error,
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span
      className={cn(
        'px-2 py-1 text-xs font-medium rounded-full',
        BOOKING_STATUS_COLORS[status] ?? BADGE_COLORS.neutral
      )}
    >
      {status.replace('_', ' ')}
    </span>
  );
}

export default function BookingCard({
  booking,
  processingId,
  formatBtc,
  onAction,
  onViewDetails,
}: BookingCardProps) {
  const isProcessing = processingId === booking.id;
  const [reasonDialog, setReasonDialog] = useState<{
    action: 'reject' | 'cancel';
    reason: string;
  } | null>(null);

  return (
    <div className="bg-surface-base border border-default rounded-lg p-6">
      <div className="flex items-start justify-between">
        <div className="flex-1">
          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-full bg-surface-raised flex items-center justify-center">
              <User className="h-5 w-5 text-fg-secondary" />
            </div>
            <div>
              <p className="font-medium text-fg-primary">
                {booking.customer?.display_name || booking.customer?.username || 'Customer'}
              </p>
              <p className="text-base text-fg-secondary">
                {(booking.metadata?.service_title as string) || 'Service booking'}
              </p>
            </div>
            <StatusBadge status={booking.status} />
          </div>

          {/* Details */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="flex items-center gap-2 text-sm">
              <Calendar className="h-4 w-4 text-fg-tertiary" />
              <span className="text-fg-secondary">
                <FormattedDate value={booking.starts_at} />
              </span>
            </div>
            <div className="flex items-center gap-2 text-sm">
              <Clock className="h-4 w-4 text-fg-tertiary" />
              <span className="text-fg-secondary">
                <FormattedDate value={booking.starts_at} mode="time" /> -{' '}
                <FormattedDate value={booking.ends_at} mode="time" />
              </span>
            </div>
            <div className="text-sm font-medium text-fg-primary">
              {formatBtc(booking.price_btc)}
            </div>
          </div>

          {/* Customer Notes */}
          {booking.customer_notes && (
            <div className="bg-surface-raised rounded-md p-3 mb-4">
              <p className="text-xs font-medium text-fg-secondary mb-1">Customer notes:</p>
              <p className="text-base text-fg-primary">{booking.customer_notes}</p>
            </div>
          )}

          {/* Rejection/Cancellation Reason */}
          {booking.cancellation_reason && (
            <div className="oc-error-surface mb-4 p-3">
              <p className="text-xs font-medium mb-1">
                {booking.status === STATUS.BOOKINGS.REJECTED ? 'Rejection' : 'Cancellation'} reason:
              </p>
              <p className="text-base text-status-negative/80">{booking.cancellation_reason}</p>
            </div>
          )}
        </div>

        {/* Actions */}
        <div className="ml-4 flex flex-col gap-2">
          {booking.status === STATUS.BOOKINGS.PENDING && (
            <>
              <Button
                size="sm"
                onClick={() => onAction(booking.id, 'confirm')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Confirm
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog({ action: 'reject', reason: '' })}
                disabled={isProcessing}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Reject
              </Button>
            </>
          )}

          {(booking.status === STATUS.BOOKINGS.CONFIRMED ||
            booking.status === STATUS.BOOKINGS.IN_PROGRESS) && (
            <>
              <Button
                size="sm"
                onClick={() => onAction(booking.id, 'complete')}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <>
                    <CheckCircle className="h-4 w-4 mr-1" />
                    Complete
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setReasonDialog({ action: 'cancel', reason: '' })}
                disabled={isProcessing}
              >
                <XCircle className="h-4 w-4 mr-1" />
                Cancel
              </Button>
            </>
          )}

          {(booking.status === STATUS.BOOKINGS.COMPLETED ||
            booking.status === STATUS.BOOKINGS.CANCELLED ||
            booking.status === STATUS.BOOKINGS.REJECTED) && (
            <span className="text-sm text-fg-secondary">
              {booking.status === STATUS.BOOKINGS.COMPLETED && (
                <span className="flex items-center gap-1 text-status-positive">
                  <CheckCircle className="h-4 w-4" />
                  Completed
                </span>
              )}
              {booking.status === STATUS.BOOKINGS.CANCELLED && (
                <span className="flex items-center gap-1 text-fg-secondary">
                  <AlertCircle className="h-4 w-4" />
                  Cancelled
                </span>
              )}
              {booking.status === STATUS.BOOKINGS.REJECTED && (
                <span className="flex items-center gap-1 text-status-negative">
                  <XCircle className="h-4 w-4" />
                  Rejected
                </span>
              )}
            </span>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-subtle flex items-center justify-between text-xs text-fg-secondary">
        <span>
          Requested{' '}
          {new Date(booking.created_at).toLocaleDateString([], {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })}
        </span>
        <button
          onClick={() => onViewDetails(booking.id)}
          className="text-fg-primary hover:text-fg-primary"
        >
          View details &rarr;
        </button>
      </div>
      <Dialog open={!!reasonDialog} onOpenChange={open => !open && setReasonDialog(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>
              {reasonDialog?.action === 'reject' ? 'Reject booking' : 'Cancel booking'}
            </DialogTitle>
          </DialogHeader>
          <textarea
            className="w-full px-3 py-2 border border-strong rounded-lg resize-none text-sm bg-surface-page text-fg-primary focus:ring-2 focus:ring-ring focus:border-interactive"
            rows={3}
            placeholder="Reason (optional)"
            value={reasonDialog?.reason ?? ''}
            onChange={e =>
              setReasonDialog(prev => (prev ? { ...prev, reason: e.target.value } : null))
            }
          />
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setReasonDialog(null)}>
              Back
            </Button>
            <Button
              onClick={() => {
                if (reasonDialog) {
                  onAction(booking.id, reasonDialog.action, reasonDialog.reason || undefined);
                  setReasonDialog(null);
                }
              }}
              variant="danger"
            >
              {reasonDialog?.action === 'reject' ? 'Reject' : 'Cancel booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export type { Booking };
