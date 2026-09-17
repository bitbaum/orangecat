'use client';

import { toast } from 'sonner';
import { MFASetup } from '@/components/auth/MFASetup';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';

interface Props {
  showMFASetup: boolean;
  setShowMFASetup: (v: boolean) => void;
  deleteAccountConfirm: boolean;
  setDeleteAccountConfirm: (v: boolean) => void;
  onMFASetupComplete: () => void;
  onDeleteConfirm: () => void;
}

export function SettingsModals({
  showMFASetup,
  setShowMFASetup,
  deleteAccountConfirm,
  setDeleteAccountConfirm,
  onMFASetupComplete,
  onDeleteConfirm,
}: Props) {
  return (
    <>
      {showMFASetup && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="max-w-md w-full">
            <MFASetup
              onSetupComplete={() => {
                toast.success('Two-factor authentication enabled!');
                onMFASetupComplete();
              }}
              onCancel={() => setShowMFASetup(false)}
            />
          </div>
        </div>
      )}

      <ConfirmDialog
        isOpen={deleteAccountConfirm}
        onClose={() => setDeleteAccountConfirm(false)}
        onConfirm={onDeleteConfirm}
        title="Delete your account?"
        description="This action cannot be undone. All your data will be permanently deleted."
        confirmLabel="Delete Account"
      />
    </>
  );
}
