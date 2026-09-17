---
title: 'A Wallet That Accounts for Itself'
excerpt: "Building in public almost always means showing the code. The money stays private, summarised into a progress bar. Open accounting is the other half: a wallet that publishes what it holds, what moved, and the owner's own explanation of each transaction — opt-in, and only if the numbers are true."
date: '2026-09-17'
tags: ['Bitcoin', 'Transparency', 'Platform Updates', 'Open Accounting']
featured: true
author: 'Cato'
published: true
---

Building in public has a standard shape. The repository is open, the commits are readable, the issues argue with each other where anyone can see. Then there is a funding page, and it shows one number: raised so far, against a goal.

That number is the least informative thing on the page. It tells you money arrived. It does not tell you what happened next — whether it was spent, on what, or whether the project still holds it. The engineering is transparent down to the semicolon and the finances are a progress bar.

Open accounting is the attempt to close that gap on OrangeCat: a wallet that can publish its own ledger — balance, recent transactions, and the owner's note on each one — if its owner chooses to.

## What already holds

Some of this is settled, and worth stating plainly because the rest depends on it.

A wallet on OrangeCat is **non-custodial**. The platform stores an address or an extended public key and watches the chain; it holds no private key and cannot spend. There is no seed phrase in the database, no signing code, nothing to compromise that would move a single satoshi. That is not a policy — it is an absence, which is a much stronger guarantee.

Each wallet now has its own page, so a wallet is something you can link to rather than a card inside somebody's profile. And every figure on it states its provenance: a balance nobody has read shows as an em dash and the words "not checked yet", never as `0.00`.

That last rule sounds pedantic until you meet the alternative. For months, every extended-key wallet on this platform reported exactly `0.00000000 BTC` — because the endpoint the code called had never existed, and a 404 was being turned into a zero. A wallet holding real money looked empty, and the interface stamped a timestamp on it, presenting a number nobody had measured as freshly read from the blockchain. **A confident wrong number is worse than a visible gap**, because the gap invites a question and the wrong number ends it.

## Opt-in, and why that is not timidity

For a plain on-chain address, the balance and history are already public. Anyone holding the address can read both from the chain; publishing them on a web page reveals nothing Bitcoin was hiding.

What is genuinely private is the **join**: *this address belongs to this person, and it is labelled "Monthly Rent"*. Wallets on OrangeCat are labelled by need — rent, food, medical costs, a course someone is saving for. Publishing the ledger publishes the circumstance, and that is the owner's disclosure to make.

So open accounting is off by default and the owner turns it on per wallet. Turning it off hides everything again, notes included. An opt-in switch whose first use is irreversible is not an opt-in switch.

Two details follow from taking that seriously:

- **The extended public key is never published**, switch or no switch. An xpub is not an address; it is the key every address is derived from, and handing one over exposes a wallet's entire past and future address set. The server derives addresses from it and publishes only the resulting ledger.
- **The check lives in the read, not in the page.** The function that loads a public ledger returns nothing at all unless the wallet is live and opted in — so a page that forgot to check cannot leak one. Designs where privacy depends on every caller remembering a rule eventually meet a caller who doesn't.

## The note is the point

A transaction is a number until someone says what it was for.

`+0.0006058 BTC` on a Tuesday is data. "Three supporters covered the December server bill" is accounting. The owner writes one note per transaction — writing again corrects it rather than stacking a second opinion under the same figure — and the note is visible to anyone exactly while the ledger is.

This is the part that makes open accounting different from linking to a block explorer. The chain already tells you what moved. Only the person who moved it can tell you why.

## A score that measures, rather than asks

OrangeCat used to have a transparency score. It was removed, and the reason is instructive: it scored a list of booleans that the caller passed in. The profile card that displayed it hard-coded four criteria to `true` and guessed the rest from whether a bio was longer than fifty characters. It measured profile completeness and called it transparency.

A score worth having is computed from what the platform can **observe** — whether a wallet publishes its ledger at all, how much of its history carries an explanation, how current that explanation is. Not from what anyone declares about themselves. That distinction is the whole difference between a measurement and a badge, and it is the thing being rebuilt now.

## What is not built

Smart contracts belong here eventually — programmable conditions on money, so that escrow, milestone release and recurring commitments are enforced rather than promised. That is a later stage, and saying so is more useful than implying it exists. Open accounting has to be real first: a contract that releases funds on a milestone is only as trustworthy as the ledger everyone is reading.

## Why this sits beside the code

The argument for building in public is that visible work is checkable work. Anyone can read the commit and find the bug. Money deserves the same treatment, and it almost never gets it, because financial transparency is uncomfortable in a way that code transparency is not: a repository shows what you built, a ledger shows what you chose.

That is exactly why it is worth having. A project that publishes its ledger is making a claim that can be checked against the chain by a stranger, which is the only kind of claim worth making.

The progress bar says money arrived. The ledger says what you did with it.
