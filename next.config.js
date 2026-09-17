/** @type {import('next').NextConfig} */

const path = require('path');
let withBundleAnalyzer = config => config;
try {
  withBundleAnalyzer = require('@next/bundle-analyzer')({
    enabled: process.env.ANALYZE === 'true',
  });
} catch (error) {
  console.log('Bundle analyzer not available, skipping...');
}

const nextConfig = {
  // ESLint is a devDependency — lint in CI, skip during the build
  eslint: {
    ignoreDuringBuilds: true,
  },

  // Fix workspace root detection to prevent watching entire home directory
  outputFileTracingRoot: __dirname,

  // Next 16 builds with Turbopack. A `webpack` key without a `turbopack` key
  // is a FATAL build error ("This may be a mistake") — @next/mdx used to
  // supply the turbopack key implicitly; with MDX gone, acknowledge Turbopack
  // explicitly. The webpack section below still applies to `next dev --webpack`
  // style runs and is otherwise ignored by Turbopack.
  turbopack: {},

  // Blog posts are read from content/blog at request time (src/lib/blog.ts).
  // File tracing only follows require/import graphs, so the standalone build
  // shipped WITHOUT the markdown files — every post rendered as a frontmatter-less
  // stub in prod. Explicitly include them for every route that reads them.
  outputFileTracingIncludes: {
    '/blog': ['./content/blog/**'],
    '/blog/[slug]': ['./content/blog/**'],
  },

  // Externalize Supabase packages for server-side rendering
  // 'standalone' output is what the Hetzner self-host needs — opt in via
  // SELF_HOST=1 at build time.
  ...(process.env.SELF_HOST ? { output: 'standalone' } : {}),
  // tiny-secp256k1 is wasm-backed — bundling it breaks the .wasm file's path,
  // so it (and the bitcoin libs that wrap it) must stay external and load from
  // node_modules at runtime (output file tracing carries them into standalone).
  serverExternalPackages: [
    '@supabase/supabase-js',
    '@supabase/ssr',
    'tiny-secp256k1',
    'bip32',
    'bitcoinjs-lib',
  ],

  // Image optimization
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com',
        port: '',
        pathname: '/**',
      },
      {
        protocol: 'https',
        hostname: 'github.com',
        port: '',
        pathname: '/**',
      },
      {
        // Self-hosted Supabase storage on Hetzner — the SSOT.
        // Managed-cloud host (ohkueislstxomdjavyhs.supabase.co) retired 2026-06.
        protocol: 'https',
        hostname: 'supabase.orangecat.ch',
        port: '',
        pathname: '/storage/v1/object/public/**',
      },
    ],
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920, 2048, 3840],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
    minimumCacheTTL: 31536000, // 1 year
    dangerouslyAllowSVG: false,
    contentSecurityPolicy: "default-src 'self'; script-src 'none'; sandbox;",
  },

  // Experimental features for performance
  experimental: {
    optimizePackageImports: ['lucide-react', 'framer-motion', '@radix-ui/react-dropdown-menu'],
  },

  // Enable compression
  compress: true,

  // Generate ETags for better caching (disabled in dev to prevent stale content)
  generateEtags: process.env.NODE_ENV === 'production',

  // Redirects for common auth URLs
  async redirects() {
    return [
      // Auth redirects - common patterns to canonical /auth page
      {
        source: '/login',
        destination: '/auth?mode=login',
        permanent: true,
      },
      {
        source: '/signin',
        destination: '/auth?mode=login',
        permanent: true,
      },
      {
        source: '/register',
        destination: '/auth?mode=register',
        permanent: true,
      },
      {
        source: '/signup',
        destination: '/auth?mode=register',
        permanent: true,
      },
      {
        source: '/auth/signin',
        destination: '/auth?mode=login',
        permanent: true,
      },
      {
        source: '/auth/signup',
        destination: '/auth?mode=register',
        permanent: true,
      },
      {
        source: '/auth/login',
        destination: '/auth?mode=login',
        permanent: true,
      },
      {
        source: '/auth/register',
        destination: '/auth?mode=register',
        permanent: true,
      },
      // The standalone forgot-password page duplicated the in-form flow
      // (two surfaces, one purpose). /auth?mode=forgot is the one surface.
      {
        source: '/auth/forgot-password',
        destination: '/auth?mode=forgot',
        permanent: true,
      },
      // Legacy per-assistant chat routes — superseded by /dashboard/cat.
      // No inbound links from the app; preserved here in case bookmarks exist.
      {
        source: '/ai-chat/:path*',
        destination: '/dashboard/cat',
        permanent: true,
      },
      // Guessable aliases for the flagship Cat surface. "The Cat is the
      // interface" — someone typing orangecat.ch/cat must land on the Cat,
      // never on a 404. Same alias policy as the /login → /auth block above.
      {
        source: '/cat',
        destination: '/dashboard/cat',
        permanent: true,
      },
      {
        source: '/chat',
        destination: '/dashboard/cat',
        permanent: true,
      },
      {
        source: '/ai',
        destination: '/dashboard/cat',
        permanent: true,
      },
      // AI assistants became Companions (2026-09-15). Bookmarks and search
      // results still carry the old paths; the API path did not move.
      {
        source: '/ai-assistants',
        destination: '/companions',
        permanent: true,
      },
      {
        source: '/ai-assistants/:id',
        destination: '/companions/:id',
        permanent: true,
      },
      {
        source: '/dashboard/ai-assistants/:path*',
        destination: '/dashboard/companions/:path*',
        permanent: true,
      },
    ];
  },

  // Enhanced headers for performance
  async headers() {
    const isDevelopment = process.env.NODE_ENV !== 'production';

    return [
      {
        source: '/(.*)',
        headers: [
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            // strict-origin-when-cross-origin — the fleet baseline (see
            // aoz-begleitung/next.config.js), and the only one of the five
            // baseline headers orangecat.ch was not already sending in its
            // agreed form. It differs from the previous `origin-when-cross-
            // origin` in one respect: on an HTTPS -> HTTP downgrade it sends NO
            // referrer at all instead of the bare origin. Same-origin requests
            // still carry the full URL and cross-origin ones still carry the
            // origin, so nothing that reads document.referrer or server-side
            // Referer sees a change in practice — and no rendering depends on
            // it. The other four (X-Content-Type-Options, X-Frame-Options:
            // DENY — stricter than the SAMEORIGIN baseline, HSTS, and
            // Permissions-Policy with its deliberate microphone=(self)) are
            // already correct and are left exactly as they are.
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            // microphone=(self) — NOT the empty `microphone=()` this used to
            // send. An empty allowlist denies the feature to every origin
            // INCLUDING this one, so the browser never even shows a permission
            // prompt: getUserMedia rejects immediately with NotAllowedError.
            //
            // Measured on orangecat.ch before this change:
            //   document.featurePolicy.allowsFeature('microphone') -> false
            //   navigator.permissions.query({name:'microphone'})   -> "denied"
            //
            // That silently disabled speak-to-report in the embedded Loki
            // feedback widget, and no visitor could fix it — there was nothing
            // to allow. `(self)` permits only this origin, so the browser asks
            // the person, which is the decision that should be theirs.
            //
            // camera and geolocation stay fully denied: nothing here uses them,
            // and an unused capability should not be reachable.
            value: 'camera=(), microphone=(self), geolocation=()',
          },
          // HSTS: tell browsers to always use HTTPS (production only)
          ...(!isDevelopment
            ? [
                {
                  key: 'Strict-Transport-Security',
                  value: 'max-age=63072000; includeSubDomains; preload',
                },
                // Content-Security-Policy in REPORT-ONLY first: it never blocks,
                // only reports violations, so we can tune the policy against real
                // traffic before switching to an enforcing `Content-Security-Policy`
                // header. The app renders user-generated content, so an XSS-limiting
                // CSP is the biggest header-layer gap. connect-src covers the
                // self-hosted Supabase (REST + realtime ws) and R2 media.
                {
                  key: 'Content-Security-Policy-Report-Only',
                  value: [
                    "default-src 'self'",
                    "script-src 'self' 'unsafe-inline' 'unsafe-eval'",
                    "style-src 'self' 'unsafe-inline'",
                    "img-src 'self' data: blob: https:",
                    "font-src 'self' data:",
                    "connect-src 'self' https://supabase.orangecat.ch wss://supabase.orangecat.ch https://*.cloudflarestorage.com",
                    "frame-ancestors 'none'",
                    "base-uri 'self'",
                    "form-action 'self'",
                    "object-src 'none'",
                  ].join('; '),
                },
              ]
            : []),
          // Disable caching in development
          ...(isDevelopment
            ? [
                {
                  key: 'Cache-Control',
                  value: 'no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0',
                },
              ]
            : []),
        ],
      },
      {
        source: '/static/(.*)',
        headers: [
          {
            key: 'Cache-Control',
            value: isDevelopment
              ? 'no-store, no-cache, must-revalidate'
              : 'public, max-age=31536000, immutable',
          },
        ],
      },
      // Disable caching for all JS/CSS in development
      ...(isDevelopment
        ? [
            {
              source: '/_next/static/(.*)',
              headers: [
                {
                  key: 'Cache-Control',
                  value: 'no-store, no-cache, must-revalidate',
                },
              ],
            },
          ]
        : []),
    ];
  },

  // Production optimizations
  ...(process.env.NODE_ENV === 'production' && {
    compiler: {
      removeConsole: {
        exclude: ['error', 'warn'],
      },
    },
  }),

  // TypeScript and ESLint validation enabled for code quality
  typescript: {
    // Block production builds on type errors
    ignoreBuildErrors: false,
  },

  // Remove X-Powered-By header
  poweredByHeader: false,

  // Performance budgets
  onDemandEntries: {
    maxInactiveAge: 25 * 1000,
    pagesBufferLength: 2,
  },

  // Advanced webpack optimizations for bundle size
  webpack: (config, options) => {
    const { dev, isServer, webpack } = options;

    // Prevent watching parent directories to avoid EMFILE errors
    // Use polling mode for better reliability with large projects
    if (dev) {
      config.watchOptions = {
        ...config.watchOptions,
        ignored: [
          // Ignore common build/cache directories
          '**/node_modules/**',
          '**/.git/**',
          '**/.next/**',
          '**/mcp-servers/**',
          '**/test-results/**',
          '**/logs/**',
          '**/.playwright-mcp/**',
          '**/*.log',
          '**/*.tmp',
          '**/*.cache',
          '**/__pycache__/**',
          '**/coverage/**',
          '**/dist/**',
          '**/build/**',
          '**/migration-testing/**',
          '**/cypress/**',
          '**/playwright-report/**',
        ],
        followSymlinks: false,
        aggregateTimeout: 500,
        // Use polling to avoid EMFILE errors - more reliable for large projects
        // Polling checks files periodically instead of watching all file descriptors
        // This prevents "too many open files" errors on Linux systems
        poll: 1000, // Poll every 1 second (1000ms)
      };
    }

    // Note: Manual webpack externals REMOVED - they caused build issues.
    // Supabase packages are handled via serverExternalPackages config instead

    // Configure fallbacks for Node.js polyfills (only for client-side)
    if (!isServer) {
      config.resolve.fallback = {
        ...config.resolve.fallback,
        fs: false,
        net: false,
        tls: false,
        crypto: false,
        stream: false,
        url: false,
        zlib: false,
        http: false,
        https: false,
        assert: false,
        os: false,
        path: false,
      };

      // Simple global polyfills and environment variables
      config.plugins.push(
        new webpack.DefinePlugin({
          global: 'globalThis',
          self: 'globalThis',
          'process.env.NEXT_PUBLIC_SUPABASE_URL': JSON.stringify(
            process.env.NEXT_PUBLIC_SUPABASE_URL
          ),
          'process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY': JSON.stringify(
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ),
        })
      );
    }

    // Note: if needed, aliases can be added here

    return config;
  },
};

module.exports = withBundleAnalyzer(nextConfig);

// Performance monitoring
if (process.env.NODE_ENV === 'production') {
  console.log('🚀 Performance optimizations enabled:');
  console.log('  ✅ SWC Minification');
  console.log('  ✅ Image Optimization');
  console.log('  ✅ Advanced Tree Shaking');
  console.log('  ✅ Smart Code Splitting');
  console.log('  ✅ Compression');
  console.log('  ✅ Enhanced Caching Headers');
  console.log('  ✅ Bundle Size Optimization');
  // Cache-busting deployment: 2025-10-30T20:17
}
