import type { Metadata } from 'next';
import { SendScreen } from '@/components/send/SendScreen';

export const metadata: Metadata = {
  title: 'Send',
  description: 'Pay a person or a Lightning invoice from your own wallet.',
};

export default function SendPage() {
  return <SendScreen />;
}
