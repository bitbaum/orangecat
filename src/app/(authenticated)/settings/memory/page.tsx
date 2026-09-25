/**
 * Memory — everything Cat knows about you.
 *
 * Billing is a SETUP surface — configured once, revisited rarely. Memory is a
 * DATA surface: you come here to read what has been written about you, correct
 * it, and delete it. That is why it has its own name in the navigation, and
 * why on the Cat settings page it is its own section ("What Cat knows"), first
 * in the menu and never under billing. Both render components/cat-settings/
 * KnowsSection, one implementation.
 */

'use client';

import { useRequireAuth } from '@/hooks/useAuth';
import Loading from '@/components/Loading';
import { KnowsSection } from '@/components/cat-settings/KnowsSection';

export default function MemorySettingsPage() {
  const { user, isLoading } = useRequireAuth();

  if (isLoading) {
    return <Loading fullScreen />;
  }
  if (!user) {
    return null;
  }

  return (
    <div className="space-y-6">
      <p className="text-sm text-fg-secondary">
        Cat&apos;s memory is yours and private: review it, delete any of it, export it, or bring
        context over from another AI. Interests are the one part you choose to make public so other
        people can find you.
      </p>
      <KnowsSection />
    </div>
  );
}
