import type { Metadata } from 'next';
import { ROUTES } from '@/config/routes';
import { pageMetadata } from '@/lib/seo/metadata';

export const metadata: Metadata = {
  ...pageMetadata({
    title: 'Community',
    shareTitle: 'Community - OrangeCat',
    description: 'Public timeline and community posts from the OrangeCat economic community.',
    path: ROUTES.COMMUNITY,
  }),
  keywords: 'bitcoin, community, timeline, posts, social, economic agent',
};

export default function CommunityLayout({ children }: { children: React.ReactNode }) {
  return children;
}
