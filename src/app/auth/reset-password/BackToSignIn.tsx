import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { ROUTES } from '@/config/routes';

/** The one way back from every recovery step, in the words the sign-in page uses. */
export function BackToSignIn() {
  return (
    <div className="text-center">
      <Link
        href={ROUTES.AUTH_LOGIN}
        className="inline-flex min-h-11 items-center text-sm text-fg-secondary transition-colors hover:text-fg-primary"
      >
        <ArrowLeft className="mr-1 h-4 w-4" aria-hidden="true" />
        Back to sign in
      </Link>
    </div>
  );
}
