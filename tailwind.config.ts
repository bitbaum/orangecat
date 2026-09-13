import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: ['class', '.dark'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
    // Pull in constant files that ship literal Tailwind class strings
    // (e.g. src/constants/z-index.ts exports 'z-[46]' for MOBILE_ACTION_BAR).
    // Without this Tailwind's scanner skips the constants dir and the
    // class string is on the DOM but the rule is never generated.
    './src/constants/**/*.{ts,tsx}',
  ],
  theme: {
    extend: {
      // Semantic border tier (Loki). `border-default`/`-interactive` are
      // the migration targets for legacy `border-border`; subtle/strong carry
      // the existing neutral border vars forward under semantic names.
      borderColor: {
        default: 'hsl(var(--border-default))',
        interactive: 'hsl(var(--border-interactive))',
        subtle: 'hsl(var(--border-subtle))',
        strong: 'hsl(var(--border-strong))',
      },
      fontSize: {
        // Native mobile app typography scale
        '2xs': ['0.625rem', { lineHeight: '1rem' }], // 10px - Badges, micro labels
        xs: ['0.75rem', { lineHeight: '1rem', letterSpacing: '0' }], // 12px - Labels, captions
        sm: ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }], // 14px - Secondary text
        // 15px - the reading size for post bodies. Deliberately between sm and
        // base: 16px is a touch wide in a 672px column and 14px is small to
        // read at length. It was written as the arbitrary `text-[15px]`, which
        // is a value nothing else can reference and no theme change can reach —
        // the same problem as a hardcoded hex. Named, it is a decision.
        post: ['0.9375rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        base: ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }], // 16px - Body text (iOS standard)
        lg: ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '0' }], // 18px - Large body
        xl: ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '0' }], // 20px - Subtitles
        '2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0' }], // 24px - Headings
        '3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '0' }], // 30px - Large headings
        '4xl': ['2.25rem', { lineHeight: '2.5rem', letterSpacing: '0' }], // 36px - Hero text
        'fluid-sm': ['0.875rem', { lineHeight: '1.25rem', letterSpacing: '0' }],
        'fluid-base': ['1rem', { lineHeight: '1.5rem', letterSpacing: '0' }],
        'fluid-lg': ['1.125rem', { lineHeight: '1.75rem', letterSpacing: '0' }],
        'fluid-xl': ['1.25rem', { lineHeight: '1.75rem', letterSpacing: '0' }],
        'fluid-2xl': ['1.5rem', { lineHeight: '2rem', letterSpacing: '0' }],
        'fluid-3xl': ['1.875rem', { lineHeight: '2.25rem', letterSpacing: '0' }],
      },
      spacing: {
        // Native mobile spacing scale (iOS HIG inspired)
        '0.5': '0.125rem', // 2px
        '1': '0.25rem', // 4px
        '1.5': '0.375rem', // 6px
        '2': '0.5rem', // 8px
        '3': '0.75rem', // 12px
        '4': '1rem', // 16px - Base unit
        '5': '1.25rem', // 20px
        '6': '1.5rem', // 24px
        '8': '2rem', // 32px
        '10': '2.5rem', // 40px
        '12': '3rem', // 48px
        '16': '4rem', // 64px
        '20': '5rem', // 80px
        '24': '6rem', // 96px
        // Safe area aware spacing
        'safe-top': 'env(safe-area-inset-top, 1rem)',
        'safe-bottom': 'env(safe-area-inset-bottom, 1rem)',
        'safe-left': 'env(safe-area-inset-left, 1rem)',
        'safe-right': 'env(safe-area-inset-right, 1rem)',
      },
      maxWidth: {
        // Native app content widths
        app: '428px', // iPhone 15 Pro Max width
        'app-sm': '375px', // iPhone SE width
        'app-lg': '430px', // iPhone 15 Pro Max
        tablet: '768px', // iPad Mini
        // Loki-aligned layout primitive
        shell: 'var(--shell-max)',
      },
      colors: {
        orange: {
          '50': 'rgb(var(--orange-50) / <alpha-value>)',
          '100': 'rgb(var(--orange-100) / <alpha-value>)',
          '200': 'rgb(var(--orange-200) / <alpha-value>)',
          '300': 'rgb(var(--orange-300) / <alpha-value>)',
          '400': 'rgb(var(--orange-400) / <alpha-value>)',
          '500': 'rgb(var(--orange-500) / <alpha-value>)',
          '600': 'rgb(var(--orange-600) / <alpha-value>)',
          '700': 'rgb(var(--orange-700) / <alpha-value>)',
          '800': 'rgb(var(--orange-800) / <alpha-value>)',
          '900': 'rgb(var(--orange-900) / <alpha-value>)',
        },
        bitcoinOrange: 'rgb(var(--bitcoin-orange-channels) / <alpha-value>)',
        tiffany: {
          DEFAULT: 'rgb(var(--tiffany-500) / <alpha-value>)',
          light: 'rgb(var(--tiffany-50) / <alpha-value>)',
          dark: 'rgb(var(--tiffany-700) / <alpha-value>)',
          '50': 'rgb(var(--tiffany-50) / <alpha-value>)',
          '100': 'rgb(var(--tiffany-100) / <alpha-value>)',
          '200': 'rgb(var(--tiffany-200) / <alpha-value>)',
          '300': 'rgb(var(--tiffany-300) / <alpha-value>)',
          '400': 'rgb(var(--tiffany-400) / <alpha-value>)',
          '500': 'rgb(var(--tiffany-500) / <alpha-value>)',
          '600': 'rgb(var(--tiffany-600) / <alpha-value>)',
          '700': 'rgb(var(--tiffany-700) / <alpha-value>)',
          '800': 'rgb(var(--tiffany-800) / <alpha-value>)',
          '900': 'rgb(var(--tiffany-900) / <alpha-value>)',
        },
        // gray: removed — matches Tailwind built-in exactly, use core palette
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
          dim: 'hsl(var(--muted-dim))',
          strong: 'hsl(var(--muted-strong))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        success: {
          DEFAULT: 'hsl(var(--success))',
          foreground: 'hsl(var(--success-foreground))',
        },
        warning: {
          DEFAULT: 'hsl(var(--warning))',
          foreground: 'hsl(var(--warning-foreground))',
        },
        border: {
          DEFAULT: 'hsl(var(--border))',
          subtle: 'hsl(var(--border-subtle))',
          strong: 'hsl(var(--border-strong))',
        },
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        // ── Loki-aligned semantic tier (commit 2/N of migration) ────
        // Utility-class surface for the --text-/--surface-/--accent-/--status-
        // CSS vars introduced in eff99bad. Components migrate to these from
        // bg-card / text-foreground / bg-primary as they're refactored.
        // Namespace: `fg-*` for text (avoids `text-text-*` clash).
        fg: {
          primary: 'hsl(var(--text-primary))',
          secondary: 'hsl(var(--text-secondary))',
          tertiary: 'hsl(var(--text-tertiary))',
          muted: 'hsl(var(--text-muted))',
          inverted: 'hsl(var(--text-inverted))',
        },
        surface: {
          page: 'hsl(var(--surface-page))',
          base: 'hsl(var(--surface-base))',
          raised: 'hsl(var(--surface-raised))',
          overlay: 'hsl(var(--surface-overlay))',
          modal: 'hsl(var(--surface-modal))',
          drawer: 'hsl(var(--surface-drawer))',
          public: 'hsl(var(--surface-public))',
        },
        'accent-warm': {
          DEFAULT: 'var(--accent-primary)',
          hover: 'var(--accent-hover)',
        },
        // The label colour for text ON accent-warm. `bg-accent-warm text-white`
        // is 3.10:1 and fails AA; `text-on-accent` is 6.10:1. Paired with the
        // background it belongs to so nobody has to remember which ink an
        // orange button takes.
        'on-accent': 'hsl(var(--on-accent))',
        status: {
          positive: 'hsl(var(--status-positive))',
          'positive-subtle': 'hsl(var(--status-positive-subtle))',
          warning: 'hsl(var(--status-warning))',
          'warning-subtle': 'hsl(var(--status-warning-subtle))',
          negative: 'hsl(var(--status-negative))',
          'negative-subtle': 'hsl(var(--status-negative-subtle))',
          neutral: 'hsl(var(--status-neutral))',
        },
      },
      letterSpacing: {
        display: 'var(--tracking-display)',
        label: 'var(--tracking-label)',
        caps: 'var(--tracking-caps)',
      },
      fontFamily: {
        sans: ['var(--font-inter)'],
        // Loki-aligned display stack (migration 7/N)
        heading: [
          'var(--font-heading)',
          'var(--font-inter)',
          'system-ui',
          'sans-serif',
        ] as string[],
        mono: [
          'var(--font-mono)',
          'ui-monospace',
          'SFMono-Regular',
          'Menlo',
          'monospace',
        ] as string[],
      },
      scale: {
        '98': '0.98',
        '102': '1.02',
      },
      animation: {
        // Native app quality animations
        'slide-in-right': 'slideInFromRight 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'slide-in-left': 'slideInFromLeft 0.35s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'slide-up': 'slideUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'fade-in': 'fadeIn 0.2s ease-out',
        'fade-in-up': 'fadeInUp 0.3s cubic-bezier(0.25, 0.46, 0.45, 0.94)',
        'scale-in': 'scaleIn 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)', // Springy bounce
        'heart-beat': 'heartBeat 0.3s ease-in-out',
        shimmer: 'shimmer 2s linear infinite',
        'bounce-subtle': 'bounceSubtle 0.5s ease-out',
        ripple: 'ripple 0.6s ease-out',
        // Pull-to-refresh
        'spin-slow': 'spin 1s linear infinite',
      },
      keyframes: {
        slideInFromRight: {
          '0%': {
            opacity: '0',
            transform: 'translateX(100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideInFromLeft: {
          '0%': {
            opacity: '0',
            transform: 'translateX(-100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateX(0)',
          },
        },
        slideUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(100%)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        fadeInUp: {
          '0%': {
            opacity: '0',
            transform: 'translateY(10px)',
          },
          '100%': {
            opacity: '1',
            transform: 'translateY(0)',
          },
        },
        scaleIn: {
          '0%': {
            opacity: '0',
            transform: 'scale(0.9)',
          },
          '50%': {
            transform: 'scale(1.05)', // Slight overshoot
          },
          '100%': {
            opacity: '1',
            transform: 'scale(1)',
          },
        },
        heartBeat: {
          '0%': { transform: 'scale(1)' },
          '25%': { transform: 'scale(1.3)' },
          '50%': { transform: 'scale(1.1)' },
          '75%': { transform: 'scale(1.25)' },
          '100%': { transform: 'scale(1)' },
        },
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
        bounceSubtle: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-4px)' },
        },
        ripple: {
          '0%': {
            transform: 'scale(0)',
            opacity: '1',
          },
          '100%': {
            transform: 'scale(4)',
            opacity: '0',
          },
        },
      },
      borderRadius: {
        // Sparse product radius scale. Keep cards at 8px or less.
        none: '0',
        sm: '0.25rem',
        DEFAULT: '0.375rem',
        md: '0.375rem',
        lg: '0.5rem',
        xl: '0.5rem',
        '2xl': '0.5rem',
        '3xl': '0.5rem',
        '4xl': '0.5rem',
        full: '9999px', // Full circle
      },
      boxShadow: {
        sm: '0 1px 1px hsl(var(--foreground) / 0.04)',
        DEFAULT: '0 1px 2px hsl(var(--foreground) / 0.06)',
        md: '0 4px 12px hsl(var(--foreground) / 0.07)',
        lg: '0 8px 24px hsl(var(--foreground) / 0.08)',
        xl: '0 12px 32px hsl(var(--foreground) / 0.1)',
        '2xl': '0 16px 48px hsl(var(--foreground) / 0.12)',
        card: '0 1px 2px hsl(var(--foreground) / 0.05)',
        'card-hover': '0 4px 12px hsl(var(--foreground) / 0.07)',
        button: 'none',
        'button-hover': 'none',
        inner: 'inset 0 2px 4px 0 rgba(0, 0, 0, 0.06)',
        none: 'none',
      },
      transitionDuration: {
        '75': '75ms',
        '100': '100ms',
        '150': '150ms',
        '200': '200ms',
        '250': '250ms',
        '300': '300ms',
        '500': '500ms',
        '700': '700ms',
        '1000': '1000ms',
      },
      zIndex: {
        tooltip: '10',
        popover: '15',
        dropdown: '30',
        header: '40',
        sidebar: '45',
        'modal-backdrop': '50',
        modal: '55',
        toast: '60',
        loading: '65',
        emergency: '9999',
      },
      transitionTimingFunction: {
        // Native app easing curves
        'ease-ios': 'cubic-bezier(0.25, 0.46, 0.45, 0.94)', // iOS standard
        'ease-android': 'cubic-bezier(0.4, 0.0, 0.2, 1)', // Material Design
        'ease-spring': 'cubic-bezier(0.34, 1.56, 0.64, 1)', // Springy
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
