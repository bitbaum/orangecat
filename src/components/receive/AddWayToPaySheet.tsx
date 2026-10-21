'use client';

/**
 * Adding a way to be paid: pick the service, type the one thing it needs.
 *
 * Two screens in one sheet, each a list or a form — never a grid of logos.
 * The handle field is labelled in the service's own words ("$Cashtag",
 * "PayPal.me name", "IBAN") so nobody has to guess what to paste, and a
 * pasted link or "@name" is accepted and trimmed rather than refused.
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { StatusNote } from '@/components/money/StatusNote';
import {
  PAYMENT_METHOD_ORDER,
  PAYMENT_METHODS,
  PAYMENT_METHODS_COPY,
  PAYMENT_LABEL_MAX_LENGTH,
  type PaymentMethodId,
} from '@/config/payment-methods';
import { normalizePaymentHandle } from '@/lib/payments/payment-handle';
import {
  addPaymentMethod,
  type PaymentMethodRow,
} from '@/services/payment-methods/payment-methods-client';
import { haptic } from '@/lib/haptics';

interface AddWayToPaySheetProps {
  isOpen: boolean;
  onClose: () => void;
  onAdded: (row: PaymentMethodRow) => void;
}

const currenciesOf = (id: PaymentMethodId) => {
  const { currencies } = PAYMENT_METHODS[id];
  return currencies === 'any' ? 'Any currency' : currencies.join(' · ');
};

export function AddWayToPaySheet({ isOpen, onClose, onAdded }: AddWayToPaySheetProps) {
  const [method, setMethod] = useState<PaymentMethodId | null>(null);
  const [handle, setHandle] = useState('');
  const [label, setLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const reset = () => {
    setMethod(null);
    setHandle('');
    setLabel('');
    setError(null);
  };

  const close = () => {
    reset();
    onClose();
  };

  const save = async () => {
    if (!method) {
      return;
    }
    const kind = PAYMENT_METHODS[method];
    if (!normalizePaymentHandle(method, handle)) {
      setError(PAYMENT_METHODS_COPY.invalidHandle(kind.handleLabel));
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const row = await addPaymentMethod({ method, handle, label: label.trim() || undefined });
      haptic('success');
      onAdded(row);
      close();
    } catch (e) {
      haptic('error');
      setError(e instanceof Error ? e.message : 'Could not save that.');
    } finally {
      setSaving(false);
    }
  };

  const kind = method ? PAYMENT_METHODS[method] : null;

  return (
    <BottomSheet
      isOpen={isOpen}
      onClose={close}
      title={kind ? kind.name : PAYMENT_METHODS_COPY.addTitle}
    >
      {!kind ? (
        <ul className="divide-y divide-subtle px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {PAYMENT_METHOD_ORDER.map(id => (
            <li key={id}>
              <button
                type="button"
                onClick={() => setMethod(id)}
                className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
              >
                <span className="font-medium text-fg-primary">{PAYMENT_METHODS[id].name}</span>
                <span className="flex items-center gap-2 text-sm text-fg-tertiary">
                  {currenciesOf(id)}
                  <ChevronRight className="h-4 w-4" aria-hidden="true" />
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <form
          className="space-y-4 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-4"
          onSubmit={e => {
            e.preventDefault();
            void save();
          }}
        >
          <Input
            label={kind.handleLabel}
            value={handle}
            onChange={e => setHandle(e.target.value)}
            placeholder={kind.handlePlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            inputMode={kind.id === 'twint' ? 'tel' : 'text'}
            className="min-h-11"
            autoFocus
          />
          <Input
            label={PAYMENT_METHODS_COPY.labelField}
            value={label}
            onChange={e => setLabel(e.target.value.slice(0, PAYMENT_LABEL_MAX_LENGTH))}
            placeholder={PAYMENT_METHODS_COPY.labelPlaceholder}
            className="min-h-11"
          />
          {error && <StatusNote tone="warning">{error}</StatusNote>}
          <div className="grid grid-cols-2 gap-2">
            <Button type="button" variant="outline" onClick={reset} disabled={saving}>
              Back
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={saving || !handle.trim()}
              isLoading={saving}
            >
              {saving ? PAYMENT_METHODS_COPY.saving : PAYMENT_METHODS_COPY.save}
            </Button>
          </div>
        </form>
      )}
    </BottomSheet>
  );
}
