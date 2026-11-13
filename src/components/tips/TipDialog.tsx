'use client';

import { Zap } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/Button';
import { PayFlow } from '@/components/payment/PayFlow';
import { TIP_COPY } from '@/config/tips';

interface TipDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username: string;
  recipientName: string;
}

/**
 * Tipping is the same act as paying, in a modal — so it runs PayFlow rather
 * than its own copy of the amount/invoice/settle machinery. This file is now
 * only the chrome: a dialog around the shared flow, plus a "Done" affordance
 * that closes it.
 */
export default function TipDialog({ open, onOpenChange, username, recipientName }: TipDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-bitcoinOrange" />
            {TIP_COPY.title(recipientName)}
          </DialogTitle>
          <DialogDescription>{TIP_COPY.subtitle}</DialogDescription>
        </DialogHeader>

        <PayFlow
          username={username}
          recipientName={recipientName}
          active={open}
          renderDone={() => (
            <Button variant="primary" onClick={() => onOpenChange(false)}>
              {TIP_COPY.done}
            </Button>
          )}
        />
      </DialogContent>
    </Dialog>
  );
}
