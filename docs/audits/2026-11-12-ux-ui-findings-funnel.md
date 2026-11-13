# UX/UI audit 2026-11-12 — Landing page and marketing funnel

The open findings for this area from [the audit](2026-11-12-ux-ui-audit.md), each with its cause and the fix a second reviewer checked. File and line references are as of commit `0275875` (2026-11-12); locate by content.

### funnel#2 · medium · A first-time visitor who taps the hero action or any 'Start' is greeted with 'Welcome back, sign in'

**Status:** Fixed (fourth pull request).

- **Where:** /, /what-you-can-do, /how-it-works, /pricing (both, both themes)
- **What a person meets:** The two orange buttons in the first viewport open two different forms, and the one the hero promotes addresses a newcomer as a returning user at the conversion step. The 'Start instantly, no email' button softens it, but the heading tells the person they are in the wrong place.
- **Cause:** src/components/home/sections/HeroSection.tsx:52, src/components/home/sections/ProblemsSection.tsx:39, src/middleware.ts:93 and :121
- **Fix:** Ship now: HeroSection.tsx:52 and ProblemsSection.tsx:39 use href={ROUTES.AUTH_REGISTER} (the constant exists at routes.ts:387). Separate change, coordinated with the auth surface: in middleware.ts compute once 'const hadSession = request.cookies.getAll().some(c => /^sb-.+-auth-token(\.\d+)?$/.test(c.name));' and at :93 and :121 set mode to hadSession ? 'login' : 'register'; from= untouched. Add two cases to **tests**/unit/middleware.auth.test.ts (no cookie gives mode=register; an sb-x-auth-token cookie with no valid user gives mode=login). Known cost to state to the owner: a returning person who signed out (cookie cleared) sees 'Get started' with 'Already have an account?' under the form.

### funnel#3 · medium · Home on a phone: 4,112px of other studio products sit between the hero and what OrangeCat does for you

**Status:** Fixed (fourth pull request).

- **Where:** / (phone, both themes)
- **What a person meets:** The hero promises ways to earn; the next six screens are a directory of unrelated products such as a pet-care platform and a clinic portal. The concrete answer ('Tell your Cat what you can do. It writes the service page, sets a price and gives you one link to share') is reached only by people who scroll past all of it.
- **Cause:** src/components/home/sections/StudioSection.tsx:22 and :76 (all 15 tiles, pillars included, in a one-column grid below sm: src/app/globals.css:749-751)
- **Fix:** Keep the section order. StudioSection.tsx:22: 'const live = selectHomeFleet(map); const tiles = live.filter(t => !t.pillar).slice(0, 6);' (do not change selectHomeFleet, it is tested). Line 72 label: `All ${live.length} live products` (href stays ROUTES.ECOSYSTEM). Update the doc comment at :10-18 to say six are shown and the rest are one tap away. Result measured at 390: studio band 2,290px, 'What it solves' starts at 3,212 instead of 5,034. Offer the swap of HomePublic.tsx lines 20-21 (problems would start at 922px) to the owner as an option, not as part of this change.
- **Mind:** The proposed swap reverses the order documented in HomePublic.tsx:6-15; not a fleet rule, but an owner decision recorded in code.

### funnel#4 · medium · 'How it works' never says how it works, and half of it repeats another page

**Status:** Fixed (fourth pull request).

- **Where:** /how-it-works (both, both themes)
- **What a person meets:** The visitor who asked for an explanation gets filler, then a second copy of the capability catalogue, and reaches the sign-up action after about eleven screens. The page does not answer its own title.
- **Cause:** src/app/(public)/how-it-works/page.tsx:1, :52-62, :76, :118, :145, :171-199 and src/config/landing-page.ts:280
- **Fix:** page.tsx: delete line 1 ('use client'; Card, Button, CapabilityMap have no client directive). landing-page.ts:280 title -> 'How it works'. page.tsx:52-62 -> &lt;PageHeading>{howItWorks.title}&lt;/PageHeading> and &lt;p className="mx-auto mt-4 max-w-2xl text-lg text-fg-secondary">{howItWorks.subtitle}&lt;/p>, no pill, drop the Sparkles pill import use. Line 68 h2 -> 'Four steps' (sentence case); step titles in landing-page.ts to sentence case verbs, wording approved by the owner. Remove oc-card-link at :76 and :145. Delete :190-200 ('Need more help?'). Line 118: replace with seven rows from INTENT_LIST plus 'Decide' as links to `${ROUTES.WHAT_YOU_CAN_DO}#do-${intent.id}` (className 'oc-list-row flex min-h-11 items-center justify-between gap-3', title + intent.how + ChevronRight) and then remove the compact prop and its doc from CapabilityMap.tsx; if the owner wants the map kept, leave …
- **Mind:** Replacing &lt;CapabilityMap compact /> contradicts the intent documented at CapabilityMap.tsx:6-7; an accent sign-up band here must not render for signed-in visitors (AGENTS.md One orange: in-app actions are monochrome).

### funnel#6 · medium · Pricing: orange is a border, a 'not open yet' badge and three buttons, and the warm action is on the wrong plan

**Status:** Fixed (fourth pull request).

Status: Partly (#1634): the card and badge are neutral; the action on the wrong plan is open.

- **Where:** /pricing (both, both themes)
- **What a person meets:** Orange stops meaning 'start here': it marks plans that cannot be bought, and the one warm button asks a newcomer for an API key instead of offering the free plan. The light-theme badges are hard to read.
- **Cause:** src/app/(public)/pricing/page.tsx:69, :94-107, :137, :141; src/config/cat-plans.ts:179, :222; src/app/globals.css:95
- **Fix:** page.tsx:135-138: always 'border-default' (drop the hasBadge branch). :141 badge: 'absolute -top-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border border-default bg-surface-raised px-3 py-1 text-xs font-medium uppercase tracking-caps text-fg-secondary' (6.38:1 dark, 5.27:1 light), with a 'h-1.5 w-1.5 rounded-full bg-status-positive' dot only when plan.status === 'available'. :94 band: 'mb-12 rounded-lg border border-default bg-surface-base p-8 text-fg-primary' (same frame as the section at :58); :96 icon text-fg-secondary; :107 variant="primary". :69 'two' -> 'three'. :98 h2 add 'hyphens-none text-balance' (or remove globals.css:95, see missed item). PlanCard root: add 'lg:row-span-4 lg:grid lg:grid-rows-subgrid lg:gap-y-0'. Accent placement, as an owner option: cat-plans.ts:179 variant 'accent' and :222 'outline', and rewrite the comment …
- **Mind:** Moving the accent from BYOK to Free reverses the decision documented at pricing/page.tsx:28-29; it is consistent with AGENTS.md 'One orange'.

### funnel#7 · medium · Six sibling pages, six page-header frames

**Fixed in the second pull request** (see "Second batch" in the audit). The cause and fix below are kept as the record.

- **Where:** /how-it-works, /what-you-can-do, /pricing, /about, /faq, /ecosystem (both, both themes)
- **What a person meets:** Moving between pages of one site feels like moving between sites, and on three of them the title does not outrank the text under it on a phone.
- **Cause:** src/app/(public)/how-it-works/page.tsx:56, src/app/(public)/about/page.tsx:21, src/app/(public)/ecosystem/page.tsx:79-84, src/app/(public)/faq/page.tsx:17 and :21, src/app/(public)/pricing/page.tsx:37-41, src/components/map/CapabilityMap.tsx:84
- **Fix:** Do not touch PageHeading.tsx. Use &lt;PageHeading> for the h1 on how-it-works (:56-58), about (:21-23) and ecosystem (:82-84), each followed by one lede 'mx-auto mt-4 max-w-2xl text-lg text-fg-secondary'; header wrapper on the five centred pages 'mx-auto max-w-3xl px-4 py-12 text-center sm:py-16' with no raised band (drop 'bg-surface-base border-b' on about :18 and ecosystem :77). Delete: how-it-works pill (:52-55), pricing CatIcon block (:37-39) and its import, ecosystem owner pill (:79-81), faq 'pt-20' (:17). Ledes at pricing:41 and faq:21: text-xl -> text-lg. Fix the heading inversion where it is: CapabilityMap.tsx:84 and what-you-can-do/page.tsx:63 'text-2xl' -> 'text-xl sm:text-2xl'. Leave what-you-can-do left-aligned as the one documented exception (it is an app page too).
- **Mind:** Changing PageHeading's responsive scale conflicts with its own contract (PageHeading.tsx:5 'Never override the responsive scale') and would move the h1 of MoneyPage, the 'One shape per kind' reference frame in AGENTS.md.

### funnel#8 · medium · One action, six names; closing bands differ and one page ends by sending the visitor to another product

**Status:** Fixed (fourth pull request).

- **Where:** /, /how-it-works, /what-you-can-do, /pricing, /about (both, both themes)
- **What a person meets:** The visitor cannot tell whether these are one action or six, and the page built for people without an account ends by sending them to a different product.
- **Cause:** src/app/(public)/how-it-works/page.tsx:171-178, src/app/(public)/about/page.tsx:86-103, src/components/home/sections/ProblemsSection.tsx:33-47 (no shared, auth-aware closing band)
- **Fix:** New client component src/components/public/ClosingBand.tsx: 'oc-surface flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:p-6', one sentence prop, then by useAuth(): signed out (or not hydrated) -> &lt;Button href={ROUTES.AUTH_REGISTER} variant="accent" size="lg" className="w-full sm:w-auto">{CTA_LABELS.primaryAction}&lt;/Button>; signed in -> &lt;Button href={ROUTES.DASHBOARD.CAT} variant="primary" size="lg" ...>Ask your Cat&lt;/Button> (same precedent as categories/page.tsx:83). Use it in ProblemsSection.tsx:33-47, as the last block of how-it-works (replacing :161-200) and about (replacing the bg-surface-public band :86-103, which also removes one instance of finding 1), and after 'Decide' on what-you-can-do. Delete CTA_LABELS.createAccount and the 'Get Started Free' literal. Header label: either rename navigation.ts:535 to CTA_LABELS.primaryAction or keep 'Get Started' as the …
- **Mind:** As originally written (accent sign-up band on pages that signed-in people also see) it conflicts with AGENTS.md 'One orange': in-app actions are monochrome.

### funnel#9 · medium · What you can do: two identical rows of wrapping pills do different things, and their labels sit off-centre

**Status:** Fixed (fourth pull request).

- **Where:** /what-you-can-do (both, both themes)
- **What a person meets:** The first thing under the input looks unfinished, and a tap on a pill either jumps down the page or leaves it with nothing to tell the two apart. The fleet rule names this shape: never pills in a wrapping box.
- **Cause:** src/components/map/TheDoor.tsx:58 and src/app/(public)/what-you-can-do/page.tsx:33 use flex flex-wrap. The anchors are 'inline-block ... py-1.5' (TheDoor.tsx:63, page.tsx:38 and :48) and the global a { min-height: 44px } (globals.css:130-133) stretches the box without centring the text. check:choice-rows only matches aria-pressed, radio and tab, so links escape it. src/components/dashboard/DashboardIntent.tsx:49-54 carries the same markup.
- **Fix:** Extract src/components/map/DoorExamples.tsx (the &lt;ul> + links) and use it in TheDoor.tsx:57-70 and DashboardIntent.tsx:48-61. ul: 'no-scrollbar flex gap-2 overflow-x-auto' (no negative margin in the shared component; DashboardIntent sits in other paddings); li: 'shrink-0'; a: 'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap rounded-full border border-default px-3 text-sm text-fg-secondary hover:border-interactive hover:text-fg-primary'. what-you-can-do/page.tsx:33: ul 'no-scrollbar -mx-4 flex gap-4 overflow-x-auto px-4'; anchors at :38 and :48 become plain links 'inline-flex min-h-11 shrink-0 items-center whitespace-nowrap text-sm text-fg-secondary underline-offset-4 hover:text-fg-primary hover:underline' so the on-page index no longer looks like the submitting examples. The trailing ArrowRight on examples is optional; skip it.

### funnel#10 · medium · Capability cards: the action is a 51x36 text link, and 'See yours' is offered to people who have nothing yet

**Status:** Fixed (fourth pull request).

- **Where:** /what-you-can-do, /how-it-works (phone, both themes)
- **What a person meets:** On a phone the committing action of each of 19 cards is under the 44px minimum and visually weaker than the description above it; the second link leads a visitor to a sign-in for a list they do not have.
- **Cause:** src/components/map/CapabilityMap.tsx:46-58: both links are min-h-9 text links, and mineHref is rendered for every visitor.
- **Fix:** CapabilityMap.tsx:46-52: &lt;Button href={capability.startHref} variant="outline" size="md" className="h-11 min-h-11" aria-label={`Start: ${capability.verb}`}>Start &lt;ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />&lt;/Button> (reuses the shared outline look instead of retyping it). :53-60: move into a small client file src/components/map/MineLink.tsx ('use client'; const { user, hydrated } = useAuth(); if (!hydrated || !user) return null;) rendering &lt;Link className="inline-flex min-h-11 items-center px-2 text-sm text-fg-secondary hover:text-fg-primary hover:underline">See yours&lt;/Link>. CapabilityMap stays a server component.

### funnel#11 · medium · The stack page publishes internal scratch entries as products

**Status:** Fixed (fourth pull request).

- **Where:** /ecosystem, / (both, both themes)
- **What a person meets:** The page whose job is proof shows test fixtures and internal notes to someone deciding whether to trust this platform with money.
- **Cause:** src/app/(public)/ecosystem/page.tsx:72 and :179-186 render groupFleetByLayer, which is every project in the fleet map including the 'next' and 'demo' layers and non-live statuses (src/components/ecosystem/studio-fleet.ts:121-135). studio-fleet.ts:48-55 builds the name by sentence-casing the slug. src/components/ecosystem/StudioFleetGrid.tsx:53 renders a tile with no description and :60-62 renders a tile with no link.
- **Fix:** src/components/ecosystem/studio-fleet.ts: add 'export function groupFleetWithDoors(map)' = groupFleetByLayer restricted to projects where projectHref(p).href !== null (reuse the existing helper; add a case to **tests**/unit/components/studio-fleet.test.ts). ecosystem/page.tsx:72 calls it; :175-177 text -> 'Every project in the studio that has a door: what it is, whether it is live, and when it last moved.' Add a STATUS_LABELS map next to LAYER_LABELS ('not live' -> 'Not live', validating -> 'Validating', prospect -> 'Prospect', demo -> 'Demo') and use it at StudioFleetGrid.tsx:46. Do not hide tiles with what === null (Morulia is a live product); fix BiasLens's text, Morulia's missing line and the revamp-info/Hirnli name in Loki's map, which is the source.

### funnel#12 · low · The public 'What do you want to do?' box has no microphone; the signed-in one does

**Status:** Fixed (fourth pull request).

- **Where:** /what-you-can-do (both, both themes)
- **What a person meets:** The person this page is for, someone without an account who may not know what to type, gets the weaker of two inputs for the same question, and the page promises speech it does not offer.
- **Cause:** src/components/map/TheDoor.tsx:41-51 and src/app/api/cat/transcribe/route.ts:37 (dictation is signed-in only)
- **Fix:** Now: in what-you-can-do/page.tsx:31 render a small client switch (src/components/map/DoorEntry.tsx): server-render and default to &lt;TheDoor examples={DOOR_EXAMPLES} />, and when useAuth() reports hydrated && user render &lt;DashboardIntent examples={DOOR_EXAMPLES} /> (rename it to CatIntent in a follow-up). Add as the first line of TheDoor.tsx: '// experience-exempt: signed-out visitors cannot call /api/cat/transcribe (withAuth); a microphone here would fail on first use'. Tracked follow-up, not in this change: anonymous dictation behind a per-IP limiter in src/lib/rate-limit.ts, then TheDoor can become chatkit's DictationField.
- **Mind:** As proposed (DashboardIntent for everyone) it breaks fleet 'No dead ends': a microphone that returns 401 to signed-out visitors, and it drops the documented no-JS path.

### funnel#13 · low · About does not say who builds OrangeCat or how to check

**Status:** Fixed (fourth pull request).

- **Where:** /about (both, both themes)
- **What a person meets:** A visitor who opens About before trusting a platform with money learns nothing about who is behind it or where to verify the claims, although the answers exist elsewhere on the site.
- **Cause:** src/app/(public)/about/page.tsx:31-84 (no body link) and no reference to /company/about in src/config/navigation.ts or routes.ts
- **Fix:** routes.ts: add COMPANY_ABOUT: '/company/about'. about/page.tsx after the values grid (:84): &lt;section aria-labelledby="who"> with h2 'Who builds it' and a &lt;ul className="mx-auto mt-6 max-w-2xl space-y-2"> of four links, each 'oc-list-row flex min-h-11 items-center justify-between gap-3' with name, one line in text-fg-secondary and a ChevronRight: 'bitbaum, the studio' -> ROUTES.COMPANY_ABOUT; 'Open source (MIT)' -> the GitHub URL from footerNavigation.social; 'The stack' -> ROUTES.ECOSYSTEM; 'Write to us' -> `mailto:${CONTACT_EMAIL}`. Line 4 and :48: TreePine -> Lock. Also add 'About bitbaum' to the footer's Ecosystem column in navigation.ts so the page has a second inbound link.

### Also seen on re-check (funnel)

- Signed-in visitors are asked to create an account. /how-it-works and /about are shown to signed-in people too, and their closing buttons do not check the session: 'Create Free Account' -> /auth?mode=register (how-it-works/page.tsx:171-178) and an accent 'Get Started Free' -> /auth?mode=register (about/page.tsx:97-99, an orange button inside the app, against 'One orange'). Evidence: read-only signed-in GETs in (capture) and (capture) Fix: the auth-aware ClosingBand in verdict 8 (precedent: categories/page.tsx:83).
- Headings are cut across two lines by a global rule. src/app/globals.css:95 sets hyphens: auto on h1-h6. Measured with findBrokenWords from @bitbaum/chatkit/audit (the repo's own definition): 'permissionless' on /pricing at 390 and 320, 'ongoing' ('Raise money for ongoing work') on /what-you-can-do and /how-it-works at 320. With the rule switched off by injected CSS, all seven funnel pages report zero broken words and zero horizontal overflow at 320 and 390 ((capture) Fix: delete line 95 (overflow-wrap: break-word …
- The hero's live counter disagrees with the grid under it. src/services/home/pulse.ts:56 sets studioLive from map.summary.live, which counts every live project including the client site (Loki's map today: 16 live = 12 product + 3 pillars + 1 client), and HomePulse labels it 'studio products live'; the 'Live now' grid uses selectHomeFleet, which excludes client work, and shows 15 (v1.out homePulse and homeTiles). The file's own comment says the fold 'can never claim more than the directory shows'. Fix: count the …
- /how-it-works is a client component for no reason. src/app/(public)/how-it-works/page.tsx:1 is 'use client', but the file has no hook, state or handler, and Card, Button and CapabilityMap carry no client directive. The whole page, including the capability map, the entity registry it reads and its icons, is shipped and hydrated in the browser for static copy, and metadata had to be split into a separate layout.tsx. Fix: delete line 1 (and optionally move the metadata export into page.tsx and delete the pass-through …
