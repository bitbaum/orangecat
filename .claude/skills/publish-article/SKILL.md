---
name: publish-article
description: Publish a studio article the way George wants it every time — where it goes, the voice, the frontmatter, the media rule, the checks, and how it reaches production. Use whenever asked to write, publish, or post an article, essay, blog post or announcement on OrangeCat, Loki, or another fleet site.
---

# Publish an article

The standing instructions for publishing, so nobody has to repeat them per
article. Voice is SSOT in `bitbaum/loki` → `docs/thoughts-style-guide.md`; the
programme is `docs/architecture/building-in-public-ssot.md` there. This skill
is the PROCEDURE and the per-site facts.

## 1. Where it goes

| Kind of piece | Site | Path | Author line |
| --- | --- | --- | --- |
| Studio / ecosystem essay, economics, strategy, cross-product | OrangeCat blog | `orangecat/content/blog/<slug>.md` | `Cato` |
| Loki-specific: agents, execution, the feedback loop, terminal | Loki Thoughts | `loki/content/thoughts/<slug>.md` | `Loki` |
| Product-specific for another fleet site | that site's blog (evig `content/`, petvity admin blog, substrata `notes`) | per repo | the product's voice |
| A change that shipped | that repo's `CHANGELOG.md` (root) — always, in the same PR | — | — |
| A plan | that repo's `ROADMAP.md` (root) | — | — |

Company voice is never user content: OrangeCat `/articles` is UGC and is not
where the studio publishes.

## 2. Frontmatter

OrangeCat blog (`src/lib/blog.ts` parses it; a post without `title` and
`date` is skipped silently):

```yaml
---
title: 'Title Case, Evocative, Not Clickbait'
excerpt: 'One or two sentences: what it says and why it matters. Used in the feed, previews and SEO.'
date: 'YYYY-MM-DD'
tags: ['Primary Topic', 'Content Type', 'Secondary Topic']   # reuse existing tags; check other posts
featured: false        # at most ONE featured post at a time — unfeature the previous one
author: 'Cato'
published: true
---
```

Loki Thoughts: the block in `docs/thoughts-style-guide.md` (`summary`,
`excerpt`, `publishedAt`, `tags` comma-separated, `readingTimeMin`, `author: Loki`).

## 3. Voice (the short form of the style guide)

- Declarative, systems-first. Mechanism, then consequence. No hedging.
- One earned metaphor, not a parade. Concrete over abstract: the file, the
  number, the real event.
- No hype words, no exclamation marks, no emoji in prose.
- Honest about limits: name what is not built and where it fails.
- Short paragraphs; each section's first sentence can stand alone.
- Lead with the tension or the finding, not background. End on one line
  that compresses the piece.
- Numbers are the ones in the code or the commits; never rounded up.
- Pseudonymous: never the founder's real name.

## 3b. Anyone first, depth on request (stated 2026-10-09)

The prose is for anyone: a reader with no technical background follows it
start to end and finds it interesting. The technical depth — files,
functions, regexes, the exact numbers — goes into closed sections the reader
opens on purpose:

````md
```deep Under the hood: the grammar
Any markdown: paragraphs, tables, mermaid, code.
```
````

Both sites render that fence as a native `<details>` (Loki
`components/thoughts/DeepBlock.tsx`, OrangeCat `lib/longform/DeepBlock.tsx`).
Rules: the piece must read whole with every deep section closed; two to four
deep sections per piece, each titled "Under the hood: <topic>"; a stats block
or a diagram stays in the open prose, a seam table goes inside.

## 4. Media rule

A piece that compares systems, lists seams or describes a pipeline carries at
least one non-prose block: a GFM table, a ` ```mermaid ` diagram, or a
committed SVG. Text-only is a failure mode. Both sites render through
`bip-kit` (`ArticleBody` + `MermaidBlock`); a lone YouTube/Vimeo URL on its
own line embeds; nothing else is an iframe.

## 5. Before the PR

1. Read the last three posts on the target site so tags, tone and length
   match what is already there.
2. Every claim about the product is true on `main` today, or is written as a
   plan. Check the code when unsure.
3. Links resolve. Internal routes come from the site's routes config.
4. Run the repo's verify gate (OrangeCat: `pnpm run lint && pnpm run type-check`
   plus tests; Loki: `pnpm run verify`).
5. Render the page locally or in the build and look at it at 390px wide: no
   sideways scroll, the diagram is readable, the table does not overflow.
6. Add the post to `CHANGELOG.md` only if it announces a shipped change.

## 6. Shipping

Open a non-draft PR. Every fleet repo auto-merges a green PR and deploys it;
a merged PR is not live until the deploy has run — confirm the URL returns
200 and shows the post (OrangeCat: `https://orangecat.ch/blog/<slug>`, Loki:
`https://loki.orangecat.ch/thoughts/<slug>`). Report the live URL, not the PR.

## 7. What George has said he wants (keep this list current)

- Mobile first, short, scannable; the reader "looks and acts". Long walls of
  text are the thing he complains about.
- Build in public: roadmap and changelog on every product, and the article is
  the narrative of what the records say.
- When something does not work, say so in the piece — the record of being
  wrong is part of the product.
- Easy and interesting for anyone, with the extremely technical parts behind
  `deep` sections (3b). Progressive disclosure, not a wall of text and not a
  wall of code.
- Phone first, including diagrams: a Mermaid flowchart goes top-down (`TD`),
  not left-right — six nodes side by side are unreadable at 390px. Check the
  rendered page on a phone, not only in the build.
- Blog and marketing pages are products too: if the index buries the first
  post under filters, fix the index in the same PR.
