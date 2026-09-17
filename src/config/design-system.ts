/**
 * Design system SSOT for shared visual classes.
 *
 * The product direction is deliberately sparse and x.ai-adjacent: mostly
 * neutral surfaces, hairline borders, tight radii, quiet motion, and selective
 * OrangeCat/Tiffany accents only where they carry meaning or action.
 */

export const UI_TOKENS = {
  radius: {
    control: 'rounded-md',
    surface: 'rounded-md',
    pill: 'rounded-full',
  },
  border: {
    subtle: 'border border-default',
    strong: 'border border-strong',
  },
  surface: {
    base: 'bg-surface-page text-fg-primary',
    panel: 'bg-surface-base text-fg-primary',
    muted: 'bg-surface-raised/40 text-fg-primary',
    inverse: 'bg-fg-primary text-fg-inverted',
  },
  shadow: {
    none: 'shadow-none',
    raised: 'shadow-none',
  },
  focus:
    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
  transition: 'transition-colors duration-150',
} as const;

export const COMPONENT_STYLES = {
  button: {
    base: [
      'inline-flex items-center justify-center gap-2 whitespace-nowrap',
      UI_TOKENS.radius.control,
      'font-medium',
      UI_TOKENS.transition,
      UI_TOKENS.focus,
      'disabled:pointer-events-none disabled:opacity-50',
      'touch-manipulation select-none',
    ].join(' '),
    variants: {
      primary: 'bg-fg-primary text-fg-inverted hover:bg-muted-strong',
      secondary: 'bg-surface-raised text-fg-primary hover:bg-surface-raised',
      ghost: 'text-fg-primary hover:bg-surface-raised hover:text-fg-primary',
      danger: 'bg-status-negative text-fg-inverted hover:bg-status-negative/90',
      outline: 'border border-strong bg-transparent text-fg-primary hover:bg-surface-raised',
      gradient: 'bg-fg-primary text-fg-inverted hover:bg-muted-strong',
      // Migration commit 3/N: warm-accent CTA per Loki — the single
      // chromatic color reserved for top-of-funnel conversion ("Start
      // Creating", "Get Started", "Sign Up"). Everything else stays
      // monochromatic.
      accent: 'bg-accent-warm text-on-accent hover:bg-accent-warm-hover',
    },
    sizes: {
      sm: 'h-9 min-h-9 px-3 text-sm min-w-16',
      md: 'h-10 min-h-10 px-4 text-sm min-w-24',
      lg: 'h-11 min-h-11 px-5 text-base min-w-28',
      xl: 'h-12 min-h-12 px-6 text-base min-w-32',
    },
  },
  iconButton: {
    base: [
      'inline-flex h-10 w-10 min-h-10 min-w-10 items-center justify-center',
      UI_TOKENS.radius.control,
      UI_TOKENS.transition,
      UI_TOKENS.focus,
      'touch-manipulation select-none',
    ].join(' '),
    variants: {
      ghost: 'text-fg-primary hover:bg-surface-raised hover:text-fg-primary',
      outline: 'border border-default bg-surface-base text-fg-primary hover:bg-surface-raised',
      inverse: 'bg-fg-primary text-fg-inverted hover:bg-muted-strong',
    },
  },
  card: {
    base: [
      UI_TOKENS.surface.panel,
      UI_TOKENS.radius.surface,
      UI_TOKENS.border.subtle,
      UI_TOKENS.shadow.none,
    ].join(' '),
    variants: {
      default: '',
      elevated: 'bg-surface-base',
      minimal: 'bg-transparent shadow-none',
      gradient: 'bg-surface-base',
    },
  },
  field: {
    label: 'block text-sm font-medium text-fg-primary',
    description: 'text-sm text-fg-secondary',
    errorText: 'text-sm text-status-negative',
    required: 'ml-1 text-status-negative',
    control: [
      'w-full border border-default bg-surface-base text-fg-primary',
      UI_TOKENS.radius.control,
      'placeholder:text-fg-tertiary',
      UI_TOKENS.transition,
      'focus:border-interactive focus:outline-none focus:ring-2 focus:ring-ring/20',
      'disabled:cursor-not-allowed disabled:opacity-50',
    ].join(' '),
    errorControl:
      'border-status-negative focus:border-status-negative focus:ring-status-negative/20',
  },
  badge: {
    base: [
      'inline-flex items-center gap-1 border px-2 py-0.5 text-xs font-medium',
      UI_TOKENS.radius.control,
      UI_TOKENS.transition,
      UI_TOKENS.focus,
    ].join(' '),
  },
  accent: {
    text: 'text-fg-primary',
    surface: 'bg-fg-primary text-fg-inverted',
    hairline: 'bg-fg-primary/60',
  },
} as const;
