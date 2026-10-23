'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import type { PostDraftController } from '@/hooks/usePostDraft';

/** Never preview an older device-wide draft before its owner claims it. */
export function PostDraftNotice({ draft }: { draft?: PostDraftController }) {
  const [recovering, setRecovering] = useState(false);
  const [claimed, setClaimed] = useState(false);
  if (!draft || (!draft.error && !draft.legacyAvailable)) {
    return null;
  }
  return (
    <aside
      aria-label="Post draft recovery"
      className="mt-3 space-y-3 rounded-lg border border-default bg-surface-raised p-3 text-sm text-fg-secondary"
    >
      {draft.error && (
        <div className="space-y-2">
          <p role="alert">{draft.error}</p>
          <Button variant="outline" onClick={draft.flushDraft}>
            Retry save
          </Button>
        </div>
      )}
      {draft.legacyAvailable &&
        (recovering ? (
          <div className="space-y-3">
            <p>
              This device has older writing without an account marker. Recover it only if it is
              yours. Its text will be added to this draft as Only me; choose project destinations
              again.
            </p>
            <label className="flex min-h-11 items-center gap-2">
              <input
                type="checkbox"
                checked={claimed}
                onChange={event => setClaimed(event.target.checked)}
              />
              This older draft is mine
            </label>
            <div className="grid grid-cols-2 gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setRecovering(false);
                  setClaimed(false);
                }}
              >
                Keep current draft
              </Button>
              <Button
                disabled={!claimed}
                onClick={() => {
                  if (draft.recoverLegacyDraft()) {
                    setRecovering(false);
                    setClaimed(false);
                  }
                }}
              >
                Recover as Only me
              </Button>
            </div>
          </div>
        ) : (
          <Button variant="outline" onClick={() => setRecovering(true)}>
            Recover older device draft
          </Button>
        ))}
    </aside>
  );
}
