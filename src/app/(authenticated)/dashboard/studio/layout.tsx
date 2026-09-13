import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Studio', template: '%s | OrangeCat' },
  description:
    'Make video, music, writing and artwork with AI — then finance it or sell it on OrangeCat.',
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
