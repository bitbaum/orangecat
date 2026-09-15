import Link from 'next/link';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

/**
 * One answer for three cases — no such wallet, a deactivated wallet, and a
 * wallet whose owner deleted it. Distinguishing them would confirm that a
 * given id once existed, which is an enumeration oracle for a table of
 * payment destinations.
 */
export default function WalletNotFound() {
  return (
    <main className="mx-auto max-w-lg px-4 py-24 text-center">
      <h1 className="text-2xl font-semibold text-fg-primary">Wallet not available</h1>
      <p className="text-fg-secondary mt-3">
        This wallet doesn’t exist, or its owner is no longer accepting payments to it.
      </p>
      <Link href={ROUTES.HOME} className="inline-block mt-8">
        <Button variant="outline">Back to OrangeCat</Button>
      </Link>
    </main>
  );
}
