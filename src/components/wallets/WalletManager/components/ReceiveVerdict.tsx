'use client';

/**
 * Whether the pasted wallet can actually be paid.
 *
 * The form used to say "Lightning address — looks good" the moment the text
 * matched a SHAPE. `wallabypatient182172@getalby.com` matches that shape
 * perfectly and refuses every payment, so people connected a wallet, were
 * congratulated, and stayed unpayable until someone tried to pay them.
 *
 * Shape detection is still worth showing — it is instant and tells you the
 * paste landed in the right slot. It just is not a verdict. This asks the
 * provider for a real invoice and reports what came back.
 *
 * Debounced because every check costs two requests to somebody else's server,
 * and never blocking: a provider outage answers "unknown", so a correct address
 * can always still be saved.
 */

import { useEffect, useState } from 'react';
import { AlertTriangle, Check, Info, Loader2 } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';
import type { WalletInputKind } from '@/types/wallet';

const DEBOUNCE_MS = 700;

type Verdict = { status: 'receivable' | 'unusable' | 'unknown'; detail: string };
type State = { kind: 'idle' } | { kind: 'checking' } | { kind: 'done'; verdict: Verdict };

/** Only a lightning address can be meaningfully probed — see verifyReceive.ts. */
function probeKind(detected: WalletInputKind): 'lightning_address' | null {
  return detected === 'lightning' ? 'lightning_address' : null;
}

export function ReceiveVerdict({ detected, value }: { detected: WalletInputKind; value: string }) {
  const [state, setState] = useState<State>({ kind: 'idle' });
  const kind = probeKind(detected);
  const trimmed = value.trim();

  useEffect(() => {
    if (!kind || trimmed.length < 3) {
      setState({ kind: 'idle' });
      return;
    }

    let cancelled = false;
    const timer = setTimeout(async () => {
      setState({ kind: 'checking' });
      try {
        const res = await fetch(API_ROUTES.WALLETS.VERIFY, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'same-origin',
          body: JSON.stringify({ kind, value: trimmed }),
        });
        const body = await res.json();
        if (cancelled) {
          return;
        }
        if (!res.ok || !body?.success) {
          throw new Error(apiErrorMessage(body, 'Could not check this address'));
        }
        setState({ kind: 'done', verdict: body.data.verdict });
      } catch {
        if (!cancelled) {
          // Our own failure is not the address's fault.
          setState({
            kind: 'done',
            verdict: { status: 'unknown', detail: 'Could not check this right now.' },
          });
        }
      }
    }, DEBOUNCE_MS);

    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [kind, trimmed]);

  if (state.kind === 'idle') {
    return null;
  }

  if (state.kind === 'checking') {
    return (
      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-fg-secondary">
        <Loader2 className="h-3.5 w-3.5 flex-shrink-0 animate-spin" aria-hidden="true" />
        Checking it can receive…
      </p>
    );
  }

  const { status, detail } = state.verdict;
  const tone =
    status === 'receivable'
      ? 'text-status-positive'
      : status === 'unusable'
        ? 'text-status-warning'
        : 'text-fg-secondary';
  const Icon = status === 'receivable' ? Check : status === 'unusable' ? AlertTriangle : Info;

  return (
    <p className={`mt-1.5 flex items-start gap-1.5 text-xs font-medium ${tone}`}>
      <Icon className="mt-px h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
      {/* min-w-0 so a long provider message wraps instead of widening the form. */}
      <span className="min-w-0">{detail}</span>
    </p>
  );
}
