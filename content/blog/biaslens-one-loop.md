---
title: 'BiasLens: News You Can Talk To, Check and Rewrite'
excerpt: 'BiasLens is our truth-seeking reader. The next version is much simpler: your sources in one feed, one page per article, and every claim dug into from first principles. Read it, talk to it, check it, rewrite it.'
date: '2026-11-03'
tags: ['BiasLens', 'Media', 'Truth-seeking', 'Roadmap']
featured: false
author: 'Cato'
published: true
---

[BiasLens](https://biaslens.orangecat.ch) is part of the OrangeCat stack. It reads news the way a careful scientist would. It's also grown too complicated, with examine, investigate, rewrite and a notebook that all sound alike. This post sets out where it's going. **Status: planned.** What's live today is the investigation and rewrite engine underneath.

## One loop

1. **Your feed.** Follow the outlets you actually read: CNN, Fox News, Weltwoche, Republik, NZZ or anyone else. If an article is paywalled we show only its headline, and BiasLens can write its own labelled article from that headline and the evidence.
2. **One paste box** on every screen for a link or text.
3. **One page per article**, with four modes:
   - **Read** the original.
   - **Talk** to it: *explain it*, *dig deeper*, *what's missing?*, *who disagrees?*
   - **Check** claims and gaps from first principles.
   - **Rewrite** it in the style or perspective you choose, always labelled as a rewrite.

## First principles, not vibes

Suppose an article says accidents in Zurich rose by X% and doesn't ask why, or gives weak reasons. BiasLens asks what's missing: more traffic, more cyclists, a change in how accidents are counted. Then it searches for evidence on each and fills the gap.

Or take COVID. Outlets called reliable repeated claims about masks and lockdowns that high-quality studies didn't support. Digging into claims like that, whoever makes them, is the job.

## Choose your bias, and know it

Everyone reads through some lens. With BiasLens you can pick one on purpose: tone, perspective, depth. Tailored articles always say which lens they use and can be flipped to neutral or the opposite view in one tap. That's more honest than trusting an outlet that claims to have no bias.

## Outlets earn their reputation

We won't put a bias score on each article. Outlets build a track record instead, based on how their articles hold up under our public [Open Epistemic Method](https://biaslens.orangecat.ch). The results may not match the usual lists of which sources are reliable. Anyone can check the method.

## Under the hood

RSS and sitemap feeds go into a source registry, and the existing article and PDF extraction stays. AI runs through the shared `@bitbaum` packages: ai-kit, chatkit for conversation, searchkit for evidence, sitekit for navigation. The build plan, prompts and anti-goals are in the BiasLens repository (`docs/plans/2026-11-one-loop.md`).

## Next

Phase 1 is the single article page with the paste box. Chat, the followed-sources feed, chosen lenses and outlet track records come after that. BiasLens will also get profiles on Loki, OrangeCat and Solon.
