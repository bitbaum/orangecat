'use client';

/**
 * "To" — one field, and a camera beside it.
 *
 * Username, Lightning address, invoice or a scanned code all go in here;
 * classifyDestination reads which. The scan button sits in the field's row at
 * the field's height, not in a corner of its own.
 */

import dynamic from 'next/dynamic';
import { useState } from 'react';
import { ScanLine } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { PeoplePicker } from '@/components/money/PeoplePicker';
import type { FoundPerson } from '@/domain/people/rankPeople';
import { COMPONENT_STYLES } from '@/config/design-system';
import { SEND_COPY } from '@/config/send';

/** Loaded on tap, never at page load — the decoder is the heavy part. */
const WalletQrScanner = dynamic(() => import('@/components/wallets/WalletQrScanner'), {
  ssr: false,
});

interface SendDestinationFieldProps {
  value: string;
  onChange: (value: string) => void;
  /** Who to offer under the field — the screen decides when (usePeopleFinder). */
  people: readonly FoundPerson[];
  onPick: (handle: string) => void;
}

export function SendDestinationField({
  value,
  onChange,
  people,
  onPick,
}: SendDestinationFieldProps) {
  const [scanning, setScanning] = useState(false);

  return (
    <div className="space-y-2">
      <span className={COMPONENT_STYLES.field.label}>{SEND_COPY.recipientLabel}</span>
      <div className="flex gap-2">
        <div className="min-w-0 flex-1">
          <Input
            aria-label={SEND_COPY.recipientLabel}
            value={value}
            onChange={e => onChange(e.target.value)}
            placeholder={SEND_COPY.recipientPlaceholder}
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            className="min-h-11"
          />
        </div>
        <Button
          type="button"
          variant="outline"
          className="h-11 min-h-11 w-11 min-w-11 shrink-0 px-0"
          aria-label={SEND_COPY.scan}
          title={SEND_COPY.scan}
          onClick={() => setScanning(true)}
        >
          <ScanLine className="h-5 w-5" aria-hidden="true" />
        </Button>
      </div>

      <PeoplePicker people={people} onPick={onPick} />

      {scanning && (
        <WalletQrScanner
          title={SEND_COPY.scanTitle}
          onClose={() => setScanning(false)}
          onScanned={payload => {
            setScanning(false);
            onChange(payload);
          }}
        />
      )}
    </div>
  );
}
