'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { ACCOUNT_DELETION_COPY } from '@/config/account-deletion';
import { IDENTITIES_COPY } from '@/config/identities';
import { fetchIdentityCircle } from '@/lib/identities/client';
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
  const description = useDeleteDescription(deleteAccountConfirm);
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
        description={description}
        confirmLabel="Delete Account"
      />
    </>
  );
}

const DELETE_DEFAULT = ACCOUNT_DELETION_COPY.whatHappens;

/**
 * What deleting this account takes with it, said before it happens: a main
 * account takes every identity it holds (ADR-0014 D6), an identity takes only
 * itself. Read when the dialog opens, so it is never stale.
 */
function useDeleteDescription(open: boolean): string {
  const [text, setText] = useState(DELETE_DEFAULT);
  useEffect(() => {
    if (!open) {
      return;
    }
    let alive = true;
    fetchIdentityCircle()
      .then(circle => {
        if (!alive) {
          return;
        }
        const handle = (m: { username: string | null; name: string | null }) =>
          m.username ? `@${m.username}` : m.name || 'an identity';
        const me = circle.members.find(m => m.isCurrent);
        const others = circle.members.filter(m => !m.isHolder);
        if (me && !me.isHolder) {
          setText(IDENTITIES_COPY.deleteIdentityOnly(handle(me)));
        } else if (others.length > 0) {
          setText(
            `${DELETE_DEFAULT} ${IDENTITIES_COPY.deleteHolderWithIdentities(others.map(handle))}`
          );
        } else {
          setText(DELETE_DEFAULT);
        }
      })
      // Unknown: say the general thing rather than nothing.
      .catch(() => alive && setText(DELETE_DEFAULT));
    return () => {
      alive = false;
    };
  }, [open]);
  return text;
}
