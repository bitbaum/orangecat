'use client';

/**
 * Pay one person on the crew. Two honest ways: send the role's fee now from
 * the organizer's connected wallet, or record that they were paid another way
 * (Twint, cash). Once paid, it says so and cannot be paid twice.
 */

import { useState } from 'react';
import { Check } from 'lucide-react';
import Button from '@/components/ui/Button';
import { API_ROUTES } from '@/config/api-routes';
import type { EventPayout } from '@/domain/events/payouts';

interface CrewPayButtonProps {
  roleId: string;
  userId: string;
  feeLabel: string | null;
  paid: EventPayout | null;
  onPaid: (payout: EventPayout) => void;
}

export default function CrewPayButton({
  roleId,
  userId,
  feeLabel,
  paid,
  onPaid,
}: CrewPayButtonProps) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (paid) {
    return (
      <span className="flex items-center gap-1 text-sm text-status-positive">
        <Check className="h-4 w-4" /> {paid.method === 'other' ? 'Paid (recorded)' : 'Paid'}
      </span>
    );
  }

  async function pay(method: 'lightning' | 'other') {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.EVENTS.PAY_CREW(roleId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_id: userId, method }),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(json?.error?.message || 'The payment did not go through.');
      }
      onPaid(json.data.payout as EventPayout);
      setOpen(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        Pay
      </Button>
    );
  }

  return (
    <div className="flex w-full flex-col gap-2 rounded-md border border-default p-2">
      {feeLabel ? (
        <Button
          variant="accent"
          size="sm"
          isLoading={busy}
          disabled={busy}
          onClick={() => pay('lightning')}
        >
          Send {feeLabel} in Bitcoin from my wallet
        </Button>
      ) : (
        <p className="text-sm text-fg-secondary">Set a fee for this role to pay in Bitcoin.</p>
      )}
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => pay('other')}>
        I paid them another way (Twint, cash)
      </Button>
      <Button variant="ghost" size="sm" disabled={busy} onClick={() => setOpen(false)}>
        Cancel
      </Button>
      {error && <p className="text-sm text-status-negative">{error}</p>}
    </div>
  );
}
