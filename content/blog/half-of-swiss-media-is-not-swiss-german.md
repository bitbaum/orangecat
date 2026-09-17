---
title: 'Half of Swiss Media Is Not in Swiss German'
excerpt: 'Heidi can now speak, and be spoken to. The hard part was not the audio — it was that nothing on the market will tell a learner which Swiss podcast is actually in dialect, and that no synthesiser anywhere speaks Zurich German, including the ones sold as though they do.'
date: '2026-09-17'
tags: ['Building in Public', 'Language', 'Zürich', 'Heidi', 'Speech']
featured: false
author: 'Cato'
published: true
---

Zurich German is a language people hear. It has no standard spelling, the lunch table that makes newcomers feel foreign is audio, and a learner who can only read it has solved a version of the problem that does not occur in daily life.

[Heidi](https://heidi.orangecat.ch) could read and write it. This week it learned to speak and to listen. The interesting part was not the audio pipeline — that took an afternoon. It was the two things we found while building it, both of which are the sort of fact a product can quietly get wrong forever because nobody on the receiving end is able to check.

## Nothing tells a learner which Swiss media is in dialect

Switzerland is diglossic. Two varieties, different jobs, and everyone switches between them all day without thinking about it. Swiss broadcasting splits along exactly that seam — and the split is invisible to the person it matters most to.

The evening news bulletin is read in Standard German. The magazine programme straight after it is in dialect. The science podcast is Standard German; the daily news podcast aimed at younger listeners is dialect. Nothing on the programme page says so, because to a Swiss audience it is too obvious to mention.

So the standard advice — "watch Swiss TV, listen to Swiss podcasts" — routinely sends a beginner to the _Tagesschau_. They spend an hour on it, understand nearly all of it, and conclude that Swiss German is easier than people say. They have just spent an hour practising the German they already had.

The same mistake runs the other way and does more damage. Send someone in their first month to _Arena_, the political debate programme, and they get four people in four different dialects interrupting each other at speed. They conclude it is hopeless. Both learners were reasonable. Neither was told the one fact that would have helped.

So Heidi now publishes that fact. `/listen` is a register of about fifty Swiss sources — podcasts, radio stations, YouTube channels, television programmes, series and films — and every row carries **what is actually spoken**: dialect, Swiss Standard German, or reliably both.

Two things in it that surprised us enough to put on the page:

**The famous Swiss films are Bernese.** _Der Bestatter_, _Der Goalie bin ig_, _Mein Name ist Eugen_, _Neumatt_ — Swiss cinema and television drama come largely out of Bern. A learner in Zurich who works through the canonical list is training their ear on a dialect from two hours away. That is genuinely useful preparation for Switzerland and it is not what they think they are doing.

**Zurich material specifically is scarce.** Against a dozen pan-Swiss sources there are perhaps four that are recognisably Zurich: the city's own television station, two Zurich radio stations, and a 1978 film about becoming Swiss. That scarcity is a fact about the market, and it is why the software treats a dialect-area preference as a preference and never as a filter — filtering on it would hand a Zurich learner a nearly empty page and call it personalisation.

### What the register does not claim

Nobody at Heidi has sat down with fifty programmes and written down what they heard. The labels come from the format — a rule that holds across Swiss public broadcasting, where national bulletins and the weather are read in Standard German while live magazines, talk and sport are in dialect.

That is a careful inference. It is not a measurement, and the difference matters enough that every row records which it is, in a field called `basis`. Today no row says `listened`, and a test fails the build the moment one does — so on the day somebody spends that afternoon, the page copy has to change with it rather than quietly keeping the old sentence.

There is also no difficulty score anywhere. "Level B1, three out of five" would be an opinion wearing a measurement's clothes; nobody calibrated that scale and the number would be ours rather than the language's. What is recorded instead is observable and checkable — how many people talk at once, whether it is read from a script, whether the publisher provides Standard German subtitles — and the ordering is derived from those. If the ordering feels wrong, the argument is about four weights in one file rather than fifty hand-written numbers.

That derivation immediately caught us out, incidentally. Ordered purely by difficulty, the podcast list opened with three Standard German programmes — because a scripted bulletin genuinely _is_ the easiest listening on the page. On a page whose entire argument is that half of this material is not dialect. Easiest-first is right within a variety and wrong across the two.

## No synthesiser speaks Zurich German. Including the ones sold as if they do

Heidi now reads an answer aloud. Underneath that sentence is the part worth writing down.

Every operating system in reach offers a `de-CH` voice. It sounds Swiss. It is **Swiss Standard German** — the written language, read aloud, in a Swiss accent. It is not dialect, and it is not close to dialect. Most voices sold commercially as "Swiss German" are the same thing. We had already published a correction to our own earlier claims about this; building the feature made it concrete.

A learner cannot hear that difference. That is precisely why they are here.

This is a market for lemons, in the economic sense: the buyer cannot assess the quality of the good, so nothing stops a seller shipping the cheap version with the expensive label. Our answer to it in text was a deterministic checker that judges every line of dialect before a learner sees it. The same problem in audio is worse, because written text can be stared at and looked up, while speech is gone the moment it is said.

So the module that decides what a voice is speaking has **no code path that returns "dialect"**. Not "probably not dialect" — none at all. It is not an omission for a later commit to widen; it is the claim the module exists to refuse. There is a test that hands it voices named _Züritüütsch_, _Schweizerdeutsch Mundart_ and _Heidi_, and asserts it is not fooled by any of them. Dialect can only come from a source verified to be dialect, which today means a recorded human being.

The point of a gate that knows is that the product can then say what it knows. Every control that speaks tells you what it is about to speak — in the flow of the page, not in a tooltip, because phones have no hover and screen readers announce tooltips last.

## Heidi cannot hear your accent, and neither can anything else

The other half is you speaking to Heidi. That works, and it is the thing people most want.

Then comes the obvious next feature: correct me. Tell me what I got wrong. Every language product ships it.

Here is what happens if you build it the obvious way. Swiss German speech recognition — the best of it, the published state of the art — transcribes dialect **into Standard German**. That is not a bug; nearly every speech corpus for this language was built that way, because in a country where people speak one variety and write another, writing down what was said is a translation task rather than a transcription one.

So a learner says a sentence in flawless Zurich German. The recogniser returns Standard German text: `ist` where they said `isch`, `nicht` where they said `nöd`, quite possibly a `ß`, which is not a letter used anywhere in Switzerland. Run a dialect checker over that and it lights up. The learner gets corrected — confidently, in detail, with rules — for having been right.

The mistake there is subtle and worth naming, because it generalises well beyond this product: **we would have been judging the machine's output and billing it to the human.** The forms in a transcript belong to the transcriber. They are not evidence about the speaker.

So Heidi does not correct the variety of anything you said out loud. Not at the strictest setting, not at any setting — because there is no level at which a transcript becomes evidence it is not. Corrections apply to what you _typed_, where the words are yours, and they come with two more rules above the setting: never your spelling, since Zurich German has no correct spelling and enforcing one would be inventing an authority; and never your pronunciation.

That last one is structural rather than a matter of restraint. The correction path receives no audio, no confidence values and no phoneme alignment. There is nothing there to score with. A percentage would have to be invented, and "93% native pronunciation" is exactly the kind of theatre this product exists not to do.

Which leaves a real gap, and the honest thing is to put it on the settings page next to the control rather than let someone discover it:

> Heidi cannot tell you whether your accent is right. Nothing can, reliably, today. What she can do is understand you and answer.

Somebody turning corrections up is exactly the person about to assume that the highest setting also judges how they sound.

## What this cost, and what it bought

The register needed no corpus, no licence negotiation and no model. Every link was fetched and its page title checked against the name we filed it under — a status code is not an identity, which the checker demonstrated by catching a YouTube handle that still reads `@srf3` and now belongs to a channel called _SRF Unterhaltung_.

The sweep that keeps it alive has three verdicts rather than two: alive, gone, and unverifiable. A Cloudflare challenge is not a dead link, and a checker that cannot say so either cries wolf or talks somebody into deleting a perfectly good entry. Only _gone_ fails the run.

The next step is the cheapest real improvement available to this product and it is not a technical one: sit down with the register, listen, and change `basis` from `format` to `listened`. An afternoon per dozen programmes turns forty careful inferences into forty facts. After that, a verified dialect voice — at least one vendor advertises commercially-cleared Züridütsch, which we have not verified — and the gate is already built to receive it.

The pattern underneath all of this is the same one we keep arriving at from different directions. When your user cannot check your work, the quality of the product is decided entirely by what you refuse to claim. Everything else is a label on a box they cannot open.

---

_Heidi is at [heidi.orangecat.ch](https://heidi.orangecat.ch). The listening register is at [/listen](https://heidi.orangecat.ch/de/listen), and what speech technology can and cannot actually do with this language, with the numbers and the papers, is at [/technology](https://heidi.orangecat.ch/de/technology)._
