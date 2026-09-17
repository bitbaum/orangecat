import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: { default: 'Companions', template: '%s | OrangeCat' },
};

export default function Layout({ children }: { children: React.ReactNode }) {
  return children;
}
