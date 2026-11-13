'use client';

import type { RefObject } from 'react';
import { Bell, Check, MessageSquare, Trash2, AlertCircle } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import MessagePanel from '@/components/messaging/MessagePanel';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { useNotificationCenter, type UIFilter } from './useNotificationCenter';
import { NotificationItem } from './NotificationItem';

interface NotificationCenterProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  /**
   * The control that opened it. It is opened from header state, not from a
   * Dialog.Trigger, so without this Radix returns focus nowhere on close.
   */
  returnFocusRef?: RefObject<HTMLElement | null>;
}

const FILTER_TABS: { value: UIFilter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'unread', label: 'Unread' },
  { value: 'payments', label: 'Payments' },
  { value: 'social', label: 'Social' },
  { value: 'messages', label: 'Messages' },
];

export default function NotificationCenter({
  isOpen,
  onClose,
  className = '',
  returnFocusRef,
}: NotificationCenterProps) {
  const {
    notifications,
    unreadCount,
    isLoading,
    error,
    hasMore,
    loadMore,
    refresh,
    uiFilter,
    setUIFilter,
    showMessages,
    setShowMessages,
    handleMarkAsRead,
    handleMarkAllAsRead,
    handleDeleteNotification,
    handleClearRead,
    handleNotificationClick,
    handleAskCat,
  } = useNotificationCenter({ onClose });
  const loadFailed = Boolean(error) && !isLoading && notifications.length === 0;

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent
        className={`max-w-md max-h-[80vh] flex flex-col p-0 ${className}`}
        onCloseAutoFocus={event => {
          if (returnFocusRef?.current) {
            event.preventDefault();
            returnFocusRef.current.focus();
          }
        }}
      >
        <DialogTitle className="sr-only">Notifications</DialogTitle>
        <Card className="w-full max-h-[80vh] flex flex-col border-0 shadow-none">
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="flex items-center gap-2">
              <Bell className="w-5 h-5" />
              Notifications
              {unreadCount > 0 && (
                <span className="flex h-5 w-5 items-center justify-center rounded-sm bg-status-negative text-xs text-fg-inverted">
                  {unreadCount}
                </span>
              )}
            </CardTitle>
          </CardHeader>

          <CardContent className="flex flex-col flex-1 overflow-hidden">
            {/* Nothing loaded and the load failed: one state, one way forward.
                It used to draw the error above the filter row AND "No
                notifications found" below it, which read as both. */}
            {loadFailed ? (
              <div className="flex flex-col items-center gap-4 py-8 text-center" role="alert">
                <AlertCircle className="h-8 w-8 text-fg-secondary" aria-hidden />
                <p className="mb-0 text-sm text-fg-primary">Could not load your notifications.</p>
                <Button variant="outline" onClick={refresh}>
                  Try again
                </Button>
              </div>
            ) : null}

            {error && !loadFailed && (
              <div className="mb-4 flex items-center gap-2 rounded-md border border-status-negative/20 bg-status-negative/10 p-3 text-status-negative">
                <AlertCircle className="w-4 h-4" aria-hidden />
                <span className="text-sm">Could not refresh your notifications.</span>
                <Button variant="ghost" size="sm" onClick={refresh} className="ml-auto">
                  Try again
                </Button>
              </div>
            )}

            {/* The shared control, in one line that scrolls sideways when five
                labels do not fit (a phone): never a wrapped second row. */}
            {!loadFailed && (
              <div className="-mx-1 mb-4 overflow-x-auto px-1">
                <SegmentedControl
                  label="Show"
                  items={FILTER_TABS}
                  value={uiFilter}
                  onChange={setUIFilter}
                  className="min-w-max"
                />
              </div>
            )}

            {!loadFailed && unreadCount > 0 && (
              <div className="flex justify-between items-center mb-4">
                <span className="text-sm text-fg-secondary">
                  {unreadCount} unread notification{unreadCount !== 1 ? 's' : ''}
                </span>
                <Button variant="ghost" size="sm" onClick={handleMarkAllAsRead}>
                  <Check className="w-4 h-4 mr-1" />
                  Mark all read
                </Button>
              </div>
            )}

            {!loadFailed && (
              <div className="flex-1 overflow-y-auto space-y-2">
                {isLoading && notifications.length === 0 ? (
                  <div className="space-y-3">
                    {[...Array(3)].map((_, i) => (
                      <div key={i} className="animate-pulse">
                        <div className="flex items-start gap-3 rounded-md bg-surface-raised p-3">
                          <div className="h-8 w-8 rounded-md bg-fg-secondary/20" />
                          <div className="flex-1">
                            <div className="mb-2 h-4 rounded bg-fg-secondary/20" />
                            <div className="h-3 w-3/4 rounded bg-fg-secondary/20" />
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : notifications.length === 0 ? (
                  <div className="text-center py-8 text-fg-secondary">
                    <Bell className="w-8 h-8 mx-auto mb-2 opacity-50" />
                    <p className="mb-0">No notifications found</p>
                    {uiFilter !== 'all' && (
                      <button
                        onClick={() => setUIFilter('all')}
                        className="text-fg-primary text-sm mt-2 hover:underline"
                      >
                        View all notifications
                      </button>
                    )}
                  </div>
                ) : (
                  <>
                    {notifications.map(notification => (
                      <NotificationItem
                        key={notification.id}
                        notification={notification}
                        onMarkAsRead={handleMarkAsRead}
                        onDelete={handleDeleteNotification}
                        onClick={handleNotificationClick}
                        onAskCat={handleAskCat}
                      />
                    ))}
                    {hasMore && (
                      <div className="pt-2 text-center">
                        <Button variant="ghost" size="sm" onClick={loadMore} disabled={isLoading}>
                          {isLoading ? 'Loading...' : 'Load more'}
                        </Button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {notifications.length > 0 && (
              <div className="pt-4 mt-4 border-t border-default">
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => {
                      setShowMessages(true);
                      onClose();
                    }}
                  >
                    <MessageSquare className="w-4 h-4 mr-2" />
                    Messages
                  </Button>
                  <Button variant="outline" size="sm" className="flex-1" onClick={handleClearRead}>
                    <Trash2 className="w-4 h-4 mr-2" />
                    Clear Read
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        <MessagePanel isOpen={showMessages} onClose={() => setShowMessages(false)} />
      </DialogContent>
    </Dialog>
  );
}
