'use client';

/**
 * BookEntityButton
 *
 * Thin client wrapper around BookEntityDialog so a server-rendered detail
 * page (e.g. /services/[id]) can drop a "Book this" CTA without itself
 * becoming a client component.
 *
 * The button is variant="accent" — top-of-funnel conversion per the
 * design system migration. For Bitcoin-specific surfaces, use the
 * variant override.
 */

import { useState } from 'react';
import { usePathname } from 'next/navigation';
import { Calendar } from 'lucide-react';
import Button from '@/components/ui/Button';
import { BookEntityDialog, type BookEntityDialogProps } from './BookEntityDialog';

type Props = Omit<BookEntityDialogProps, 'isOpen' | 'onClose'> & {
  label?: string;
  className?: string;
  /**
   * Whether the viewer is signed in. POST /api/bookings is behind withAuth, so
   * an anonymous visitor who opens the dialog fills it in, submits, and gets
   * "Authentication required" as a red toast with no way forward — a visible
   * CTA on a dead end. Defaults to true so an omitted prop keeps the previous
   * behaviour rather than silently hiding the button on every surface.
   */
  isSignedIn?: boolean;
};

export function BookEntityButton({
  label = 'Book this',
  className,
  isSignedIn = true,
  ...dialogProps
}: Props) {
  const [isOpen, setIsOpen] = useState(false);
  const pathname = usePathname();

  // Keep the CTA — hiding it means an anonymous visitor never learns the thing
  // is bookable at all. Send them to sign-in and back instead. `from` is the
  // param /auth actually reads (useAuthForm.ts); `redirect` is read by nothing.
  if (!isSignedIn) {
    return (
      <Button
        variant="accent"
        href={`/auth?from=${encodeURIComponent(pathname || '/')}`}
        className={className}
        aria-label={`Sign in to book ${dialogProps.bookableTitle}`}
      >
        <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
        Sign in to book
      </Button>
    );
  }

  return (
    <>
      <Button
        variant="accent"
        onClick={() => setIsOpen(true)}
        className={className}
        aria-label={`Book ${dialogProps.bookableTitle}`}
      >
        <Calendar className="mr-2 h-4 w-4" aria-hidden="true" />
        {label}
      </Button>
      <BookEntityDialog {...dialogProps} isOpen={isOpen} onClose={() => setIsOpen(false)} />
    </>
  );
}
