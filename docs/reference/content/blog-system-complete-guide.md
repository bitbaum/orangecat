---
created_date: 2025-06-06
last_modified_date: 2026-09-30
last_modified_summary: Rewritten for the current system. Blog and FAQ are markdown files in content/, read by bip-kit 0.5 (readCollection, parseFaq, Faq). The MDX pipeline and gray-matter are gone.
---

# OrangeCat content: the blog and the FAQ

Two public surfaces are plain markdown files in `content/`, reviewed like code
and rendered by [bip-kit](https://github.com/bitbaum/bip-kit), the studio's
shared long-form package. Community articles (`/articles`, stored in the
database) go through the same parser and renderer.

| Surface  | Source              | Reader                                                                   | Page                                                                       |
| -------- | ------------------- | ------------------------------------------------------------------------ | -------------------------------------------------------------------------- |
| Blog     | `content/blog/*.md` | `src/lib/blog.ts` → `readCollection` / `readEntry` from `bip-kit/node`   | `/blog`, `/blog/[slug]`, `/rss.xml`, `/sitemap.xml`, `/api/og/blog/[slug]` |
| FAQ      | `content/faq.md`    | `src/lib/faq.ts` → `parseFaq` from `bip-kit`                             | `/faq`                                                                     |
| Articles | database            | `src/lib/longform/parse.ts` → `normalizeMarkdown` + `parseContentBlocks` | `/articles/[slug]`, composer preview                                       |

## Writing a blog post

Create `content/blog/<slug>.md`. The file name is the URL.

```yaml
---
title: 'Your Post Title'
excerpt: 'One or two sentences for the card, search results and share previews.'
date: '2026-09-30'
tags: ['Platform Updates', 'Bitcoin']
featured: false
author: 'Cato'
published: true
---
```

- `date` must be `YYYY-MM-DD`. Anything else fails the build and names the
  file, so a typo cannot quietly sort a post to the bottom.
- `excerpt` may also be written `summary` or `description`; without one, the
  first paragraph is used.
- `tags` may be one line or wrapped over several (prettier wraps long lists).
- `published: false` (or `draft: true`) keeps the post off every surface,
  including its own URL.
- `readTime` is optional; by default it is computed from the body.
- `author` defaults to "OrangeCat Team".

The body is markdown in bip-kit's vocabulary: headings from `##` down,
lists, quotes, tables, code, images and figures (`![alt](src "caption")`),
callouts, charts and stats fences. `* ` bullets and a body `# h1` are
normalized for you. See the bip-kit README for the full list.

Tag names: [blog-tagging-strategy.md](./blog-tagging-strategy.md).

## Editing the FAQ

`content/faq.md` is one file: `# Section`, then `## Question`, then the answer
as markdown until the next heading. Every question gets a stable id, so
`/faq#is-orangecat-free-to-use` links straight to it.

Numbers that live in code are placeholders, filled in from
`src/config/cat-plans.ts` at build time: `{{CAT_FREE_DAILY_LIMIT}}` and
`{{CAT_CREDITS_MARKUP_LABEL}}`. A misspelt placeholder fails the build. To add
one, add it to `FAQ_VALUES` in `src/lib/faq.ts`.

The page renders the questions as native `<details>` (no client JavaScript)
and emits schema.org `FAQPage` data for search engines. It is prerendered at
build time: the file only changes with a deploy.

## Checks

- `pnpm run check:content` parses every `content/**/*.md` through bip-kit and
  refuses `.mdx` files.
- `__tests__/unit/lib/longform-figure-captions.test.ts` sweeps every post for
  images that would render as text.
- `__tests__/unit/lib/faq.test.ts` checks the FAQ parses into sections and
  that every placeholder is filled.

## Theming

`src/lib/longform/longform.css` maps OrangeCat's design tokens onto bip-kit's
`--bp-*` variables, for every route that renders bip-kit. Import it after
`bip-kit/styles.css`.
