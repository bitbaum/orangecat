'use client';

import { MessageSquare, Plus } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';

/** What /messages shows with no conversation open: what the page is for, and two ways in. */
export function MessagesEmptyPane({ onNewChat }: { onNewChat: () => void }) {
  return (
    <div className="flex flex-col h-full">
      <div className="px-4 pt-2">
        <ConnectionStatusIndicator />
      </div>
      <div className="flex-1 flex items-center justify-center text-fg-secondary bg-surface-raised/30">
        <div className="text-center p-10 max-w-md">
          <div className="mx-auto mb-5 flex h-20 w-20 items-center justify-center rounded-md border border-subtle bg-surface-page">
            <MessageSquare className="w-8 h-8 text-fg-tertiary" />
          </div>
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Your messages</h3>
          <p className="text-sm text-fg-secondary mb-5">
            Private conversations with people on OrangeCat — about a project, a sale, a loan, or
            anything else. Pick one on the left, start a new one, or bring Cat in to help.
          </p>
          {/* Outline, both: the list header's New is this screen's one
              primary, and this button says the same word for the same act. */}
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Button variant="outline" onClick={onNewChat} className="gap-2">
              <Plus className="h-4 w-4" aria-hidden="true" />
              New
            </Button>
            <Button variant="outline" href={ROUTES.DASHBOARD.CAT}>
              Talk to Cat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
