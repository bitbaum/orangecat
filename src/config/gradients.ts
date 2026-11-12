/**
 * Gradient Classes — SSOT for reusable Tailwind gradient strings.
 *
 * Product rule: gradients are rare. Most historical keys resolve to neutral
 * surfaces so older page code stays compatible while the app moves to a
 * quieter x.ai-like aesthetic. Use the brand and Bitcoin keys only when the
 * accent is semantically useful.
 *
 * Usage: `className={GRADIENTS.brandOrange}` or
 *        `className={cn(GRADIENTS.brandOrange, 'other-classes')}`
 *
 * A solid fill carries its ink. `bg-fg-primary` is near-black in light and
 * near-white in dark, so a caller that appended `text-white` drew white on
 * near-white for every dark-theme visitor. Never add an ink class next to one
 * of these keys; check:accent-ink fails the build if you do.
 */

const INK_FILL = 'bg-fg-primary text-fg-inverted';
const INK_BUTTON = `${INK_FILL} hover:bg-muted-strong`;

export const GRADIENTS = {
  // ── Right-direction gradients ─────────────────────────────────────────────
  brandOrange: INK_FILL,
  brandOrangeDark: INK_FILL,
  brandMixed: INK_FILL,
  brandTiffany: INK_FILL,
  brandTiffanyDark: INK_FILL,
  brandPrimary: INK_FILL,
  brandOrangeAmber: INK_FILL,
  brandGreen: INK_FILL,
  brandBlue: INK_FILL,
  brandRose: 'bg-status-negative text-fg-inverted',
  brandRoseDark: 'bg-status-negative text-fg-inverted',

  // ── Section / card background tints ───────────────────────────────────────
  sectionClean: 'bg-surface-page',
  sectionSubtle: 'bg-surface-raised/30',
  sectionAlt: 'bg-surface-raised/50',
  sectionGreen: 'bg-surface-raised/30',
  sectionOrangeTiffany: 'bg-surface-raised/30',
  sectionTiffanyMuted: 'bg-surface-raised/30',
  iconOrangeTiffany: 'bg-surface-raised',
  sectionGrayOrange: 'bg-surface-raised/30',
  sectionOrangeWarm: 'bg-surface-raised/30',

  // ── Icon circle/badge gradients (diagonal, for icon backgrounds) ──────────
  iconBlue: INK_FILL,
  iconOrange: INK_FILL,
  iconTiffany: INK_FILL,
  iconGreen: INK_FILL,
  iconTiffanyLight: 'bg-surface-raised',

  // ── Card background section tints (diagonal) ──────────────────────────────
  sectionBlueCyan: 'bg-surface-raised/30',
  sectionAmberOrange: 'bg-surface-raised/30',
  sectionOrangeTiffanyBr: 'bg-surface-raised/30',
  sectionGreenEmerald: 'bg-surface-raised/30',

  // ── Diagonal (br) gradients ───────────────────────────────────────────────
  brandOrangeBr: INK_FILL,
  brandOrangeCircle: INK_FILL,
  brandOrangeLightBr: 'bg-surface-raised',
  brandTiffanyBr: INK_FILL,
  grayLight: 'bg-surface-raised/30',
  graySubtle: 'bg-surface-raised/20',
  heroSection: 'bg-surface-page',
  heroOrangeTiffany: INK_FILL,
  brandOrangeYellow: INK_FILL,
  brandMixedBr: INK_FILL,
  iconTiffanyOrange: INK_FILL,
  tiffanyMuted: 'bg-surface-raised',
  sectionOrangeAmber: 'bg-surface-raised/30',
  sectionTiffanyOrange: 'bg-surface-raised/20',
  sectionGrayWhite: 'bg-surface-page',

  // ── Overlay gradients (dark overlays over images) ───────────────────────
  overlayDarkBottom: 'bg-black/40',

  // ── Page background gradients (full-bleed wrappers) ───────────────────────
  pageBgOrangeDown: 'bg-surface-page',
  pageBgTiffanyDown: 'bg-surface-page',
  pageBg: 'bg-surface-page',
  pageBgSolid: 'bg-surface-page',
  pageBgFrost: 'bg-surface-page',
  pageBgOrange: 'bg-surface-page',
  pageBgBlue: 'bg-surface-page',

  // ── Bitcoin gradients (only for Bitcoin-related UI) ──────────────────────
  brandBitcoin: 'bg-bitcoinOrange text-on-accent',
  progressBitcoin: 'bg-bitcoinOrange',
  btnBitcoin: 'bg-bitcoinOrange text-on-accent hover:bg-bitcoinOrange/90',

  // ── Button combos (base + hover, always used together) ───────────────────
  btnOrange: INK_BUTTON,
  btnOrangeDark: INK_BUTTON,
  btnPrimary: INK_BUTTON,
  btnGreen: INK_BUTTON,
} as const;

export type GradientKey = keyof typeof GRADIENTS;
