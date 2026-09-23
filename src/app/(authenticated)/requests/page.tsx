import type { Metadata } from 'next';
import { RequestsScreen } from '@/components/requests/RequestsScreen';

export const metadata: Metadata = {
  title: 'Requests',
  description: 'Ask someone for Bitcoin, and see what you owe or are owed.',
};

export default function RequestsPage() {
  return <RequestsScreen />;
}
