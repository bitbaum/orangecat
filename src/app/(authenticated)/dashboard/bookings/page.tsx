'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { Calendar, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import EmptyState from '@/components/ui/EmptyState';
import EntityListShell from '@/components/entity/EntityListShell';
import { logger } from '@/utils/logger';
import { useDisplayCurrency } from '@/hooks/useDisplayCurrency';
import { STATUS } from '@/config/database-constants';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import BookingTabs from './components/BookingTabs';
import BookingCard from './components/BookingCard';
import type { Booking } from '@/services/bookings';
import type { TabType, FilterStatus, TabConfig } from './components/BookingTabs';

export default function BookingsDashboardPage() {
  const router = useRouter();
  const { formatAmountBtc } = useDisplayCurrency();
  const [activeTab, setActiveTab] = useState<TabType>('incoming');
  const selectedTab = useRef(activeTab);
  const requestVersion = useRef(0);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState<FilterStatus>('all');
  const [processingId, setProcessingId] = useState<string | null>(null);

  const loadBookings = useCallback(async () => {
    const version = ++requestVersion.current;
    setIsLoading(true);
    setLoadError(null);
    try {
      let status = '';
      switch (selectedTab.current) {
        case 'incoming':
          status = STATUS.BOOKINGS.PENDING;
          break;
        case 'confirmed':
          status = `${STATUS.BOOKINGS.CONFIRMED},${STATUS.BOOKINGS.IN_PROGRESS}`;
          break;
        case 'history':
          status = `${STATUS.BOOKINGS.COMPLETED},${STATUS.BOOKINGS.CANCELLED},${STATUS.BOOKINGS.REJECTED}`;
          break;
      }

      const response = await fetch(`${API_ROUTES.BOOKINGS.BASE}?role=provider&status=${status}`);
      const data = await response.json();
      if (!response.ok || !data.success) {
        throw new Error(apiErrorMessage(data, 'Failed to load bookings'));
      }
      if (version === requestVersion.current) {
        setBookings(data.data || []);
      }
    } catch (error) {
      if (version !== requestVersion.current) {
        return;
      }
      setLoadError(error instanceof Error ? error.message : 'Failed to load bookings');
      logger.error('Error loading bookings', error, 'Booking');
    } finally {
      if (version === requestVersion.current) {
        setIsLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    selectedTab.current = activeTab;
    loadBookings();
    return () => {
      requestVersion.current += 1;
    };
  }, [activeTab, loadBookings]);

  const handleAction = async (
    bookingId: string,
    action: 'confirm' | 'reject' | 'complete' | 'cancel',
    reason?: string
  ) => {
    setProcessingId(bookingId);
    try {
      const response = await fetch(API_ROUTES.BOOKINGS.BY_ID(bookingId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, reason }),
      });
      const data = await response.json();
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
        loadBookings();
      } else {
        toast.error(data.error?.message || 'Action failed');
      }
    } catch (error) {
      logger.error('Action error', error, 'Booking');
      toast.error('Something went wrong');
    } finally {
      setProcessingId(null);
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab !== 'history' || filterStatus === 'all') {
      return true;
    }
    return booking.status === filterStatus;
  });

  const tabs: TabConfig[] = [
    {
      id: 'incoming',
      label: 'Incoming Requests',
      count: bookings.filter(b => b.status === STATUS.BOOKINGS.PENDING).length,
    },
    {
      id: 'confirmed',
      label: 'Confirmed',
      count: bookings.filter(
        b => b.status === STATUS.BOOKINGS.CONFIRMED || b.status === STATUS.BOOKINGS.IN_PROGRESS
      ).length,
    },
    { id: 'history', label: 'History' },
  ];

  return (
    <EntityListShell
      title="Bookings"
      description="Review and manage booking requests for your services"
    >
      <BookingTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
        filterStatus={filterStatus}
        onFilterChange={setFilterStatus}
      />

      {/* Bookings List */}
      {loadError ? (
        <div role="alert" className="oc-surface p-6 space-y-3">
          <p className="text-status-negative">{loadError}</p>
          <Button variant="outline" onClick={loadBookings}>
            Retry loading bookings
          </Button>
        </div>
      ) : isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-fg-tertiary" />
        </div>
      ) : filteredBookings.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No bookings found"
          description={
            activeTab === 'incoming'
              ? "You don't have any pending booking requests"
              : activeTab === 'confirmed'
                ? "You don't have any confirmed bookings"
                : 'No booking history yet'
          }
        />
      ) : (
        <div className="space-y-4">
          {filteredBookings.map(booking => (
            <BookingCard
              key={booking.id}
              booking={booking}
              processingId={processingId}
              formatBtc={formatAmountBtc}
              onAction={handleAction}
              onViewDetails={id => router.push(ROUTES.DASHBOARD.BOOKINGS_VIEW(id))}
            />
          ))}
        </div>
      )}
    </EntityListShell>
  );
}
