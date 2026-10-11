'use client';

import { useRouter } from 'next/navigation';
import { MessageSquare, Search, Plus, ArrowLeft } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import ConversationList from './ConversationList';
import MessageView from './MessageView';
import { cn } from '@/lib/utils';
import NewConversationModal from './NewConversationModal';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import { APP_NAME } from '@/config/brand';
import { APP_CONTENT_HEIGHT_CLASS } from '@/config/layout-chrome';
import { useRealtimeManager } from '@/hooks/useRealtimeManager';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { useMessagePanelState } from './useMessagePanelState';
import { MessagePanelLoading } from './MessagePanelLoading';

interface MessagePanelProps {
  isOpen: boolean;
  onClose: () => void;
  className?: string;
  initialConversationId?: string;
  fullPage?: boolean;
}

export default function MessagePanel({
  isOpen,
  onClose,
  className = '',
  initialConversationId,
  fullPage = false,
}: MessagePanelProps) {
  const router = useRouter();
  const { user, hydrated, isLoading } = useAuth();
  useRealtimeManager();

  const isAuthReady = hydrated && !isLoading;

  const {
    selectedConversationId,
    searchQuery,
    setSearchQuery,
    showNewModal,
    setShowNewModal,
    activeTab,
    setActiveTab,
    convSelectionMode,
    setConvSelectionMode,
    selectedConvIds,
    bulkDeleteConfirm,
    setBulkDeleteConfirm,
    refreshSignal,
    setRefreshSignal,
    toggleConvSelect,
    clearConvSelection,
    bulkDeleteSelected,
    executeBulkDelete,
    setSelectedConversationId,
  } = useMessagePanelState({ isAuthReady, user, initialConversationId });

  if (!isOpen) {
    return null;
  }

  if (!isAuthReady) {
    return (
      <MessagePanelLoading
        fullPage={fullPage}
        isOpen={isOpen}
        onClose={onClose}
        className={className}
      />
    );
  }

  const content = (
    <div
      className={cn(
        'relative flex h-full flex-col overflow-hidden bg-surface-page md:flex-row',
        fullPage ? 'w-full rounded-none' : 'w-full max-w-5xl rounded-md border border-subtle'
      )}
    >
      {/* Conversations Sidebar */}
      <div
        className={cn(
          'flex flex-col border-r border-subtle bg-surface-raised/30 transition-transform duration-300 ease-in-out',
          selectedConversationId ? 'hidden md:flex md:w-80' : 'flex w-full md:w-80',
          fullPage && 'w-full md:w-[23rem]'
        )}
      >
        <div className="flex items-center justify-between border-b border-subtle bg-surface-page p-4">
          <div className="flex items-center gap-2">
            {!fullPage && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onClose}
                className="-ml-2 min-w-11 px-0"
                aria-label="Back to conversations"
              >
                <ArrowLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-semibold text-fg-primary">Messages</h1>
              <p className="text-xs text-fg-secondary">Reach anyone on {APP_NAME}</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {!convSelectionMode ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConvSelectionMode(true)}
                className="text-fg-secondary"
              >
                Select
              </Button>
            ) : (
              <>
                <span className="text-sm text-fg-secondary">{selectedConvIds.size} selected</span>
                <Button
                  size="sm"
                  className="bg-status-negative hover:bg-status-negative/90 text-fg-inverted"
                  onClick={bulkDeleteSelected}
                  disabled={selectedConvIds.size === 0}
                >
                  Delete
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setConvSelectionMode(false);
                    clearConvSelection();
                  }}
                >
                  Cancel
                </Button>
              </>
            )}
            <Button
              size="sm"
              onClick={() => setShowNewModal(true)}
              className="bg-fg-primary text-fg-inverted hover:bg-fg-primary/90"
            >
              <Plus className="w-4 h-4 mr-1" />
              New
            </Button>
          </div>
        </div>

        <div className="space-y-3 border-b border-subtle bg-surface-page p-4">
          <div className="flex items-center gap-2">
            {(['all', 'requests'] as const).map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={cn(
                  'rounded-md border px-3 py-1.5 text-sm font-medium transition-colors',
                  activeTab === tab
                    ? 'border-strong bg-surface-raised text-fg-primary'
                    : 'border-subtle bg-surface-page text-fg-secondary hover:bg-surface-raised'
                )}
              >
                {tab === 'all' ? 'All' : 'Requests'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-fg-tertiary" />
            <input
              type="text"
              placeholder="Search conversations"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              className="w-full rounded-md border border-subtle bg-surface-page py-3 pl-10 pr-4 text-sm text-fg-primary placeholder:text-fg-tertiary transition-colors focus:border-interactive focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          <ConversationList
            searchQuery={searchQuery}
            selectedConversationId={selectedConversationId}
            filterTab={activeTab}
            selectionMode={convSelectionMode}
            selectedIds={selectedConvIds}
            onToggleSelect={toggleConvSelect}
            onRequestSelectionMode={() => setConvSelectionMode(true)}
            refreshSignal={refreshSignal}
            onStartNew={() => setShowNewModal(true)}
            onSelectConversation={conversationId => {
              if (convSelectionMode) {
                toggleConvSelect(conversationId);
                return;
              }
              setSelectedConversationId(conversationId);
              router.push(ROUTES.MESSAGES_WITH_CONVERSATION(conversationId), { scroll: false });
            }}
          />
        </div>
      </div>

      {/* Message View */}
      <div
        className={cn(
          'flex min-h-0 flex-1 flex-col bg-surface-page transition-opacity duration-200 ease-in-out',
          selectedConversationId ? 'flex w-full' : 'hidden md:flex'
        )}
      >
        {selectedConversationId ? (
          <MessageView
            conversationId={selectedConversationId}
            onBack={(reason?: 'forbidden' | 'not_found' | 'unknown' | 'network') => {
              setSelectedConversationId(null);
              router.push(ROUTES.MESSAGES);
              if (reason === 'forbidden' || reason === 'not_found') {
                setShowNewModal(true);
              }
            }}
          />
        ) : (
          <div className="flex flex-col h-full">
            <div className="px-4 pt-2">
              <ConnectionStatusIndicator />
            </div>
            <div className="flex-1 flex items-center justify-center text-fg-secondary bg-surface-raised/30">
              <div className="text-center p-10 max-w-md">
                <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-md border border-subtle bg-surface-page">
                  <MessageSquare className="w-8 h-8 text-fg-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-fg-primary mb-2">Select a chat</h3>
                <p className="text-sm text-fg-secondary mb-5">
                  Choose from your existing conversations or start a new one.
                </p>
                <Button
                  onClick={() => setShowNewModal(true)}
                  className="bg-fg-primary text-fg-inverted hover:bg-fg-primary/90"
                >
                  <Plus className="w-4 h-4 mr-2" />
                  New chat
                </Button>
              </div>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        isOpen={bulkDeleteConfirm}
        onClose={() => setBulkDeleteConfirm(false)}
        onConfirm={executeBulkDelete}
        title={`Delete ${selectedConvIds.size} conversation${selectedConvIds.size === 1 ? '' : 's'}?`}
        description="This removes them for you. Other participants won't be affected."
        confirmLabel="Delete"
      />

      <NewConversationModal
        isOpen={showNewModal}
        onClose={() => setShowNewModal(false)}
        onCreated={convId => {
          setSelectedConversationId(convId);
          setShowNewModal(false);
          setRefreshSignal(s => s + 1);
          router.push(ROUTES.MESSAGES_WITH_CONVERSATION(convId), { scroll: false });
        }}
      />
    </div>
  );

  if (fullPage) {
    return <div className={cn(APP_CONTENT_HEIGHT_CLASS, className)}>{content}</div>;
  }

  return (
    <Dialog open={isOpen} onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-4xl h-[80vh] max-h-[700px] p-0">
        <DialogTitle className="sr-only">Messages</DialogTitle>
        <div className="w-full h-full">{content}</div>
      </DialogContent>
    </Dialog>
  );
}
