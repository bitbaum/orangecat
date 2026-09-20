---
title: 'What Cat Costs, and Why You Cannot Pay Us Yet'
excerpt: "Cat runs on four different engines and only two of them ever involve OrangeCat's money. Here is the full economics — the free pool's real ceiling, what credits actually cost, and why the checkout is deliberately switched off."
date: '2026-09-20'
tags: ['Cat', 'Economics', 'Platform Updates', 'Sovereignty']
featured: true
author: 'Cato'
published: true
---

OrangeCat has prices now. You can read them, compare them, and work out what Cat would cost you. What you cannot do is pay us, because the checkout is switched off on purpose.

This post is the reasoning behind both halves of that sentence.

## Four engines, not four plans

Cat is an AI agent, and something has to pay for the thinking. There are four ways that happens, and they are routes rather than tiers — you can hold all of them at once.

**The free pool.** Ten messages a day, no setup, running on OrangeCat's own provider accounts. This is what you get by existing.

**Cat Credits.** Prepaid Bitcoin, spent on frontier models, charged at provider cost plus 40% at the exchange rate of the moment you spend. No card and no subscription.

**Your own API key.** You pay Anthropic or OpenAI or whoever directly, at their price. OrangeCat takes nothing and never sees the bill.

**A model on your own computer.** Ollama or LM Studio on the same machine as your browser. The conversation never leaves the building. It costs electricity.

Two of those four send us no money at all, and we wired them anyway — including, this week, direct Anthropic support, so a Claude key now works on its own instead of having to be laundered through an aggregator.

That is not altruism. It is the shape of the business. OrangeCat earns from economic activity on the platform, not from marking up your AI bill, so a user who brings their own key is not a lost sale. They are a user whose thinking costs us nothing.

## The free pool's real ceiling

Here is the number nobody expects.

The obvious way to reason about a free tier is multiplication: ten messages times however many users. That is the wrong axis. Our providers ration by **tokens per minute**, and Cat trims every prompt to fit inside an 8,000-token window. One request is most of one minute's allowance on one model. Across the pool, that is roughly three and a half requests per minute — for everybody, everywhere, at once.

And one message is not one request. Cat runs a tool loop: it thinks, calls something, reads the result, thinks again. A single "publish this draft for me" can be three round trips.

So the free pool does not fail at some large number of messages per day. It fails the first time ten people open Cat in the same minute. That happens at a few dozen active users, not a few hundred.

The interesting consequence is where the fix lives. Rationing messages harder buys almost nothing — it is the wrong constraint. Halving the size of Cat's prompt roughly doubles how many people can be served at once, _and_ gives Cat more room to remember what you said. The capacity problem and the quality problem have the same solution, which is a pleasant thing to discover and not at all what we assumed going in.

## Why the checkout is off

OrangeCat is not yet a registered company.

That is the entire reason, and it is not a technicality we are routing around. A business that cannot issue an invoice should not be taking money, and "we'll sort the paperwork out after the first payment clears" is how you end up owing several people a refund and an apology.

So the prices are real, the ledger is built, the Lightning plumbing works and has been tested end to end — and the last step refuses. If you reach the top-up screen you get a sentence explaining why, not a spinner and a shrug.

We also made the refusal structural rather than cosmetic. Until this week the only thing standing between OrangeCat and your money was a check for whether a receiving wallet happened to be configured. That is an infrastructure question standing in for a legal one — configure a wallet to test something, and the till opens as a side effect. Nobody would decide that. It would just happen.

Now there is one explicit switch, it is off unless someone deliberately sets it on, and every path that takes money for OrangeCat is refused behind it on the server. A missing environment variable, a typo, a new deploy target with a half-copied config: all of those mean closed. We picked the direction of that failure on purpose, because taking money we are not allowed to take is the expensive mistake and turning away money we could have had is the cheap one.

One exception, deliberately carved out: an invoice already paid still credits. Closing a till must never strand money somebody has already sent. Refusing to honour a payment already made would be a worse failure than the one the switch exists to prevent.

## What is not affected

Paying other people on OrangeCat. That was never part of this and never will be.

When you fund a project, buy someone's listing, or settle a loan here, the money goes from you to them, over Bitcoin, at zero percent. It does not pass through us, we do not take a cut, and there is nothing for us to switch off. That is the product. The paid Cat plans are a service we sell on top of it, and only the service is waiting on the paperwork.

It is worth being explicit about this because "OrangeCat cannot take payments yet" is a sentence that could easily be misread as "payments are broken." They are not. The half that matters most has been working all along.

## What happens next

The company gets registered. Then one environment variable changes and the prices you can already read start working.

Between now and then, everything free keeps running, bringing your own key costs you nothing extra and gives you frontier models today, and we will keep publishing the economics as we work them out — including the parts we got wrong. The token-per-minute ceiling was one of those. We assumed the free tier would strain on volume. It strains on simultaneity, which is a different problem with a different fix, and we only found out by going and measuring it.

The full breakdown of what each route costs, where your words go, and what each one is bad at lives at [How Cat runs](/docs/how-cat-runs). The "bad at" column is not marketing copy. Local models, for instance, are genuinely weak at tool calling — which is most of what makes Cat useful — so Cat on your own laptop will chat with you happily and then struggle to actually do the thing you asked. You should know that before you choose it, and you will not find it out from us at the point where it disappoints you.
