'use client';

import { Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';

interface Props {
  isDeleting: boolean;
  onDelete: () => void;
}

export function SettingsDangerSection({ isDeleting, onDelete }: Props) {
  return (
    <div>
      <div className="rounded-md border border-status-negative/20 bg-status-negative/10 p-6">
        <p className="mb-4 text-base text-fg-secondary">{ACCOUNT_DELETION_COPY.whatHappens}</p>
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          disabled={isDeleting}
          className="min-h-11"
        >
          {isDeleting ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-sm border-2 border-surface-page border-t-transparent" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete account
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
