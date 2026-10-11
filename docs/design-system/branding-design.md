# OrangeCat Branding & Design System

created_date: 2026-06-03  
last_modified_date: 2026-10-11  
last_modified_summary: The coil mark — one geometry for every asset, generated; the public fold rebuilt to Loki's and Solon's standard; the studio on the front page and on every studio project's page

## Direction

OrangeCat UI follows the same discipline as **Loki**, **Solon** and **x.ai**:

- Near-monochrome surfaces, hairline borders, tight radii
- **One geometric mark** (stroke-based, `currentColor`) — not a mascot illustration
- Warm orange (`--public-accent`, `#ff5c00`) only for rare CTAs
- Tiffany/orange utility classes remain for **sparse** semantic accents (Bitcoin, status), not the logo or primary buttons

## The mark — a coil that is a cat

One continuous stroke, wound from an outer tail at the bottom inward to the centre, with two
ears on the outer turn. It is **Loki's coil wearing the cat**: the two products share a
geometric language (one stroke, one colour, a spiral that pulls the eye in) and differ where
they differ in purpose. The outer turn holds its radius through both ears so the head is
symmetric, then tucks inside its own tail. It reads as a cat at a 16px favicon and as a
hypnotic coil at 220px in the hero.

What it replaced, on 2026-10-11: a cat face in the header, a different "window with ears" on
every share card, and — where `favicon.ico` should have been — a 155 KB fav.farm HTML page
served as `image/x-icon`, so the tab icon had been broken in every browser that prefers `.ico`.
The PWA's 144px icon was one byte. Three marks, one of them not an image, and nothing that
could notice.

**Geometry is code, never a pasted path.** `src/config/brand-mark.ts` is the only source;
everything else renders or generates from it:

| Surface                                     | How it gets the mark                                               |
| ------------------------------------------- | ------------------------------------------------------------------ |
| In-app (`BrandMark`, `Logo`, auth, about)   | `BrandMarkIcon` renders `catCoilPathD()` with `currentColor`       |
| Share cards (`src/lib/og/branding.tsx`)     | `BrandMarkSvg` renders the same path with `OG_COLOR.text`          |
| `public/favicon.svg`, `orange-cat-logo.svg` | written by `pnpm run generate:brand`                               |
| `public/favicon.ico` (16/32/48, PNG-ICO)    | written by `pnpm run generate:brand`                               |
| `public/apple-icon.png`, `public/icons/*`   | written by `pnpm run generate:brand`                               |
| The sync gate                               | `__tests__/unit/config/brand-mark.test.ts` fails on any drift      |

Change the mark by changing the parameters in `brand-mark.ts`, running the generator, and
committing what it wrote. Do not hand-edit an SVG, and do not add a mark anywhere that is not
in the table.

**Animation.** `BrandMarkIcon animated` draws the coil in from its tail once, then breathes —
the hero treatment only (`.oc-brand-coil-animated` in `globals.css`). Chrome-sized marks stay
still: a 22px glyph that moves reads as noise, not brand. Reduced motion disables both.

**The siblings.** `src/config/sibling-marks.ts` mirrors Loki's coil geometry (from
bitbaum/loki `src/config/brand-mark.ts`, kept in step by hand) and `PillarMark` draws each
pillar with its real face — OrangeCat's coil, Loki's coil, Solon's scales — wherever the stack
is presented. Never a generic icon standing in for a product that has a mark of its own.

## The public fold

Home and `/ecosystem` open the way Loki and Solon open: one centred statement in
viewport-relative display type (`.oc-public-hero-title`, two tones), the mark alive above it,
a quiet depth behind it (`.oc-public-backdrop`: two soft radial glows and a dot grid that fades
before the edges — no colour gradients, no imagery), one warm action and one outline action,
then real numbers (`HomePulse`: the same public-only counts `/discover` uses, plus how much of
the studio is live, from Loki's fleet map). Everything is a token, so the fold survives light
mode. The classes are `.oc-public-*` in `globals.css`.

## The studio, everywhere

The products built on this stack are the proof the hero cannot give on its own. They come from
Loki's fleet map (`fetchStudioMapForCat`), never a list kept here:

- **Home** — `StudioSection`: the three pillars with their marks, then every live studio
  product as a tile (`StudioFleetGrid`), each a door to its page here or its live site.
- **/ecosystem** — the pillars, the seams, then the whole fleet grouped by layer.
- **A studio project's own page** — `StudioProjectBanner` above the header: its face, its live
  door, when it last moved, and its sibling pillars. Loki's page on OrangeCat looks like Loki.

The selection and ordering rules are pure (`src/components/ecosystem/studio-fleet.ts`) and
tested. If the map is unreachable the pillars still stand and the grids are simply absent; no
page fails.

## Brand SSOT

| Layer                    | File                                                                   |
| ------------------------ | ---------------------------------------------------------------------- |
| Name, tagline, URLs      | `src/config/brand.ts`                                                  |
| Mark geometry            | `src/config/brand-mark.ts`                                             |
| Mark (React)             | `src/components/shell/BrandMarkIcon.tsx`                               |
| Mark + wordmark          | `src/components/shell/BrandMark.tsx`                                   |
| Header entry             | `src/components/layout/Logo.tsx` → `BrandMark`                         |
| Static assets            | generated by `scripts/generate-brand.mjs` (`pnpm run generate:brand`)  |
| Sibling marks            | `src/config/sibling-marks.ts`, `src/components/ecosystem/PillarMark`   |
| Public fold              | `globals.css` `.oc-public-*`, `src/components/home/sections/`          |
| Studio surfaces          | `src/components/ecosystem/`, `src/components/project/StudioProjectBanner` |
| Cat copy/tabs            | `src/config/cat-hub.ts`                                                |
| Shell layout heights     | `src/config/layout-chrome.ts`                                          |
| Chat surfaces            | `globals.css` `.oc-chat-*`                                             |
| Page surfaces            | `globals.css` `.oc-page*`, `.oc-surface*`                              |
| TS button/field recipes  | `src/config/design-system.ts`                                          |

Do not reintroduce the pirate-hat cat, the kawaii favicon, the cat face, the window-with-ears,
or a filled orange circle.

## Four-layer rule (target state, aligned with Loki)

1. **`:root` / `.dark` in `globals.css`** — raw tokens only
2. **`@theme` / Tailwind config** — maps utilities to vars
3. **`@layer components`** — recurring patterns as `ui-*` / `oc-*` classes
4. **JSX** — semantic classes + layout utilities only; no hex, no one-off palette in new code

Loki uses OKLCH throughout; OrangeCat still uses HSL in `:root` but primary is now **neutral**
(not Tiffany). A full OKLCH migration is a follow-up.

## Checklist

- [x] `brand.ts` + `brand-mark.ts` + `BrandMark` + generated static assets + sync test
- [x] Logo/header uses monochrome wordmark
- [x] Share cards render the same mark as the app
- [x] Public fold: dark-grade depth, display type, live numbers — parity with Loki
- [x] Space Grotesk for display type (`font-heading`)
- [ ] `pnpm run design:check` in CI (it exists; it is not yet a gate)
- [ ] Deprecate heavy `GRADIENTS.brandTiffany` on remaining marketing CTAs

## Related

- `docs/architecture/CAT_AND_DESIGN_SSOT.md`
- `docs/design-system/README.md`
- Loki reference: bitbaum/loki `docs/branding-design.md`
