import localFont from 'next/font/local';

// Self-hosted fonts (src/fonts/*.woff2) — NO build-time fetch from Google Fonts.
// Removes a non-sovereign external dependency and the ETIMEDOUT build flakiness;
// builds are now fully deterministic + offline. Inter & Space Grotesk are variable
// (one file each, all weights); IBM Plex Mono ships the 3 weights actually used.
const inter = localFont({
  src: '../fonts/inter-variable.woff2',
  variable: '--font-inter',
  display: 'swap',
  weight: '100 900',
  fallback: [
    'system-ui',
    '-apple-system',
    'BlinkMacSystemFont',
    'Segoe UI',
    'Roboto',
    'sans-serif',
  ],
  preload: true,
});

// FleetCrown-aligned display typography: Space Grotesk for display/heading,
// IBM Plex Mono for code. Body stays Inter.
const spaceGrotesk = localFont({
  src: '../fonts/space-grotesk-variable.woff2',
  variable: '--font-heading',
  display: 'swap',
  weight: '300 700',
  preload: true,
});
const ibmPlexMono = localFont({
  src: [
    { path: '../fonts/ibm-plex-mono-400.woff2', weight: '400', style: 'normal' },
    { path: '../fonts/ibm-plex-mono-500.woff2', weight: '500', style: 'normal' },
    { path: '../fonts/ibm-plex-mono-600.woff2', weight: '600', style: 'normal' },
  ],
  variable: '--font-mono',
  display: 'swap',
  preload: false,
  fallback: ['ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
});
import './globals.css';
import Script from 'next/script';
import { AuthProvider } from '@/components/providers/AuthProvider';
import { ClientErrorReporter } from '@/components/providers/ClientErrorReporter';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { ThemeProvider } from '@/components/providers/ThemeProvider';
import { CurrencyRatesProvider } from '@/components/providers/CurrencyRatesProvider';
import { getRenderRates } from '@/services/currency/rates.server';
import { AppShell } from '@/components/layout/AppShell';
import { Toaster } from '@/components/ui/sonner';

import type { Metadata, Viewport } from 'next';
import { APP_DESCRIPTION, APP_NAME, APP_TAGLINE, SITE_URL } from '@/config/brand';

// Required for env(safe-area-inset-*) to take effect on iOS (notch + home indicator).
// Without `viewportFit: 'cover'` the inset values resolve to 0.
export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
};

export const metadata: Metadata = {
  title: {
    default: `${APP_NAME} — ${APP_TAGLINE}`,
    template: `%s | ${APP_NAME}`,
  },
  description: APP_DESCRIPTION,
  keywords:
    'AI economic agent, bitcoin, finance, community, fund, invest, lend, products, services, lightning network, peer-to-peer, pseudonymous, non-custodial',
  metadataBase: new URL(SITE_URL),
  // Feed autodiscovery — browsers/readers find /rss.xml from any page.
  alternates: {
    types: { 'application/rss+xml': `${SITE_URL}/rss.xml` },
  },
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: SITE_URL,
    siteName: APP_NAME,
    title: `${APP_NAME} — ${APP_TAGLINE}`,
    description: APP_DESCRIPTION,
  },
  twitter: {
    card: 'summary_large_image',
    title: 'OrangeCat - Your AI Economic Agent',
    description: 'Fund, lend, invest, trade, and govern with any identity, settled in Bitcoin.',
  },
  manifest: '/manifest.json',
  icons: {
    icon: [{ url: '/favicon.ico' }, { url: '/images/orange-cat-logo.svg', type: 'image/svg+xml' }],
    apple: '/favicon.svg',
  },
  appleWebApp: {
    capable: true,
    title: APP_NAME,
    statusBarStyle: 'black-translucent',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const gaId = process.env.NEXT_PUBLIC_GA_MEASUREMENT_ID;
  // Cache-only, never a network wait: rendering a page must not depend on a
  // third party answering. Whatever we last knew gets handed to the browser so
  // the first paint already speaks the visitor's currency.
  const rateSnapshot = getRenderRates();

  return (
    <html
      lang="en"
      className={`${inter.variable} ${spaceGrotesk.variable} ${ibmPlexMono.variable}`}
      suppressHydrationWarning
    >
      <body className="antialiased">
        {/* Structured data: Organization + WebSite */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'Organization',
                  name: APP_NAME,
                  url: SITE_URL,
                  logo: `${SITE_URL}/images/orange-cat-logo.svg`,
                  description:
                    'Fund, lend, invest, trade, and govern with any identity, settled in Bitcoin.',
                  sameAs: [],
                },
                {
                  '@type': 'WebSite',
                  name: APP_NAME,
                  url: SITE_URL,
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: {
                      '@type': 'EntryPoint',
                      urlTemplate: `${SITE_URL}/discover?q={search_term_string}`,
                    },
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
        <a
          href="#main-content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:px-4 focus:py-2 focus:bg-fg-primary focus:text-fg-inverted focus:rounded-lg focus:outline-none"
        >
          Skip to main content
        </a>
        <ClientErrorReporter />
        <ThemeProvider>
          <CurrencyRatesProvider initialSnapshot={rateSnapshot}>
            <QueryProvider>
              <AuthProvider>
                {/* No Suspense boundary here. A boundary above every page
                    forces the whole app to stream, and once streaming starts
                    the HTTP status is committed to 200 — so notFound() renders
                    the not-found UI with a 200, and redirect() degrades to a
                    client-side redirect instead of a server 307. Pages that
                    need a boundary declare it themselves (loading.tsx, or an
                    inner <Suspense> around the slow part, which is what the
                    Next.js docs recommend so the existence check still runs
                    before the response commits). Enforced by audit-routes. */}
                <AppShell>{children}</AppShell>
              </AuthProvider>
            </QueryProvider>
          </CurrencyRatesProvider>
          <Toaster position="top-right" richColors closeButton />
        </ThemeProvider>
        {/* FleetCrown feedback widget — OrangeCat is customer #2 of the sibling
            product's embeddable feedback loop (visitor points at the broken
            element → FleetCrown per-project inbox → one-click agent dispatch).
            Env-gated like GA; data-fc-bottom clears the mobile bottom nav.
            afterInteractive, not lazyOnload: busy pages (Cat chat streams and
            polls) can keep the browser from going idle, so lazyOnload left the
            FAB unmounted for minutes — a feedback button that isn't there when
            something breaks is the one time it's needed. */}
        {process.env.FLEETCROWN_FEEDBACK_TOKEN && (
          <Script
            src="https://fleetcrown.orangecat.ch/widget.js"
            strategy="afterInteractive"
            data-fc-project={process.env.FLEETCROWN_FEEDBACK_TOKEN}
            data-fc-bottom="80"
          />
        )}
        {gaId && (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${gaId}`}
              strategy="afterInteractive"
            />
            <Script id="google-analytics" strategy="afterInteractive">
              {`
                window.dataLayer = window.dataLayer || [];
                function gtag(){dataLayer.push(arguments);}
                gtag('js', new Date());
                gtag('config', '${gaId}');
              `}
            </Script>
          </>
        )}
      </body>
    </html>
  );
}
