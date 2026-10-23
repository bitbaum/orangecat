---
title: 'Every Law on the Books'
excerpt: 'Switzerland and Liechtenstein publish their laws well, in about forty places. We are putting every one of them in one open register, as the publisher wrote it, with a hash to prove the copy. Here is the size of it, measured, what is already in, and what is not.'
date: '2026-10-22'
tags: ['Governance', 'Solon', 'Building in Public', 'Under the Hood']
featured: false
author: 'Cato'
published: true
---

If you want to know what binds you, you should be able to read it. In Switzerland you can, if you know that the Code of Obligations is on the Confederation's site, that the rent rules of Zürich are on the canton's, and that your commune has its own regulation somewhere else.

The law is public. It is not in one place, and that is the problem we are working on.

## The goal

Every law and every regulation in force in every authority of Switzerland and Liechtenstein: the Confederation, the 26 cantons, Liechtenstein and, in the end, the communes. Stored as the publisher published it, with who enacted it, from when to when it was in force, and a hash that proves the copy is the publisher's. Served openly, so that any app and any person can read it.

Tax law came first, as a model of how a place taxes income. That is a model of one law. This is the law.

## How big it is

We counted on 23 October 2026, from the registers themselves.

| Authority | Acts in force | Listed in Solon |
| --- | ---: | --- |
| Confederation | 5,339 | yes |
| The 26 cantons and the intercantonal agreements | 16,708 | yes |
| Liechtenstein | 3,407 | yes |
| About 2,100 communes | not counted | no |

That is 25,454 acts in force, and 11,394 more that the Swiss registers list as no longer in force. The number to watch is the live one on [Solon's coverage page](https://solon.orangecat.ch/en/law/coverage), counted from the data, not typed into this post.

Earlier we reported Fedlex's own register as 13,257 entries against 6,771 federal acts including repealed ones, and did not know why. Reading it properly explains part of it: Fedlex also lists the Official Compilation's entries under the same numbers as the consolidated acts, and those are not acts in force. For the day we read it, the consolidated acts applying number 5,331, against the 5,339 the register says are in force, and every one of them is in the register.

## Where it stands

```mermaid
flowchart TD
  L0["Register of what exists<br/>done: 36,848 acts"] --> L1["Federal text<br/>5,330 acts loaded"]
  L1 --> L2["Liechtenstein text<br/>loading"]
  L2 --> L3["Cantons, one publisher at a time<br/>Zürich has its own reader"]
  L3 --> L4["History: any date"]
  L4 --> L5["Communes"]
  L1 --> L6["Causius reads it from Solon<br/>done for federal acts"]
```

| Step | State today |
| --- | --- |
| Register of what exists | Done for the Confederation, the cantons and Liechtenstein |
| Federal text | Loaded, article by article, with the publisher's page and a hash for each |
| Liechtenstein text | Loading; Lilex does not say when a version took effect, so each is dated by the day we read it, and says so |
| Cantonal text | A first pass by document is built; Zürich now reads the canton's own collection with the canton's dates; the other 25 cantons need theirs |
| History | Not built |
| Communes | Not started, and not yet decided |
| Causius reads it | Federal acts and Liechtenstein's common ones, with the publisher as fallback |

Each step ships alone and its coverage is a number on a page. Nothing is described as covered that the page does not count.

## What it will not do

It will not interpret, summarise or translate as law. A summary is a different thing with a different label. If a copy ever stops matching its publisher, the reader is sent to the publisher, and the publisher wins.

```deep Under the hood: the data model
An act is a stable work: who enacted it, what kind it is (constitution,
statute, ordinance, regulation, treaty, decree), and the identifiers it goes
by, because one act has many: the federal systematic number, the cantonal
number, the Liechtenstein one, and the index's own.

A version is one consolidated text in one language, in force from one date to
another, with the publisher's URL and the sha256 of the bytes we fetched, and a
flag that says whether it is the authentic publication or a consolidated
reading. A provision is one article of a version, so an article is one lookup.
Nothing is deleted: a repealed act stays, with the date it ended.

Where an act applies is not stored. It applies in the place that enacted it and
in every place inside it, and the place chain answers that.
```

```deep Under the hood: reading publishers kindly
Each publisher is read by its own reader. Fedlex gives versions and dates by
query and the text by file. The cantons are taken one publisher at a time, with
LexFind as the register of what exists, because a PDF loses structure: margin
notes run into headings and words are hyphenated.

Liechtenstein's host answers a burst of requests with a proof-of-work page. We
do not get around it. We slow down, cache what we have, and fetch less. Every
reader identifies itself, limits its rate, and keeps snapshots so that nothing
is fetched twice.
```

```deep Under the hood: what is licence and what is service
Acts and official decisions are not protected by copyright in Switzerland
(Article 5 of the copyright act) nor in Liechtenstein. An index or a text
extraction by a third party is a service, with terms of its own. Before any bulk
import from LexFind we read them, or take each canton's own publication
instead.
```

It is built in public and the code is open. Anyone can start their own.

The law is public. It should also be findable.
