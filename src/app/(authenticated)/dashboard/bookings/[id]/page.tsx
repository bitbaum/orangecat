'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Calendar, Clock, User, ArrowLeft, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';
import { API_ROUTES } from '@/config/api-routes';
import { ROUTES } from '@/config/routes';
import { BADGE_COLORS } from '@/config/badge-colors';
import { STATUS } from '@/config/database-constants';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { logger } from '@/utils/logger';
import { PublicPayPanel } from '@/components/payment/PublicPayPanel';
import type { Booking } from '@/services/bookings';
import { FormattedDate } from '@/components/ui/FormattedDate';

interface ReceiveInfo {
  hasWallet: boolean;
  method: 'nwc' | 'lightning_address' | 'onchain' | null;
  address: string | null;
}

type BookingWithCustomer = Booking & {
  customer?: {
    id: string;
    username: string;
    display_name?: string;
    avatar_url?: string;
  };
  role?: 'provider' | 'customer';
};

const STATUS_COLORS: Record<string, string> = {
  pending: BADGE_COLORS.warning,
  confirmed: BADGE_COLORS.info,
  in_progress: BADGE_COLORS.orange,
  completed: BADGE_COLORS.success,
  cancelled: BADGE_COLORS.neutral,
  rejected: BADGE_COLORS.error,
};

export default function BookingDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { formatAmountBtc } = useDisplayCurrency();
  const [booking, setBooking] = useState<BookingWithCustomer | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isActing, setIsActing] = useState(false);
  // undefined = not fetched yet, null = no payable wallet, object = resolved
  const [receive, setReceive] = useState<ReceiveInfo | null | undefined>(undefined);

  const id = params.id as string;

  const loadBooking = useCallback(async () => {
    try {
      const res = await fetch(API_ROUTES.BOOKINGS.BY_ID(id));
      if (!res.ok) {
        toast.error('Booking not found');
        router.push(ROUTES.DASHBOARD.BOOKINGS);
        return;
      }
      const data = await res.json();
      if (data.success) {
        setBooking(data.data);
      } else {
        toast.error(data.error?.message || 'Failed to load booking');
        router.push(ROUTES.DASHBOARD.BOOKINGS);
      }
    } catch (err) {
      logger.error('Failed to load booking', err, 'BookingDetail');
      toast.error('Failed to load booking');
    } finally {
      setIsLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    void loadBooking();
  }, [loadBooking]);

  // For the customer on a confirmed-but-unpaid booking, fetch where to pay
  // (the provider's public receiving address) so we can show a pay panel.
  useEffect(() => {
    if (!booking) {
      return;
    }
    const payable =
      booking.role === 'customer' &&
      (booking.status === STATUS.BOOKINGS.CONFIRMED ||
        booking.status === STATUS.BOOKINGS.IN_PROGRESS) &&
      booking.price_btc > 0 &&
      (booking.total_paid_btc ?? 0) < booking.price_btc;
    if (!payable) {
      setReceive(null);
      return;
    }
    let cancelled = false;
    fetch(API_ROUTES.BOOKINGS.RECEIVE_INFO(id))
      .then(res => (res.ok ? res.json() : null))
      .then(body => {
        if (!cancelled) {
          setReceive((body?.data as ReceiveInfo) ?? null);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReceive(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [booking, id]);

  const handleAction = async (action: 'confirm' | 'reject' | 'complete' | 'cancel') => {
    setIsActing(true);
    try {
      const res = await fetch(API_ROUTES.BOOKINGS.BY_ID(id), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          action === 'confirm'
            ? 'Booking confirmed!'
            : action === 'reject'
              ? 'Booking rejected'
              : action === 'complete'
                ? 'Booking marked as complete'
                : 'Booking cancelled'
        );
        void loadBooking();
      } else {
        toast.error(data.error?.message || 'Action failed');
      }
    } catch (err) {
      logger.error('Booking action error', err, 'BookingDetail');
      toast.error('Something went wrong');
    } finally {
      setIsActing(false);
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="h-8 w-8 animate-spin text-fg-secondary" />
      </div>
    );
  }

  if (!booking) {
    return null;
  }

  const isProvider = booking.role === 'provider';
  const serviceTitle = (booking.metadata?.service_title as string) || 'Service booking';
  const partyName = booking.customer?.display_name || booking.customer?.username || 'Customer';

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-6">
      <Breadcrumb
        items={[
          { label: 'Bookings', href: ROUTES.DASHBOARD.BOOKINGS },
          { label: 'Booking Details' },
        ]}
        className="mb-4"
      />

      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(ROUTES.DASHBOARD.BOOKINGS)}
          className="gap-2"
        >
          <ArrowLeft className="h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-bold text-fg-primary">{serviceTitle}</h1>
        <span
          className={cn(
            'px-2 py-1 text-xs font-medium rounded-full',
            STATUS_COLORS[booking.status] ?? BADGE_COLORS.neutral
          )}
        >
          {booking.status.replace('_', ' ')}
        </span>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <User className="h-4 w-4" />
            {isProvider ? 'Customer' : 'Provider'}
          </CardTitle>
        </CardHeader>
        <CardContent>
          <p className="font-medium text-fg-primary">{partyName}</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Schedule</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex items-center gap-2 text-sm">
            <Calendar className="h-4 w-4 text-fg-secondary" />
            <span>
              <FormattedDate value={booking.starts_at} />
            </span>
          </div>
          <div className="flex items-center gap-2 text-sm">
            <Clock className="h-4 w-4 text-fg-secondary" />
            <span>
              <FormattedDate value={booking.starts_at} mode="time" /> –{' '}
              <FormattedDate value={booking.ends_at} mode="time" />
              {booking.duration_minutes ? ` (${booking.duration_minutes} min)` : ''}
            </span>
          </div>
          {booking.timezone && <p className="text-xs text-fg-secondary">{booking.timezone}</p>}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Payment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-fg-secondary">Total</span>
            <span className="font-medium">{formatAmountBtc(booking.price_btc)}</span>
          </div>
          {booking.deposit_btc > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Deposit</span>
              <span>
                {formatAmountBtc(booking.deposit_btc)}{' '}
                {booking.deposit_paid ? (
                  <span className="text-status-positive text-xs">(paid)</span>
                ) : (
                  <span className="text-status-warning text-xs">(unpaid)</span>
                )}
              </span>
            </div>
          )}
          {booking.total_paid_btc > 0 && (
            <div className="flex justify-between text-sm">
              <span className="text-fg-secondary">Paid</span>
              <span className="text-status-positive font-medium">
                {formatAmountBtc(booking.total_paid_btc)}
              </span>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Customer pay step — the booking dead-ended here before: confirmed,
          but no way to pay. Reveal the provider's address + exact amount. */}
      {!isProvider &&
        (booking.status === STATUS.BOOKINGS.CONFIRMED ||
          booking.status === STATUS.BOOKINGS.IN_PROGRESS) &&
        booking.price_btc > 0 &&
        (booking.total_paid_btc ?? 0) < booking.price_btc &&
        (receive === undefined ? (
          <Card>
            <CardContent className="pt-6 flex items-center gap-2 text-sm text-fg-secondary">
              <Loader2 className="h-4 w-4 animate-spin" /> Loading payment details…
            </CardContent>
          </Card>
        ) : receive?.address &&
          (receive.method === 'onchain' || receive.method === 'lightning_address') ? (
          <PublicPayPanel
            entityTitle={serviceTitle}
            isContribution={false}
            priceAmount={booking.price_btc}
            priceCurrency="BTC"
            amountBtc={booking.price_btc}
            method={receive.method}
            address={receive.address}
          />
        ) : (
          <Card>
            <CardContent className="pt-6 text-sm text-fg-secondary">
              The provider hasn&apos;t set up a payable Bitcoin address for this booking yet.
            </CardContent>
          </Card>
        ))}

      {(booking.customer_notes || booking.provider_notes || booking.cancellation_reason) && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {booking.customer_notes && (
              <div>
                <p className="text-xs text-fg-secondary mb-1">Customer note</p>
                <p className="text-sm">{booking.customer_notes}</p>
              </div>
            )}
            {booking.provider_notes && (
              <div>
                <p className="text-xs text-fg-secondary mb-1">Provider note</p>
                <p className="text-sm">{booking.provider_notes}</p>
              </div>
            )}
            {booking.cancellation_reason && (
              <div>
                <p className="text-xs text-fg-secondary mb-1">
                  {booking.status === STATUS.BOOKINGS.REJECTED ? 'Rejection' : 'Cancellation'}{' '}
                  reason
                </p>
                <p className="text-sm text-status-negative">{booking.cancellation_reason}</p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {isProvider && (
        <div className="flex gap-3 flex-wrap">
          {booking.status === STATUS.BOOKINGS.PENDING && (
            <>
              <Button onClick={() => handleAction('confirm')} disabled={isActing} className="gap-2">
                {isActing && <Loader2 className="h-4 w-4 animate-spin" />}
                Confirm
              </Button>
              <Button variant="outline" onClick={() => handleAction('reject')} disabled={isActing}>
                Reject
              </Button>
            </>
          )}
          {(booking.status === STATUS.BOOKINGS.CONFIRMED ||
            booking.status === STATUS.BOOKINGS.IN_PROGRESS) && (
            <>
              <Button
                onClick={() => handleAction('complete')}
                disabled={isActing}
                className="gap-2"
              >
                {isActing && <Loader2 className="h-4 w-4 animate-spin" />}
                Mark Complete
              </Button>
              <Button variant="outline" onClick={() => handleAction('cancel')} disabled={isActing}>
                Cancel
              </Button>
            </>
          )}
        </div>
      )}

      {/* Customer can cancel a pending or confirmed booking (had no actions before). */}
      {!isProvider &&
        (booking.status === STATUS.BOOKINGS.PENDING ||
          booking.status === STATUS.BOOKINGS.CONFIRMED) && (
          <div className="flex gap-3 flex-wrap">
            <Button
              variant="outline"
              onClick={() => handleAction('cancel')}
              disabled={isActing}
              className="gap-2"
            >
              {isActing && <Loader2 className="h-4 w-4 animate-spin" />}
              Cancel booking
            </Button>
          </div>
        )}
    </div>
  );
}
