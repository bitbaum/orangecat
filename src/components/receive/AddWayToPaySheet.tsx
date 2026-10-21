'use client';

/**
 * Adding a way to be paid: pick the rail, type the one thing it needs, read
 * what a payer will learn, choose who sees it.
 *
 * Two screens in one sheet, each a list or a form — never a grid of logos.
 * The rails are grouped by where people use them, worldwide first. The handle
 * field is labelled in the service's own words ("$Cashtag", "UPI ID", "IBAN"),
 * a pasted link or "@name" is accepted and trimmed, and the identity cost is
 * stated above Save because listing a fiat rail is the opt-in to real identity.
 */

import { useState } from 'react';
import { ChevronRight } from 'lucide-react';
import BottomSheet from '@/components/ui/BottomSheet';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { StatusNote } from '@/components/money/StatusNote';
import {
  PAYMENT_LABEL_MAX_LENGTH,
  PAYMENT_METHODS,
  PAYMENT_METHODS_COPY,
  PAYMENT_REGION_ORDER,
  PAYMENT_REGIONS,
  PAYMENT_VISIBILITIES,
  payerLearns,
  paymentMethodsIn,
  type PaymentMethodId,
  type PaymentMethodKind,
  type PaymentVisibility,
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

const currenciesOf = (kind: PaymentMethodKind) =>
  kind.currencies === 'any' ? 'Any currency' : kind.currencies.join(' · ');

const VISIBILITY_ITEMS = PAYMENT_VISIBILITIES.map(value => ({
  value,
  label: PAYMENT_METHODS_COPY.visibility[value].label,
}));

/** Phone-shaped rails default to on request: a number is the thing people regret printing. */
const defaultVisibility = (kind: PaymentMethodKind): PaymentVisibility =>
  kind.reveals.includes('phone') ? 'on_request' : 'public';

export function AddWayToPaySheet({ isOpen, onClose, onAdded }: AddWayToPaySheetProps) {
  const [method, setMethod] = useState<PaymentMethodId | null>(null);
  const [handle, setHandle] = useState('');
  const [label, setLabel] = useState('');
  const [visibility, setVisibility] = useState<PaymentVisibility>('public');
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

  const pick = (id: PaymentMethodId) => {
    setMethod(id);
    setVisibility(defaultVisibility(PAYMENT_METHODS[id]));
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
      const row = await addPaymentMethod({
        method,
        handle,
        label: label.trim() || undefined,
        visibility,
      });
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
        <div className="px-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
          {PAYMENT_REGION_ORDER.map(region => (
            <section key={region}>
              <h3 className="pb-1 pt-4 text-sm font-semibold uppercase tracking-caps text-fg-tertiary">
                {PAYMENT_REGIONS[region]}
              </h3>
              <ul className="divide-y divide-subtle">
                {paymentMethodsIn(region).map(item => (
                  <li key={item.id}>
                    <button
                      type="button"
                      onClick={() => pick(item.id)}
                      className="flex min-h-12 w-full items-center justify-between gap-3 text-left"
                    >
                      <span className="font-medium text-fg-primary">{item.name}</span>
                      <span className="flex items-center gap-2 text-sm text-fg-tertiary">
                        {currenciesOf(item)}
                        <ChevronRight className="h-4 w-4" aria-hidden="true" />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
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
            inputMode={kind.handleKind === 'phone' ? 'tel' : 'text'}
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

          <div className="space-y-2">
            <span className="block text-sm font-medium text-fg-primary">
              {PAYMENT_METHODS_COPY.visibilityLabel}
            </span>
            <SegmentedControl
              label={PAYMENT_METHODS_COPY.visibilityLabel}
              items={VISIBILITY_ITEMS}
              value={visibility}
              onChange={setVisibility}
            />
            <p className="text-sm text-fg-secondary">
              {PAYMENT_METHODS_COPY.visibility[visibility].consequence}
            </p>
          </div>

          <p className="text-sm text-fg-secondary">{payerLearns(kind.reveals)}</p>

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
