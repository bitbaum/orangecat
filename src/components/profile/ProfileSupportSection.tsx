'use client';

/**
 * ProfileSupportSection — "pay this person" on a public profile.
 *
 * It used to render `profiles.bitcoin_address` / `profiles.lightning_address`,
 * two legacy columns that NO payment path reads. That was wrong twice over: a
 * profile with a working wallet showed nothing payable, and a profile with a
 * stale column advertised an address the platform would never actually invoice
 * against — a visitor could have paid somewhere the owner no longer controls.
 *
 * Now it asks the authority. `/api/tips/receive-info` runs the same resolution
 * a real payment runs, so this card appears exactly when money can actually
 * arrive, and stays silent otherwise rather than guessing from a column.
 */

import { Zap } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import TipButton from '@/components/tips/TipButton';
import { SharePayLink } from '@/components/receive/SharePayLink';
import { useCanReceive } from './useCanReceive';
import { PAY_COPY } from '@/config/pay';

interface ProfileSupportSectionProps {
  username: string;
  displayName: string;
  /** The owner viewing their own profile gets the shareable link too. */
  isOwner?: boolean;
}

export function ProfileSupportSection({
  username,
  displayName,
  isOwner = false,
}: ProfileSupportSectionProps) {
  const canReceive = useCanReceive(username);

  if (!canReceive) {
    return null;
  }

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 pt-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="flex items-center gap-2 font-semibold text-fg-primary">
              <Zap className="h-4 w-4 text-bitcoinOrange" />
              {PAY_COPY.title(displayName)}
            </h3>
            <p className="mt-1 text-sm text-fg-secondary">{PAY_COPY.disclaimer}</p>
          </div>
          <TipButton username={username} recipientName={displayName} />
        </div>

        {isOwner && <SharePayLink username={username} />}
      </CardContent>
    </Card>
  );
}
