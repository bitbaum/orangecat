'use client';

import { LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { ACCOUNT_PURCHASE_COPY } from '@/config/account-bound-products';

/**
 * Where the account-free purchase would be, for a product that is granted to
 * an account when paid (a pass). Without an account the money would arrive and
 * nothing would be granted, so the way forward is signing in, and the card
 * says why.
 */
export function AccountPurchaseCard({ signInHref }: { signInHref: string }) {
  return (
    <Card>
      <CardContent className="space-y-3 pt-6">
        <p className="text-sm text-fg-secondary">{ACCOUNT_PURCHASE_COPY.why}</p>
        <Button href={signInHref} className="w-full gap-2">
          <LogIn className="h-4 w-4" aria-hidden="true" />
          {ACCOUNT_PURCHASE_COPY.signIn}
        </Button>
      </CardContent>
    </Card>
  );
}
