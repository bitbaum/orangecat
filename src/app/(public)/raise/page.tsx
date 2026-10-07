import type { Metadata } from 'next';
import { RaiseFlow } from '@/components/raise/RaiseFlow';

export const metadata: Metadata = {
  title: 'Raise money for what you need',
  description:
    'Say what you need in a sentence. The Cat works out what it costs, writes your page, and you share one link — to back, lend or invest.',
};

/** /raise — need A, costs B, get B. The flow lives in RaiseFlow. */
export default function RaisePage() {
  return (
    <main className="min-h-screen bg-surface-page">
      <div className="px-4 py-12 sm:px-6 sm:py-20 lg:px-8">
        <RaiseFlow />
      </div>
    </main>
  );
}
