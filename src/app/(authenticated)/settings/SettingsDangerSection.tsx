'use client';

import { AlertTriangle, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';

interface Props {
  isDeleting: boolean;
  onDelete: () => void;
}

export function SettingsDangerSection({ isDeleting, onDelete }: Props) {
  return (
    <div className="border-t border-status-negative/20 pt-10">
      <h3 className="mb-4 flex items-center text-lg font-semibold text-status-negative">
        <AlertTriangle className="w-6 h-6 mr-2" />
        Danger Zone
      </h3>
      <div className="rounded-md border border-status-negative/20 bg-status-negative/10 p-6">
        <h4 className="mb-2 text-lg font-medium text-status-negative">Delete Account</h4>
        <p className="mb-4 text-base text-fg-secondary">
          This permanently deletes your account, your profile and every page you own: projects,
          products, services, causes, loans and the rest. Groups you are in stay with their other
          members, and orders and payments between you and other people stay in their records. This
          cannot be undone.
        </p>
        <Button
          type="button"
          variant="danger"
          onClick={onDelete}
          disabled={isDeleting}
          className="px-6 py-2"
        >
          {isDeleting ? (
            <>
              <div className="mr-2 h-4 w-4 animate-spin rounded-sm border-2 border-surface-page border-t-transparent" />
              Deleting...
            </>
          ) : (
            <>
              <Trash2 className="w-4 h-4 mr-2" />
              Delete Account
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
