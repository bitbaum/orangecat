/** @type {import('next').NextConfig} */

const path = require('path');
const routeAliases = require('./src/config/route-aliases.json');
const withMDX = require('@next/mdx')({
  extension: /\.mdx?$/,
  options: {
    remarkPlugins: [],
    rehypePlugins: [],
    // Remove providerImportSource to avoid client component issues
  },
});

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

  // The route audit deliberately addresses the local server over IPv4. Allow
  // that development origin so Next.js does not turn its own HMR requests into
  // misleading browser-console failures during the strict console pass.
  allowedDevOrigins: ['127.0.0.1'],

  // Support MDX files
  pageExtensions: ['js', 'jsx', 'ts', 'tsx', 'md', 'mdx'],

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

  // Legacy / guessable aliases have one SSOT. Browser tests import the same
  // JSON, so adding a compatibility URL without testing its canonical outcome
  // is not possible by accident.
  async redirects() {
    return routeAliases;
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
            value: 'origin-when-cross-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
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

module.exports = withBundleAnalyzer(withMDX(nextConfig));

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
