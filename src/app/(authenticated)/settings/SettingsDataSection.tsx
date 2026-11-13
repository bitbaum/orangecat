'use client';

/**
 * SettingsDataSection — "Your data" controls on the account settings page.
 *
 * - Export my data: downloads everything the platform stores about the user as
 *   JSON (GDPR / Swiss-DSG right of access; served by /api/account/export).
 * - Delete all Cat conversations: bulk clear of chat history, with an inline
 *   two-step confirm (same UX as CatMemoryManager's "Forget everything").
 */

import { useCallback, useState } from 'react';
import { Download, Loader2, MessageSquareX } from 'lucide-react';
import { toast } from 'sonner';
import Button from '@/components/ui/Button';
import { logger } from '@/utils/logger';
import { API_ROUTES, ACCOUNT_EXPORT_FILENAME } from '@/config/api-routes';

export function SettingsDataSection() {
  const [isExporting, setIsExporting] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);
  const [isClearing, setIsClearing] = useState(false);

  const handleExport = useCallback(async () => {
    setIsExporting(true);
    try {
      const res = await fetch(API_ROUTES.ACCOUNT_EXPORT);
      if (!res.ok) {
        throw new Error(`export failed (${res.status})`);
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = ACCOUNT_EXPORT_FILENAME;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      toast.success('Your data export has been downloaded');
    } catch (err) {
      logger.error('Account export failed', err, 'Settings');
      toast.error('Could not export your data. Try again.');
    } finally {
      setIsExporting(false);
    }
  }, []);

  const handleClearConversations = useCallback(async () => {
    setIsClearing(true);
    try {
      const res = await fetch(`${API_ROUTES.CAT.CONVERSATIONS}?all=true`, { method: 'DELETE' });
      if (!res.ok) {
        throw new Error(`delete failed (${res.status})`);
      }
      setConfirmClear(false);
      toast.success('All Cat conversations deleted');
    } catch (err) {
      logger.error('Delete-all conversations failed', err, 'Settings');
      toast.error('Could not delete conversations. Try again.');
    } finally {
      setIsClearing(false);
    }
  }, []);

  return (
    <div>
      <p className="mb-6 max-w-prose text-fg-secondary">
        OrangeCat never uses your data to train AI models. When Cat calls an AI provider, that
        provider&apos;s own data policy applies — with your own key it&apos;s your provider
        agreement; on the free pool, prompts may be logged by the model host. Your data here exists
        to serve you, and you can take it or delete it anytime.
      </p>

      <div className="space-y-4">
        <div className="rounded-md border border-default bg-surface-raised/30 p-6">
          <h4 className="mb-2 text-lg font-medium text-fg-primary">Export my data</h4>
          <p className="mb-4 text-base text-fg-secondary">
            Download a JSON file with the data we store about you — profile, Cat conversations and
            memories, credit history, and preferences. It&apos;s your data; take it anywhere.
          </p>
          <Button
            type="button"
            variant="outline"
            onClick={handleExport}
            disabled={isExporting}
            className="min-h-11"
          >
            {isExporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Preparing…
              </>
            ) : (
              <>
                <Download className="mr-2 h-4 w-4" /> Export my data
              </>
            )}
          </Button>
        </div>

        <div className="rounded-md border border-default bg-surface-raised/30 p-6">
          <h4 className="mb-2 text-lg font-medium text-fg-primary">Delete all Cat conversations</h4>
          <p className="mb-4 text-base text-fg-secondary">
            Permanently delete your entire Cat chat history. Memories Cat has saved are managed
            under Memory. This cannot be undone.
          </p>
          {confirmClear ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="mr-2 text-sm text-fg-primary">
                Delete every conversation? This can&apos;t be undone.
              </span>
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmClear(false)}
                disabled={isClearing}
                className="min-h-11"
              >
                Cancel
              </Button>
              <Button
                type="button"
                variant="danger"
                onClick={handleClearConversations}
                disabled={isClearing}
                className="min-h-11"
              >
                {isClearing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Deleting…
                  </>
                ) : (
                  'Yes, delete all'
                )}
              </Button>
            </div>
          ) : (
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmClear(true)}
              className="min-h-11 text-status-negative hover:border-status-negative/40"
            >
              <MessageSquareX className="mr-2 h-4 w-4" /> Delete all conversations
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
