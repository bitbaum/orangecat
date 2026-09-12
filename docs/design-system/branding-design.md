# OrangeCat Branding & Design System

created_date: 2026-06-03  
last_modified_date: 2026-06-03  
last_modified_summary: x.ai-adjacent rebrand — geometric agent-window mark, brand.ts SSOT, neutral primary palette

## Direction

OrangeCat UI follows the same discipline as **FleetCrown** and **x.ai**:

- Near-monochrome surfaces, hairline borders, tight radii
- **One geometric mark** (stroke-based, `currentColor`) — not a mascot illustration
- Warm orange (`--public-accent`, `#ff5c00`) only for rare CTAs
- Tiffany/orange utility classes remain for **sparse** semantic accents (Bitcoin, status), not the logo or primary buttons

## Brand SSOT

| Layer                    | File                                                                               |
| ------------------------ | ---------------------------------------------------------------------------------- |
| Name, tagline, URLs      | `src/config/brand.ts`                                                              |
| Mark geometry (React)    | `src/components/shell/BrandMarkIcon.tsx`                                           |
| Mark + wordmark          | `src/components/shell/BrandMark.tsx`                                               |
| Header entry             | `src/components/layout/Logo.tsx` → `BrandMark`                                     |
| Static SVG (favicon, OG) | `public/favicon.svg`, `public/images/orange-cat-logo.svg` — **same paths, scaled** |
| Cat copy/tabs            | `src/config/cat-hub.ts`                                                            |
| Shell layout heights     | `src/config/layout-chrome.ts`                                                      |
| Chat surfaces            | `globals.css` `.oc-chat-*`                                                         |
| Page surfaces            | `globals.css` `.oc-page*`, `.oc-surface*`                                          |
| TS button/field recipes  | `src/config/design-system.ts`                                                      |

## The mark

**Agent window** — rounded rectangle (workspace), minimal **ear strokes** (Cat without cartoon), **core node** + **two rails** (economic agent / transactions).

Do not reintroduce the pirate-hat cat, kawaii favicon, or filled orange circle.

## Four-layer rule (target state, aligned with FleetCrown)

1. **`:root` / `.dark` in `globals.css`** — raw tokens only
2. **`@theme` / Tailwind config** — maps utilities to vars
3. **`@layer components`** — recurring patterns as `ui-*` / `oc-*` classes
4. **JSX** — semantic classes + layout utilities only; no hex, no one-off palette in new code

FleetCrown uses OKLCH throughout; OrangeCat still uses HSL in `:root` but primary is now **neutral** (not Tiffany). A full OKLCH migration is a follow-up.

## Rebrand checklist

- [x] `brand.ts` + `BrandMark` + static SVGs
- [x] Logo/header uses monochrome wordmark
- [x] Cat toolbar uses `BrandMarkIcon`
- [ ] `pnpm run check:design` equivalent (lint script for raw colors in TSX)
- [ ] Public/marketing pages: dark bands + `ui-public-*` parity with FleetCrown
- [ ] Space Grotesk (optional) — Inter remains default until font pass
- [ ] Deprecate heavy `GRADIENTS.brandTiffany` on marketing CTAs

## Related

- `docs/architecture/CAT_AND_DESIGN_SSOT.md`
- `docs/design-system/README.md`
- FleetCrown reference: `dev/fleetcrown/docs/branding-design.md`
