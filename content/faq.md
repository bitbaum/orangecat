---
title: Frequently Asked Questions
---

<!--
  The questions and answers at /faq. `# Section`, `## Question`, then the
  answer as ordinary markdown until the next heading. {{CAT_FREE_DAILY_LIMIT}}
  and {{CAT_CREDITS_MARKUP_LABEL}} are filled in from src/config/cat-plans.ts,
  so the numbers cannot drift from what Cat actually allows.
-->

# About OrangeCat

## What is OrangeCat?

OrangeCat is your AI economic agent — a platform that lets any person, pseudonym, or organization participate in the full spectrum of economic activity: exchange goods and services, fund projects, lend money, invest, and coordinate together. Bitcoin and Lightning Network are the live settlement rails.

## Who is OrangeCat for?

Anyone who wants to participate in economic activity without gatekeepers. Creators selling their work, researchers seeking funding, communities pooling resources, borrowers and lenders connecting directly, organizations making collective decisions — if you want to exchange value with anyone in the world, OrangeCat is for you.

## Is OrangeCat free to use?

Yes. Creating a profile and using the platform is free, and OrangeCat does not take a cut of Bitcoin or Lightning payments — you send and receive directly. Cat, the AI agent, gives you {{CAT_FREE_DAILY_LIMIT}} free messages a day; beyond that you can add credits, bring your own API key, or run a model on your own machine. See "How Cat runs" for what each of those costs and means.

## What powers Cat, and who pays for it?

Four routes, and you can mix them: OrangeCat's free pool ({{CAT_FREE_DAILY_LIMIT}} messages a day, no setup), Cat Credits ({{CAT_CREDITS_MARKUP_LABEL}}, paid in Bitcoin), your own API key (you pay the provider directly, OrangeCat takes nothing), or a model running on your own computer (nothing leaves your machine). "How Cat runs" explains the trade-offs of each — including what local models are bad at.

## Do I need to use my real name?

No. OrangeCat is pseudonymous by default. You can participate fully — sell, fund, lend, invest — under any identity you choose. Real-name verification is opt-in only, never required.

# Your Cat (AI Agent)

## What is "My Cat"?

"My Cat" is your personal AI economic agent. It understands your context — your projects, services, goals — and acts on your behalf. You can ask it to create projects, draft product listings, find investment opportunities, compose messages, and much more, all in plain language.

## What can the Cat do for me?

Your Cat can:

- Create and manage your economic entities (projects, products, services, causes, loans, investments)
- Draft descriptions, milestones, and terms in your voice
- Search the platform to find relevant opportunities, backers, or collaborators
- Send messages and coordinate with others on your behalf
- Provide context-aware suggestions based on your goals
- Help you understand your funding progress and next steps

## How do I talk to my Cat?

Open the Cat panel from your dashboard (the chat icon in the bottom right). Just type naturally — "Create a project for my open-source library with a 0.1 BTC goal" or "Help me write a description for my consulting service." The Cat understands context and will walk you through anything it needs.

## Is the Cat reading all my data?

The Cat only accesses data you have authorized it to see — your own entities, public profiles you interact with, and conversations you start. It does not access other users' private data. You remain in control; the Cat proposes actions and waits for your confirmation before executing them.

# Economic Activity

## What kinds of economic activity can I do on OrangeCat?

The full economic spectrum:

- **Exchange** — Sell products (physical or digital) and services
- **Fund** — Launch projects with milestone-based accountability, or causes for outright giving
- **Lend** — Offer or take peer-to-peer loans with custom terms
- **Invest** — Equity-style or revenue-share investing without intermediaries
- **Research** — Decentralized science funding and collaboration
- **Coordinate** — Form groups with shared treasuries and collective decision-making

## How do projects work?

Projects are milestone-based funding vehicles. You set a goal, define milestones, and backers fund you knowing exactly what their support will achieve. Funds are tracked transparently. You can post updates and supporters can follow your progress. The Cat can help you structure milestones and write compelling descriptions.

## What is the difference between a project and a cause?

Projects have milestones and accountability — backers expect progress reports and deliverables. Causes are no-strings funding for meaningful purposes — community support, education, environment, or any cause where the act of giving is the goal itself. Both can receive Bitcoin and Lightning payments.

## How do loans work?

Loans connect borrowers and lenders directly. You set the amount, interest rate (or zero for interest-free), repayment schedule, and any collateral terms. OrangeCat records the agreement and tracks repayments. There is no bank in the middle — the agreement is between the two parties.

# Payments & Bitcoin

## Do I need Bitcoin to use OrangeCat?

You can sign up and publish without owning Bitcoin. To receive payments you need a Lightning or Bitcoin wallet. Fiat methods such as Twint and privacy coins are not available now; the roadmap explains the accountability tradeoffs.

## What is the Lightning Network?

The Lightning Network is a payment layer built on top of Bitcoin. It enables near-instant transactions with fees of a fraction of a cent — far cheaper and faster than on-chain Bitcoin. Think of it as Bitcoin's payment rails for everyday transactions. Once you connect a Lightning-capable wallet, your username becomes a Lightning address (e.g. yourname@orangecat.ch) people can pay you at.

## Does OrangeCat hold my Bitcoin?

No. OrangeCat never holds your funds. You add your own Bitcoin address or Lightning wallet address, and payments go directly to you. We record the transaction for transparency, but the money flows directly between sender and receiver without passing through OrangeCat.

## What currencies are displayed?

You can choose your preferred display currency (CHF, USD, EUR, GBP, or Bitcoin) in your profile settings. All amounts are stored in BTC internally for precision, then converted for display using live exchange rates. This means you always see amounts in the currency you understand best.

# Groups & Governance

## What are Groups?

Groups are organizations on OrangeCat with a shared identity, treasury, and governance. A group can have members with different roles, propose and vote on decisions, manage shared funds, and run economic activities collectively. Think DAOs, cooperatives, clubs, or any collective that needs to coordinate.

## What is a Circle?

Circles are lighter-weight communities — less formal than groups, more suited for interest communities, study groups, or loose collaborations. Circles can share a space for discussion and coordination without the full governance machinery of a Group.

# Privacy & Security

## Who can see my activity?

You control visibility. Each entity (project, product, service, etc.) has a visibility setting: public (anyone can see), followers-only, or private (only you). Your profile information is also configurable. Pseudonymous use means you can be fully public without revealing your real identity.

## How is my data protected?

All data is stored in a PostgreSQL database with row-level security — meaning queries are enforced at the database level so one user cannot access another's private data. Authentication is handled by Supabase Auth with industry-standard practices. Passwords are hashed and never stored in plaintext.

## Can I delete my account?

Yes. You can delete your account from Settings. Deletion removes your profile and private data. Public transaction records (for transparency and audit purposes) may be anonymized rather than deleted, as they form part of a shared ledger of economic activity.
