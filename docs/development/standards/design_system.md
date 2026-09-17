# OrangeCat Design System Standard

The product UI should feel like it belongs beside x.ai: sparse, precise,
neutral-first, and calm. OrangeCat keeps its orange and Tiffany colors, but
they are accents, not the page background language.

## Source of Truth

- Shared visual class tokens live in `src/config/design-system.ts`.
- Semantic badge and stat colors live in `src/config/badge-colors.ts`.
- Legacy reusable gradient names live in `src/config/gradients.ts`; most should
  resolve to neutral surfaces.
- Global CSS variables and base element rules live in `src/app/globals.css`.
- Tailwind scale decisions live in `tailwind.config.ts`.

Do not create a second local design system inside a page or feature folder.
Extend these files when a reusable visual decision is missing.

Run `pnpm run design:check` before shipping UI changes. The check blocks the
legacy classes that caused the system to drift: page gradients, oversized
radii, heavy shadows, hard-coded white/gray colors, and non-semantic focus
colors.

## Visual Rules

- Use neutral backgrounds first: `bg-background`, `bg-card`, `bg-muted`, borders.
- Use orange for OrangeCat/Bitcoin/action emphasis, and Tiffany for primary app
  accents. Avoid using both in the same small component unless the component is
  intentionally brand-signaling.
- Prefer borders over shadows. Shadows should be rare and subtle.
- Cards and controls stay at 8px radius or below.
- Avoid decorative gradients, tinted page bands, nested cards, and large rounded
  marketing panels in app surfaces.
- Use fixed typography sizes from Tailwind tokens. Do not introduce viewport
  width based font sizing.
- Keep letter spacing at `0`.

## Component Rules

- Use `src/components/ui/Button.tsx` for buttons and links styled as buttons.
- Use `Card` only for repeated items, modals, and genuinely framed tools.
- Use `Input`, `Textarea`, and `Select` for form controls so field styling,
  focus, error, label, and description states stay aligned.
- Use `Badge` plus `BADGE_COLORS` for status chips; do not hard-code ad hoc pill
  colors in page files.

## Page Review Checklist

- Page background is neutral and not a gradient.
- Primary action is visually obvious without multiple competing accent colors.
- Repeated surfaces use the shared `Card` treatment or an unframed layout.
- Borders, radius, focus states, and field heights match shared primitives.
- No page-specific shadow scale, radius scale, or custom color ramp was added.
- Empty, loading, error, and disabled states use the same component language as
  the main state.
