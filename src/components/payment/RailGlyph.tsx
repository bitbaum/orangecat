/**
 * The mark at the head of a way to be paid.
 *
 * Every row of that list used to be three lines of text, which made a list of
 * ways to be paid read like a form. A round tile gives each row a face and the
 * list a rhythm — and it is the one place on these screens that carries the
 * Bitcoin orange, because that is what the orange is for. The others are
 * monochrome and say what KIND of address the row holds (a phone, an e-mail, a
 * bank account) rather than pretending to be a brand logo we do not own.
 */

import type { LucideIcon } from 'lucide-react';
import { AtSign, Bitcoin, KeyRound, Landmark, Link2, Smartphone, Wallet } from 'lucide-react';
import type { HandleKind } from '@/config/payment-methods';
import { cn } from '@/lib/utils';

const ICONS: Record<HandleKind, LucideIcon> = {
  phone: Smartphone,
  contact: Smartphone,
  email: AtSign,
  username: AtSign,
  vpa: AtSign,
  id: AtSign,
  key: KeyRound,
  iban: Landmark,
  address: Wallet,
  link: Link2,
};

export function RailGlyph({
  kind,
  className,
}: {
  kind: HandleKind | 'bitcoin';
  className?: string;
}) {
  const Icon = kind === 'bitcoin' ? Bitcoin : ICONS[kind];
  return (
    <span
      aria-hidden="true"
      className={cn(
        'flex h-10 w-10 shrink-0 items-center justify-center rounded-full',
        kind === 'bitcoin'
          ? 'bg-bitcoinOrange/10 text-bitcoinOrange'
          : 'bg-surface-raised text-fg-secondary',
        className
      )}
    >
      <Icon className="h-5 w-5" />
    </span>
  );
}
