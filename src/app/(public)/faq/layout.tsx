import type { Metadata } from 'next';
import { SITE_URL } from '@/config/brand';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: 'FAQ',
  description:
    'Frequently asked questions about OrangeCat — your AI economic agent for exchanging, funding, lending, investing, and governing with Bitcoin.',
  alternates: { canonical: `${SITE_URL}${ROUTES.FAQ}` },
};

export default function FAQLayout({ children }: { children: React.ReactNode }) {
  return children;
}
