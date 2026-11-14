import { NotFound } from '@/components/ui/NotFound';

/**
 * One answer for three cases — no such wallet, a deactivated wallet, and a
 * wallet whose owner deleted it. Distinguishing them would confirm that a
 * given id once existed, which is an enumeration oracle for a table of
 * payment destinations. The shared sentence says none of the three.
 */
export default function WalletNotFound() {
  return <NotFound kind="wallet" />;
}
