# OrangeCat Branding & Design System

created_date: 2026-06-03  
last_modified_date: 2026-10-11  
last_modified_summary: Every mark is one file, replaced with one command (brand:import); the coil mark; the public fold rebuilt to Loki's and Solon's standard; the studio on the front page and on every studio project's page

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

## Replacing a mark

**Every mark is one file, and replacing it is one command.**

```bash
pnpm run brand:import orangecat path/to/logo.svg      # this app's own mark
pnpm run brand:import loki path/to/loki.svg           # a sibling's
pnpm run brand:import heidi path/to/heidi.svg         # any studio project, by fleet slug
```

Options: `--name "Display name"`, `--motion draw|spin|none` (how it moves in a hero).

That command:

1. converts the SVG to a mark (`src/lib/brand/svg-to-mark.ts`) — geometry kept, colours
   dropped, a full-size background rectangle dropped, every shape stroked or filled with the
   colour the surface hands it;
2. writes `src/config/marks/<slug>.ts`, replacing the old one;
3. rebuilds the registry `src/config/marks/index.ts`;
4. for this app's own slug, regenerates every static icon (`favicon.svg`, `favicon.ico`,
   `apple-icon.png`, the PWA icons, `orange-cat-logo.svg`).

Commit what it wrote. Nothing else changes: the header, the hero, the auth page, share cards,
the studio tiles, the pillars and every studio project's banner render from the registry and
know nothing about which drawing they are showing. A studio project with no mark shows its
initial; giving it a mark is the same command with its fleet slug.

The SVG can come from Figma, Illustrator, Inkscape or an icon set. The importer reads path,
circle, ellipse, rect, line, polyline and polygon; paint from attributes, `style="…"` or simple
`.class` rules; inheritance through groups. It refuses — with a message saying what to do —
transforms, clip paths, masks, `<use>`, `<text>` and `<image>`, because converting those
faithfully needs a real SVG engine and a mark that comes out quietly wrong is worse than a clear
"flatten this first". Exporting as _plain SVG with outlined text and flattened transforms_ always
works.

**Where things live.**

| Piece                       | File                                                             |
| --------------------------- | ---------------------------------------------------------------- |
| What a mark is (data shape) | `src/config/marks/types.ts`                                      |
| One file per mark           | `src/config/marks/<slug>.ts`                                     |
| The registry (generated)    | `src/config/marks/index.ts` — `MARKS`, `markFor(slug)`           |
| Marks drawn by code         | `src/config/marks/generators/` (cat coil, Archimedean coil)      |
| This app's own mark         | `src/config/brand-mark.ts` → `MARKS[APP_SLUG]`                   |
| React                       | `<Mark>`, `<ProjectMark slug>`, `BrandMarkIcon`                  |
| Share cards                 | `BrandMarkSvg` in `src/lib/og/branding.tsx`                      |
| SVG markup + icon style     | `src/lib/brand/mark-svg.ts` (`markSvg`, `iconSvg`, `ICON_STYLE`) |
| Static icons                | `pnpm run generate:brand` (`scripts/generate-brand.mjs`)         |
| The gate                    | `__tests__/unit/config/brand-mark.test.ts`                       |

The gate fails when a mark file is missing from the registry, a mark is not drawable, or a
static icon no longer matches what the generator would write. It is written against _any_ mark,
so replacing the drawing never means rewriting the test.

**Motion.** A mark's file names how it moves when a surface asks (`animated`): `draw` (strokes
draw themselves in, fills fade in, then a slow breath), `spin` (a slow turn — Loki's), or
`none`. Only heroes and showcases ask; chrome-sized marks never move. Reduced motion stills
everything. The classes are `.oc-mark-*` in `globals.css`.

**Generated marks.** OrangeCat's coil and Loki's coil are drawn by functions in
`generators/`, and their mark files call them. Tune one by changing its parameters, then run
`pnpm run generate:brand`. Loki's mirrors bitbaum/loki `src/config/brand-mark.ts` and is kept
in step by hand. Replacing either with a drawn logo leaves its generator in place, ready to
come back.

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

| Layer                   | File                                                                      |
| ----------------------- | ------------------------------------------------------------------------- |
| Name, tagline, URLs     | `src/config/brand.ts`                                                     |
| Marks (one file each)   | `src/config/marks/` — see "Replacing a mark"                              |
| Mark (React)            | `src/components/brand/Mark.tsx`, `ProjectMark.tsx`, `BrandMarkIcon.tsx`   |
| Mark + wordmark         | `src/components/shell/BrandMark.tsx`                                      |
| Header entry            | `src/components/layout/Logo.tsx` → `BrandMark`                            |
| Static assets           | `pnpm run generate:brand`; `pnpm run brand:import` runs it for you        |
| Public fold             | `globals.css` `.oc-public-*`, `src/components/home/sections/`             |
| Studio surfaces         | `src/components/ecosystem/`, `src/components/project/StudioProjectBanner` |
| Cat copy/tabs           | `src/config/cat-hub.ts`                                                   |
| Shell layout heights    | `src/config/layout-chrome.ts`                                             |
| Chat surfaces           | `globals.css` `.oc-chat-*`                                                |
| Page surfaces           | `globals.css` `.oc-page*`, `.oc-surface*`                                 |
| TS button/field recipes | `src/config/design-system.ts`                                             |

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

- [x] One file per mark, one command to replace it, generated static assets, sync test
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
