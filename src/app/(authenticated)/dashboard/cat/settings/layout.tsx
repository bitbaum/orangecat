import type { Metadata } from 'next';

export const metadata: Metadata = { title: 'Cat settings' };

export default function CatSettingsLayout({ children }: { children: React.ReactNode }) {
  return children;
}
