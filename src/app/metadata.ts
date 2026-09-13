import { Metadata } from 'next';
import { APP_NAME, SITE_URL } from '@/config/brand';

const siteName = process.env.NEXT_PUBLIC_SITE_NAME || APP_NAME;

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: `${APP_NAME} - Make It, Finance It, Get Paid`,
  description:
    'Make video, music, writing and artwork with AI — then finance it, sell it, and settle in Bitcoin. Your AI economic agent does the setup.',
  keywords: [
    'bitcoin',
    'ai',
    'economic agent',
    'ai video generation',
    'ai music generation',
    'creative funding',
    'funding',
    'lightning',
    'blockchain',
  ],
  authors: [{ name: APP_NAME }],
  icons: {
    icon: [
      {
        url: '/images/orange-cat-logo.svg',
        type: 'image/svg+xml',
      },
      {
        url: '/favicon.ico',
        sizes: '32x32',
        type: 'image/x-icon',
      },
    ],
    apple: {
      url: '/images/orange-cat-logo.svg',
      type: 'image/svg+xml',
    },
  },
  openGraph: {
    title: `${siteName} - Make It, Finance It, Get Paid`,
    description:
      'Make the work — video, music, writing, artwork — then fund it, sell it, lend, invest and govern. Any identity, settled in Bitcoin.',
    type: 'website',
    locale: 'en_US',
    siteName: siteName,
    url: SITE_URL,
  },
  twitter: {
    card: 'summary_large_image',
    title: `${siteName} - Make It, Finance It, Get Paid`,
    description:
      'Make the work — video, music, writing, artwork — then fund it, sell it, lend, invest and govern. Any identity, settled in Bitcoin.',
  },
  robots: {
    index: true,
    follow: true,
  },
};
