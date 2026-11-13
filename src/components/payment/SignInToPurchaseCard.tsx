'use client';

import { LogIn } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { PaymentExpectationNote } from './PaymentExpectationNote';

/**
 * Signed-out purchase of a listing whose seller has no static address to
 * reveal: the way forward is signing in, with what the payment will look like.
 */
export function SignInToPurchaseCard({ signInHref }: { signInHref: string }) {
  return (
    <Card>
      <CardContent className="pt-6 space-y-3">
        <Button href={signInHref} className="w-full gap-2 min-h-11">
          <LogIn className="w-4 h-4" />
          Sign in to purchase
        </Button>
        <p className="text-xs text-fg-secondary text-center">
          {
            // Not 'a Lightning invoice': for an xpub wallet the request is a fresh
            // on-chain address.
            'You get a payment request straight from the seller’s wallet.'
          }
        </p>
        <PaymentExpectationNote />
      </CardContent>
    </Card>
  );
}
