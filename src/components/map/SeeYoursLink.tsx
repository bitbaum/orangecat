'use client';

import Link from 'next/link';
import { useAuthStore } from '@/stores/auth';

/**
 * "See yours" on a capability card, for a signed-in visitor only. The map is
 * one public page for everyone; offering a list of your own things to someone
 * who has no account sent them to sign in for an empty list.
 */
export function SeeYoursLink({ href }: { href: string }) {
  const signedIn = useAuthStore(state => !!state.user);
  if (!signedIn) {
    return null;
  }
  return (
    <Link
      href={href}
      className="inline-flex min-h-11 items-center px-2 text-sm text-fg-secondary hover:text-fg-primary hover:underline"
    >
      See yours
    </Link>
  );
}

export default SeeYoursLink;
