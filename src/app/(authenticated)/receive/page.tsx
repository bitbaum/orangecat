import type { Metadata } from 'next';
import { ReceiveScreen } from '@/components/receive/ReceiveScreen';

export const metadata: Metadata = {
  title: 'Receive',
  description: 'Get paid in Bitcoin, straight to your own wallet.',
};

export default function ReceivePage() {
  return <ReceiveScreen />;
}
