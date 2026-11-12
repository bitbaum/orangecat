import type { ReactNode } from 'react';
import { Card, CardContent } from '@/components/ui/Card';

/**
 * What sits where a pay form would, when the payee has no wallet a payment can
 * reach (resolved server-side, the way the payment itself resolves it). One
 * card for every entity page and the group page, so "can't be paid yet" looks
 * the same wherever it is true. `children` carries the owner's next step.
 */
export function NoWalletYetNotice({
  payee = 'This creator',
  children,
}: {
  payee?: string;
  children?: ReactNode;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <p className="text-sm text-fg-secondary text-center">
          {payee} hasn&apos;t connected a wallet yet.
        </p>
        {children}
      </CardContent>
    </Card>
  );
}
