# Changelog

What changed on OrangeCat, newest first. Every entry here shipped to
production; entries are written from the reader's side — what you can now do,
or what was wrong and what it does now — never from the commit's.

This file is the record the fleet map (`loki.orangecat.ch/api/fleet/map`)
reads, and [orangecat.ch/changelog](https://orangecat.ch/changelog) renders
it from there. One `## YYYY-MM-DD` heading per day; bullets under it travel
to the map, sub-bullets stay here for the human reader.

## 2026-10-07

### Added

- **An event page built for whoever opens it.** Most people arrive from a link in a group chat, on a phone, wanting three answers: when, where, am I in. Those now come first — the day and time on the venue's clock, the place, and the ticket — ahead of the description, which used to push them below the first screen.
  - "Add to calendar" opens the phone's own calendar (Google Calendar on Android, the calendar file everywhere else), and "Directions" opens the map at the pin or the address. Both are on the guest's ticket page too, the page they open on the night.
  - Visitors no longer see "Published"; they see "Full" or "Happening now" when that is true. A free event no longer shows a payment box that said "Sign in to buy a ticket" or "This creator hasn't connected a wallet yet".
  - The host sees how many are coming and one button to send the invite link (the share sheet on a phone, copy on a computer); a draft says it takes no tickets yet, and the bar at the top now has **Publish** instead of telling you to go and find it — for every kind of listing, not only events.
  - At the door, each scan says how to take the next guest.
- **Guests don't need an account.** On a free event, "Get a free ticket" asks only for a name — no sign-up, no email. The page it opens is the ticket: the QR for the door, the night's time and place, and "Can't make it" to give the place back. The door list shows guests by the name they gave. So the link a host sends to the group chat works for everyone in it. {#event-rsvp-guests}
  - Paid tickets still need an account; paying without one waits on the other payment rails.
  - The Cat now tells the host to publish the page before sharing it, because a draft takes no tickets.
- **Raise money from one sentence.** Go to /raise, say what you need ("a new roof for the community garden"), and the Cat prices it line by line, writes the title and story, and suggests how to raise it: backing, a loan, or investment. Every price is editable, a preview shows the page as backers will see it, and publishing gives you the link, a QR code and a share button. It works before you sign up; your plan waits for you after sign-in.
- **Back the road.** Under /roadmap, three cards show how to support OrangeCat in the open: fund it, lend to it, or invest, each with what has been raised so far from the public ledger.
- **Tell your Cat about an event and it sets the whole thing up.** A birthday, a meetup or a two-day conference: say what you're planning and the Cat asks what it needs in one message — what and when, where, how many and whether it's private or public, and who pays — then does it. The event page, free or ticketed; a wishlist so people chip in for the actual drinks, gear or venue deposit; a message to each guest or speaker on OrangeCat; and a reminder for you before the day. A public event also gets its announcement drafted, and the Cat can find a venue, caterer or DJ offered on OrangeCat and book the one you choose. Anything that publishes, books or messages someone waits for your okay.
  - The plan fits the event: a party for fifteen gets four things, not a conference's worth.
  - When the event is paid from money a group shares, the Cat puts the spend to that group as a draft proposal instead of spending it — the members vote. A group that decides on Solon gets the proposal prefilled there for a member to file and sign.
  - Want a site of its own (a conference programme, a wedding)? The Cat can ask Loki to build one. It only offers this when you ask for more than the event page.
- **An event from one sentence, mapped, with its crew.** Say "electronic music night at Espresso Bar in Landquart on Friday at 10, techno and house, I need a DJ, two bartenders and someone on the door, 15 CHF" and, after you confirm, the Cat makes the whole event: the address on the map, the music and the vibe on the page, the price in your currency, and the crew posted as open roles. Say "post it" and it goes live. {#event-one-sentence}
  - Anyone looking at the event sees "Crew wanted" with an "I can do this" button per role, which opens a message to you naming the role and the event. Events also have Music and Vibe fields on the form, and the pin moves when you change the address.
- **Find what's on near you.** /events has "What's on near you": share your location or type a place, pick the music and a distance, and get upcoming events nearest first. Or ask your Cat ("any house parties near Zürich this weekend?"); it answers from the same search. {#events-nearby}
- **Event times are the venue's time.** A 22:00 night in Landquart reads 22:00 everywhere: on the page, in lists, at the door, on the venue's page and in what the Cat tells you, whoever reads it and wherever the server is. The Cat now writes "Friday at 10" as 10 at the venue, not 10 in UTC. {#event-time-zones}
- **Tickets with a QR, checked at the door.** Paying for an event gives you a ticket on its page: a QR code, how many people it lets in, and a short code. Free events have "Get a free ticket", "Can't make it" gives the place back, and a full event stops selling before anyone pays. You get a notification with the ticket link. {#event-tickets}
  - At the door, scanning a ticket with a phone camera opens the event's door page and says in one glance: in, already in, or not a ticket for this event. The page lists every guest, with a name search and a manual check-in for a dead phone.
- **A page for the place, with what's on there.** "Make a page for my bar, Espresso Bar, Bahnhofstrasse 5, Landquart" sets up the bar as a place on the map, and its events show under "Happening here". If the bar isn't yours, name its owner and the page waits for them to claim it while you look after it. {#venue-pages}
  - Only whoever runs a place can list events there, so nobody posts onto a bar's page uninvited. The event form picks from the places you run instead of asking for an id.
- **The crew are real people, and the door crew check guests in.** On your event page, put a person on a role by @username; they're notified and see "You're on the crew". Whoever holds the Door or Security role can open the door page and check guests in from their own phone. {#event-crew}
- **Pay your crew and refund tickets, on the record.** Next to each person on the crew, "Pay" sends their fee in Bitcoin from your own connected wallet, or records that you paid them another way (Twint, cash). From the door list you can refund a paid ticket the same two ways; the ticket is cancelled and its place freed. Everything paid out shows on the event, nobody is paid twice for the same role, and a send that fails is recorded as failed. {#event-payouts}
- **Cover pictures.** The event form has a cover picture, and every picture field on OrangeCat can now find an openly licensed photo or generate one with your own AI key, not only take an upload. Send the Cat a photo and ask for it as the cover, or ask it to make one; without an image key it creates the event anyway and tells you where to add one. {#event-cover}
- **The roadmap and the changelog point at each other.** Each roadmap step that shipped links to the days in this changelog that delivered it, and each change here says which roadmap step it was for. The links come from the fleet's shared building-in-public kit, so the other products' pages can show them too.

### Fixed

- **The Cat keeps its instructions when the free model is full.** A prompt too big for the free Groq tier was cut section by section — on "Throw a party on Saturday" twelve sections, the party plan and the tappable answers among them — and still did not fit, so Groq was skipped and the next model answered from what was left: an empty draft and one question. When cutting cannot make it fit and another model can take it whole, it now goes whole.
- **"Throw a party" gets questions, not an empty card.** Tested against the live model: the Cat answered "Throw a party on Saturday" with a draft titled "Party on Saturday" — no date, no place — and a stiff list of what was "verified" and "unfinished". The step that picks the Cat's tools never saw the event playbook, so it drafted before the reply could ask. It now holds off until you've said when, where, roughly how many and who pays, then sets the plan up. When a reply runs out of time, the Cat says what it did in plain words instead of a report. {#event-one-sentence}
  - Checked again on the live site afterwards: the empty form was gone, but the reply still asked only where and offered a "Create Event" button. The first reply now says what the Cat will set up, asks when, where, how many and who pays in one short sentence (with "Use sensible defaults" one tap away), and offers no button and claims no draft until they are answered.
- **Signing in takes you where you were going.** Opening a link like "ask the Cat: throw a party on Saturday" while signed out, then signing in (or tapping "Start instantly — no email"), landed on the dashboard and the Cat never got your sentence: the sign-in page sent you back to the link, and a second redirect sent you to the dashboard and won. Both now go to the link.
- **Mail to OrangeCat arrives.** The FAQ, status, security, privacy and terms pages and the API description gave hello@, support@, security@ and integrations@orangecat.ch, and none of them was a mailbox, so a security report or a privacy request bounced. They all give cato@orangecat.ch now.
  - The password-reset email template kept in the repository pointed at support@; it gives cato@ too.
  - "Ask for a verified client" on the Sign in with OrangeCat guide opened the Bitcoin backing page; it now opens an email to cato@. The reset email no longer claims a community size nobody counted, and the security docs no longer announce a bug bounty, a security score or a passed penetration test, none of which exists.
- **The careers page no longer lists jobs that do not exist.** It showed four full-time openings with salaries and benefits; it now lists the real ways in — the open-source code, the partners' guild, and backing in Bitcoin. The footer says the code is MIT-licensed instead of "all rights reserved", and /technology names the framework versions the app actually runs.
  - The SDK's README and package metadata said "UNLICENSED (proprietary)"; the SDK is MIT like the rest of the repository. The partner copy no longer mentions an admission course, which does not exist, and the careers page says the partners' guild is not founded yet.
- **A published investment page opens for everyone.** Publishing an investment marked it open, but its public page only showed active ones, so a freshly published offering was a 404 for everyone but its owner, and its Invest card said "not open yet". It now shows as soon as it is published.
- **The Cat can create events again.** Every event the Cat tried to create was refused: it wrote the place to a field events do not have and left the currency on a value the database rejects. The place now lands in the venue address, and the Cat can also set the kind of event, an end time, free entry or a ticket price, and how many people fit.
- **Published events open for everyone.** The public event page only looked for listings marked "active", a status events never have, so a published event opened only for its organizer. Link previews and search results said "Event Not Found" for the same reason. {#event-one-sentence}
- **Buying an event ticket works.** Checkout read a price field events don't have and refused every ticket; it charges the ticket price now. {#event-tickets}
- **"Near me" can find you.** The site told browsers not to share location with itself, so "Near me" could never work. When location can't be had, it now says why — blocked, unavailable or too slow — instead of one sentence for all three. {#events-nearby}
- **Booking requests, booking updates and review reminders reach you.** Their notifications were refused by the database and only logged, so nobody saw them. Every kind of notification the app sends is now on one list the database checks against.
- **Asking the Cat to register something you own works.** It left out the owner and the kind of thing, so every attempt failed.

## 2026-10-06

### Changed

- **Reviews and track records now show far less about you.** Yesterday's version made more public than it should have; this corrects it.
  - **Your sales total is no longer on your profile**, and neither is how many things you have bought. The track record keeps only what helps someone decide whether to trust a seller: how many paid deals, with how many different people, refunds, and what share of customers would deal with them again.
  - **Reviews of buyers are never public.** A seller can still review you, but only the two of you see it, so a purchase can no longer appear on your profile because someone else wrote about it.
  - **Reviewers are anonymous by default.** A customer's review of a seller shows as "a verified buyer" unless the customer ticks "show my name". Reviews written before today are anonymous.
  - **A seller can reply once** to any public review about them.
  - **Anyone signed in can report a review.** OrangeCat can hide its text, and the review then says so rather than quietly changing.
- **Review reminders respect your email settings.** They can be turned off with "Progress & digests" in your notification settings without losing payment receipts, are limited to two emails a day, and several deals waiting at once arrive as one message instead of one each.

### Fixed

- **A payment OrangeCat sends for you now leaves a record on our side.** Until now, money sent from the Send screen or by asking your Cat moved from your wallet and OrangeCat kept no trace that it had. Every send now writes a private record of the payment, the amount and who it went to, and a payment that fails writes one too.
  - The record is private: nobody can read it through the site, including you, for now. Your wallet's own history is still the account of your money; this is OrangeCat's account of what it did with your permission.

## 2026-10-05

### Added

- **Review the people you buy from and sell to, and only them.** Every paid order is now a deal, listed under "Your deals" in the sidebar. Each side can answer a few yes/no questions about the other ("Would you deal with them again?") and add a note. Only the two people in a deal can review it, once each, and a review can never be edited.
  - Both reviews stay hidden until both of you have written, or 30 days pass, so neither side can read the other's review and answer it. After that, nobody can add one.
  - There are no stars. A yes/no answer keeps its meaning however many reviews someone has, where star averages drift until everyone has 4.8.
  - Tips never become deals. A gift tests nothing about whether anyone delivered.
- **You're asked to review, so reviews actually get written.** A few days after a deal is paid, each side gets a notification and an email asking how it went, and one more a few days before the review window closes. When the other person reviews you, you hear about it at once (that they reviewed, not what they said). Your Cat's suggestions on the dashboard now include the deal most in need of your review.
  - Nobody is asked about the same deal more than twice by the reminder, and never after they have reviewed or the window has closed.
- **Profiles show a track record.** A profile now shows what OrangeCat itself saw: how many paid deals the person had, with how many different people, how many were refunded, and what share of the reviews about them say "would deal again". The counts come from settled payments nobody typed in. A profile with no deals shows nothing new.

## 2026-10-02

### Added

- **Explain a transaction by telling your Cat what it was for.** Say "the 0.002 that came in on Tuesday was the laptop for Amina" and the Cat, after you confirm, saves it as your note on that transaction. If the wallet publishes its ledger, the note appears there publicly, and it counts toward the wallet's transparency score. Ask the Cat about your wallets and it now lists the recent transactions that still have no note, and the score as the ledger page computes it.
  - The Cat only saves a note on a transaction the wallet actually has; it refuses an id it cannot find rather than saving a note that would never appear.
- **A fund's page shows where to check where its money went.** When a cause, research or project page's receiving wallet is fully public and publishes its ledger, the page now says "This fund publishes its ledger" and links to it: every transaction, read from the chain, with the owner's note on what each was for. Funds that have not opted in show nothing new.

### Fixed

- **A project owner can see their project wallet's transactions.** The transaction history checked only who created the wallet row, so the owner of a project wallet could be refused their own history. It now uses the same owner check as every other wallet action.

## 2026-09-30

### Changed

- **Every FAQ answer has its own link.** Open a question on /faq and share the address: `/faq#is-orangecat-free-to-use` opens straight at that answer. The page no longer needs its scripts to open a question, and search engines now read the questions and answers directly.
  - The FAQ, the blog and Solon's pages now share one markdown reader (bip-kit 0.5), so a fix to it reaches all of them.

### Fixed

- **Signing in from Solon or Loki looks like it.** The sign-in screen now says "Continue to Solon" beside the form, explains that it is one account with one password, and its back link returns you to the app you came from instead of OrangeCat's home page.
- **Signing in to Solon and Loki with an email you added later.** If you added or changed your email after creating your account (including an account you started without one), OrangeCat told the other app you had no email, and Solon turned you away. It now sends the email your account has.

## 2026-09-28

### Added

- **Sign in without a password.** On the sign-in screen, choose "Email me a sign-in code instead": type your email, get a six-digit code, enter it. New here? The same code creates your account. Solon's sign-in uses it too, and so does Loki's "Sign in with OrangeCat".
  - The email carries only the code — no link to click — so a notification on your phone is enough.
  - Accounts with two-factor authentication still get their second step.
  - Codes can only be requested a few times in a row for any one address, so nobody can flood your inbox with them.
- **What you can do here, on one page.** Every thing this place can do, in plain words, with an example, the three steps, and a Start button — at /what-you-can-do, from the sidebar, the footer, the create page and How it works.
  - Grouped by what you want: earn, raise money, borrow or lend, do it together, move money, or just ask your Cat.
  - The page starts with a box: say what you want in one sentence and your Cat drafts it. No account needed to read the map.
  - The list is generated from the same registry that runs the app, so a new capability appears here the day it ships.
- **Say where your public money should go.** Of the money you owe the public, how would you divide it between your locality, your region and your nation? Nobody asks. Now you can say it — and see what the people of your place would choose.
  - Three sliders that always add up to 100, under Your civic split in the dashboard. Show it on your profile or keep it to yourself; it counts either way, anonymously, once three people in a place have declared.
  - It changes nothing about what the law takes or where it goes. It says where you stand, and it will decide where what you give voluntarily goes once local funds exist.
  - The average per place is public, so anyone — including the Solon map to come — can read what a locality would choose.
  - Cat can set it from a sentence: “send 60% of my public money to Witikon”.
- **New essay: Where the Wall Is.** One Hetzner box runs the whole studio today. The piece gives the order in which it stops being enough, what fixes each wall, and why the only one that costs real money is tokens, not servers.

- **Organisations know what kind of body they are, and where.** The kinds of collective — circle, family, association, cooperative, collective, company, guild, DAO, town, network state, local fund — are now one list shared with Solon, and an organisation can say where it belongs (country, region, locality) and what it legally is.
  - "Nonprofit" is now "Association", which is what the world calls it (in Switzerland, a Verein). Existing organisations were renamed.
  - A town or a local fund cannot be founded without a place; everything else may add one.
  - Legal status is a fact with evidence — informal, registered, or recognised tax-exempt — and only the last may ever be described as receiving deductible gifts.
  - A **Local fund** template, Witikon first: money residents direct to their own place, governed by them, on top of what the law takes.

### Improved

- **A shorter sidebar, one page for your things, a door on Home.** The sidebar had fifteen kinds of thing behind four chevrons. Now it has six lines. Everything you made or joined is one page, My things, and Home starts with a box: say what you want and your Cat drafts it.
  - My things groups what you have by what you wanted — earn, raise money, borrow or lend, do it together — with its state and a link into it.
  - Sidebar: Cat · Home · My things · Money · Messages · What you can do. People, Work and More stay folded.
  - Timeline and Explore moved under More; the phone tab bar is unchanged.

### Platform

- **Roadmap and changelog now come from the fleet's canonical record.** `ROADMAP.md` and `CHANGELOG.md` at the repository root are the record; the fleet map ingests them and /roadmap and /changelog render what the map holds. The local copies the pages used to read are gone.

## 2026-09-20

### Added

- **Bring a Claude key straight to Cat.** Anthropic is now wired directly, so a Claude key works on its own instead of having to go through OpenRouter. Getting a key from any provider is one click. And there is finally one page explaining what actually powers Cat.
  - Anthropic joins Groq, OpenRouter, OpenAI, Together AI, xAI and DeepSeek as a direct provider — paste your key and Cat uses it.
  - Choosing a provider now shows a button straight to that provider’s own key page, naming where it sends you, instead of four words of grey text under the password box.
  - “How Cat runs” explains the four ways to power Cat — free pool, credits, your own key, your own machine — with what each costs, where your words go, and what each is bad at. Local models are genuinely weak at taking actions, and it says so.
  - Memory moved to its own settings tab. What Cat remembers about you is not a billing setting and should not be buried under one.
  - Cat Credits stated two different prices on two adjacent screens. Both now read from one source.
  - Image generation was described as free; it does not use your daily messages, but it is billed to Cat Credits, and it now says that.
  - Claude Fable 5.1 was missing because Fable 5 still worked — so nothing detected it. The catalogue check now also notices when a newer version of a model we use has shipped.

### Improved

- **Cat keeps more of your conversation.** Cat's instructions are larger than the free tier allows in one go, so some are trimmed on every message. It was trimming your conversation before the generic advice. Now it is the other way round.
  - What Cat knows about you — your listings, your history — is now the last thing given up, not the second.
  - When it does have to shorten what it knows about you, it now keeps as much as the free tier has room for. It was throwing all of it away over a handful of tokens.
  - On an ordinary message this keeps a turn of conversation that used to be discarded.
  - Fixed a diagnostic that reported your context as discarded when it was present, which is the kind of thing that sends whoever is debugging at the wrong problem.

### Fixed

- **Cat keeps its footing when the free tier runs short.** When Cat's instructions do not fit the free tier, some are trimmed. Two of the ones it trimmed early were the ones telling it how to answer someone having a hard time. Those are now the last things it will ever give up.
  - If you write to Cat about a difficult situation, it no longer risks answering with a business strategy because it was short on room that minute.
  - Three newer parts of its instructions were being kept no matter what, purely because nobody had classified them — they were taking up room that your own information should have had.
  - A check now fails the build if any part of Cat’s instructions is left unclassified, so this cannot happen quietly again.
- **Cat on a phone, fixed end to end.** A pass over every screen of Cat and AI settings on a small screen. The box you type in stayed put, replies stopped showing their own formatting marks, and the navigation bar stopped being see-through.
  - The message box no longer floats into the middle of the screen when the keyboard opens.
  - Replies render quotes and code blocks properly instead of printing the raw “>” and backticks.
  - Your remaining daily messages were being covered by the conversations button, so the count read “f 10 left”. Both now sit in the toolbar side by side.
  - Suggested prompts are one recommendation plus a row you swipe, and the row changes between visits rather than showing the same four boxes forever.
  - The bottom navigation bar is opaque and stays full size — page content used to be readable straight through it, and buttons at the end of a page sat underneath it.
  - The round button above the bar says “Receive”; it was an unlabelled QR icon.
  - The model picker dims the page behind it, closes with Escape, and its locked models are now links to the page that unlocks them.
  - Cat no longer claims a reply “fell back to Groq because Groq was rate-limited” — it names the model that actually answered.

### Platform

- **Prices are real; the checkout is deliberately shut.** You can now read exactly what Cat costs on every route. You cannot pay us yet, on purpose: OrangeCat is not a registered company, so it must not take money. Paying other people was never affected.
  - One switch now decides whether OrangeCat may charge at all, it is off unless explicitly turned on, and every path that takes money for OrangeCat refuses behind it on the server.
  - Before this, the only thing in the way was whether a receiving wallet happened to be configured — an infrastructure setting standing in for a legal decision, which would have opened the till as a side effect of testing.
  - An invoice already paid still credits. Shutting a till must never strand money somebody already sent.
  - Reaching the top-up screen now explains why it is shut and what still works, instead of showing a disabled button labelled “soon”.
  - Paying other people on OrangeCat is untouched and always will be — that money goes directly to them at 0% fees and never passes through us.

## 2026-09-19

### Improved

- **Build it with Loki now asks before it builds.** The handoff to Loki carried this page’s title and one public sentence, and an agent started work on exactly that. Loki now interviews you first — a few short questions about who it is for and what finished looks like — and builds from your answers.
  - Five questions, one at a time, each skippable; the build starts as soon as you are done.
  - Your answers become the project profile Loki plans milestones and briefs its agents from.
  - Questions are phrased around your actual page, so you are never asked what it already says.

## 2026-09-17

### Added

- **Dates read the way you read them.** OrangeCat wrote every date the American way — March 15, 2027 — regardless of where you are. Date format is now a setting, and left alone it follows the country on your profile.
  - Settings → Date Format offers day first (15 Mar 2027), month first (Mar 15, 2027) or year first (2027-03-15).
  - Left on automatic it is inferred from your country, then your currency — so moving country changes your dates without you touching anything.
  - Most of the world, and most of this platform, writes the day first. Signed-out pages now do too.
- **Every wallet has a page of its own.** A wallet used to exist only as a card inside somebody’s profile. It now has its own address you can send someone — and the on-chain numbers behind it were corrected.
  - orangecat.ch/wallets/<id> shows a wallet’s label, category, owner and payment handle, with a QR code.
  - Balances and transaction history now scan both of a wallet’s derivation chains. Scanning only one under-reported any wallet that had ever spent, and made outgoing payments look larger than they were.
  - A wallet that does not exist answers 404 rather than a page saying it does not exist.

## 2026-09-15

### Fixed

- **Balances say when they were last checked.** A number nobody has read is no longer displayed as zero. Projects showed “Bitcoin Balance CHF 0.00” whether or not anyone had ever asked the blockchain.
  - A project’s Bitcoin balance reads “Not checked yet” until it has actually been read.
  - The Wallets tab is visible on a profile instead of hidden in the overflow menu — it answers “how do I pay this person?”.
  - Fixed wallets that all claimed to be the primary one, which made “the primary wallet” resolve to a deleted row.

## 2026-09-14

### Added

- **AI assistants are now Companions, and they remember you.** A companion’s memory belongs to the person talking to it, not to whoever created it — and the owner can no longer read other people’s conversations.
  - The conversation is the page: talking to a companion is the main surface, not a tab.
  - Cloning a companion copies its definition and none of its memories.

### Platform

- **Free AI that actually answers.** The free model chain had never worked end to end. It now has three genuinely free providers, ordered so the scarcest runs out last.
  - Gemini added as a third free provider, verified with a real key rather than a claim.
  - Providers are drained in order of capacity, so the smallest quota is not spent first.
  - An empty response is treated as a failed provider rather than a finished answer.
  - Cat says so when the last free provider is exhausted, instead of going quiet.

## 2026-09-12

### Fixed

- **Six public tables had row-level security switched off.** Six tables readable with the public key had no row-level security enabled. Now they do.

## 2026-09-11

### Added

- **Cat can read the web, and has to cite it.** Cat can search and read pages, and every claim drawn from one carries a link the reader can follow and check.
  - Cat can commission a real, deployed website through Loki.
  - A project published through the API can be taken back down again.

## 2026-09-10

### Added

- **Set a page up for someone else.** You can create a profile or project on behalf of someone who has no account, and hand it over in one transaction. Until they claim it, it is visible and clearly theirs.
  - A free @orangecat.ch address is the default, and buying a custom domain is one step.
  - Cat asks for permission by name before acting, and one consent card covers identical requests.

## 2026-09-08

### Added

- **Wallets show what they actually received and sent.** On-chain history on the wallet card, with the net movement for that wallet rather than the transaction’s total.
  - Every extended-key wallet used to report exactly 0 BTC, because the endpoint the code called had never existed. It now derives addresses and scans them.
  - “We could not read the chain” is shown as a failure with a retry, never as an empty list.

## 2026-09-07

### Fixed

- **Payments stopped being sent to wallets that cannot receive.** New users were routed to a wallet with no way to accept money, and a send-only wallet connection took the whole receiving path down with it.
  - “Looks good” on a wallet now means “can be paid” — a real probe, not a shape check.
  - The sign-in round trip was broken in three places and is fixed.
  - /api/health/ai exists, because the Cat’s provider chain had died twice without anyone noticing.

## 2026-07-31

### Added

- **Spending caps for Cat, and payments any machine can make.** Two guardrails-and-rails updates: hard Bitcoin spending limits on Cat payment actions, and a documented API loop so any agent or script can discover, buy, and verify settlement.
  - Set a max-per-payment cap and a daily Bitcoin budget in Cat → Permissions; Cat cannot exceed them even after you confirm.
  - New public API endpoints: create a payment for any public listing and poll it until it settles — with an integration key or no account at all.
  - The full machine-buying walkthrough is in the live API spec at /api/v1/openapi.json.

## 2026-07-29

### Added

- **Your Cat learns from real outcomes.** Cat now sees what actually happened to what you created together — published, funded, settled — and grounds its advice in those outcomes instead of guesses.
  - New Track Record in the Cat hub’s Context tab: created → published → funded, with settled Bitcoin per entity.
  - The same record is part of Cat’s own context, so suggestions lean on what worked for you.
  - Fixed: actions that asked for your confirmation could fail outright; confirmations now work.

## 2026-07-22

### Added

- **Discover, sharper and searchable.** Find what matters by meaning, not just keywords — and let search engines find it too.
  - Public semantic search across the economy: projects, people, and offers, matched by intent.
  - Discover now server-renders a crawlable content strip, so published work is indexable and shareable.

## 2026-07-21

### Added

- **A two-sided market.** The platform now indexes what people want, not only what they offer — and introduces the two sides.
  - A public open-demand feed: browse what the community is looking for.
  - Two-sided introductions surface matches between demand and supply.
- **Support in Bitcoin.** A Bitcoin-native Supporter checkout — back the platform directly, settled on Lightning or on-chain.

## 2026-07-19

### Platform

- **Wired to Loki.** OrangeCat is the economic layer for Loki — and now the wiring runs both ways.
  - Settled funding on a project or cause signals the Loki fleet automatically.
  - Embedded the Loki feedback widget — OrangeCat runs as its own second customer.

## 2026-07-14

### Improved

- **Cat Credits go-live plumbing + steadier sessions.** Groundwork for paid Cat Credits, and a fix so auth-gated pages resolve instead of spinning.
  - Cat Credits go-live is now environment-driven, with a wallet-verification step.
  - Closed a hydration gap that could pin logged-in pages on a loading spinner.

## 2026-07-13

### Added

- **Cat-first, and payable on publish.** Your Cat is the front door, and publishing something payable is a guided, one-link step.
  - The dashboard routes everyone to the Cat hub.
  - Publishing a payable entity nudges you to connect a wallet and hands you a payable public link.
  - Hardened a public-profile data-exposure path.

## 2026-07-09

### Added

- **Peer-to-peer Bitcoin loans.** Lend and borrow directly: offers, obligations, and payment handoffs — no bank in the middle.

## 2026-07-08

### Improved

- **Funding transparency you control.** Per-entity controls over how much of your funding picture is public — transparency by choice.

## 2026-06-17

### Platform

- **Log in with OrangeCat.** OrangeCat became an OpenID Connect provider — one identity you can carry across the ecosystem.

## 2026-06-12

### Platform

- **Self-hosted and sovereign.** Moved to fully self-hosted infrastructure — the platform runs on hardware we control.
