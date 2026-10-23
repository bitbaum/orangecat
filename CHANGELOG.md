# Changelog

What changed on OrangeCat, newest first. Every entry here shipped to
production; entries are written from the reader's side — what you can now do,
or what was wrong and what it does now — never from the commit's.

This file is the record the fleet map (`loki.orangecat.ch/api/fleet/map`)
reads, and [orangecat.ch/changelog](https://orangecat.ch/changelog) renders
it from there. One `## YYYY-MM-DD` heading per day; bullets under it travel
to the map, sub-bullets stay here for the human reader.

## 2026-10-23

- **Receive tells you when you were paid.** Show your code, and when the payment lands the screen turns into a receipt — the amount in your currency, who paid and what for when that is known — with a Done to return to the code. It appears as soon as the payment is confirmed: within seconds while the payer's page stays open, and when the background check sees it if they close it. Payments sent straight to `you@orangecat.ch` are not seen by us and do not appear here.
- **Mobile sheets keep content scrolling separate from dismissal.** Swipe the handle to close; scrolling the body no longer dismisses the sheet. Cancelled gestures reset, and simultaneous sheets have distinct accessible names.

- **The money screens are set like they matter.** The amount is now a figure: the number large and centred, the currency small beside it, what actually moves (the Bitcoin amount) quietly beneath — on Send, Request, the pay page, the receipt and every request row. Receive is a poster rather than a box in a box: your name, then the code, with the Cat in its middle (it still scans), then Copy link · Share. Every way to be paid carries a round mark, and the Bitcoin one is the only orange. A confirmation draws its ring and tick instead of dropping in. People with no name show their handle once instead of twice. Underneath: stacked lines no longer carry a hidden 12px gap.

- **Bookings distinguish an empty list from a failed load.** Retry restores a failed request, view choices share one control, and history filters cannot hide incoming or confirmed bookings.
- **Cat’s editor directions open the editor.** Known creation paths and named editor suggestions become direct links, including answers that show a path as plain text. Duplicate editor suggestions collapse into one action.

- **Ask Cat without an automatic upgrade pitch.** Writing, creating or using another language no longer triggers a model promotion just because of keywords. Model choices remain available in AI settings.
- **Install metadata points to supported app resources.** The manifest no longer advertises missing screenshots, dead payment-protocol pages or an unimplemented file-opening flow. Generated icon files stay unchanged, and duplicate metadata has been removed.
- **Short-post drafts keep your latest words.** Closing the composer saves immediately. Drafts are separated by account and reply, storage errors offer Retry save, and older device-wide writing requires consent before private recovery.

- **A request you paid now says Paid.** Until now a request stayed Pending, with a Pay button, for both people — even after the money had moved, which invited paying twice. The pay link from a request now names it, so the payment answers it: the request turns Paid, the person who asked is told who paid and for what, and opening the old link shows "This request is already paid" instead of an empty form. A payment smaller than the ask leaves it open.
- **A send that times out no longer invites a second payment.** Lightning has no cancel, so a timeout can still go through. Send used to drop you back on the filled-in form with the button live; it now stops on "Not confirmed yet", asks you to check your wallet, and starts clean.
- **Send says it before you type an amount.** Your own name now reads "That's you", and someone who can only be paid on-chain gets a link to their pay page instead of a refusal after the review step.
- **Dead ends say why, and offer a person-to-person way forward.** The pay page for someone with no wallet now reads the same as Send, with the same one-line way to message them.
- **Notifications count in your currency.** "Lena asked you for CHF 20.00" and "You were paid CHF 5.00" instead of BTC decimals; a request you asked for tells you who paid it.
- **Ask Cat from Home with the same composer as chat.** Type or dictate your intent, then open Cat with your words intact. Home no longer opens the keyboard automatically; chat actions follow the app’s monochrome button style.
- **Task filters apply what you choose.** Type and archived choices now reach the API. Filter controls have labels, phone actions keep their names, tasks open with keyboard-accessible links, and a failed list offers Retry.

## 2026-10-22

- **A person who cannot receive Bitcoin is no longer a dead end on Send.** The note now says why — they have not added a Bitcoin wallet, so a payment has nowhere to land — and under it, one line: "Message Marco to suggest adding one". It opens your conversation with them with a short, friendly message already written, including a link that shows how to get a wallet. Nothing is sent until you press send, and you can change the words.
- **Keep more than one piece of writing in progress.** New draft preserves your current article, device drafts stay with the signed-in account, and the draft limit no longer silently removes older writing. Recover older unowned device drafts only when they are yours; failed saves and deletions keep your writing available for retry.
- **Notification settings explain what you change.** Each toggle names its email category, saves cannot overwrite one another in flight, and a failed initial load offers Retry. Cat instructions use a labeled field that stays readable on phones.
- **Cat can distinguish app help from personal data.** Writing destinations come from the Create catalog and count as verified application facts even for a new account. Answer repair preserves valid editor links while retaining checks against invented claims about your records.

- **Draft switching protects unsaved writing.** If device storage cannot save, your current draft stays open for retry. Clearing a draft also clears its saved text instead of restoring an older version after navigation.
- **Cat's editor suggestions open the editor.** Recognized Open shortcuts go directly to real creation pages. Automatic memory skips one-off writing requests and routine app praise, checks duplicates within each batch, and respects unavailable memory controls. Several new notes stay compact; failed Undo is visible and memories have a direct review link.

- **Messages work with keyboard and touch.** New Message closes with Escape and restores focus, the Unread filter says what it shows, and conversation search tolerates typing slips. Failed inquiries offer Retry. The composer clears the mobile bar without a second blank band; shared fields are readable on phones and required textareas enforce validation. A slow session-sync request no longer sends a signed-in reader back to sign-in.
- **Your articles remain yours to open and edit.** Private article reads, edit/delete controls and profile article lists now use the same author identity as publishing. Followers-only articles check the follow relationship. Writing uses a focused application workspace; published readers remain public.
- **Tell Cat when an answer missed.** Under every answer, beside Copy and Listen, a thumb up and a thumb down. The thumb down asks why in one tap — wrong, gave up instead of looking, too vague, misread, too long, hard to read — and takes a few words. What you say stays with the conversation, and each night the fleet's reviewer reads the day's conversations beside what Cat was actually able to do, so a wall or a wrong tool is found and fixed without you having to report it twice.
- **Profile setup is a choice.** Wallet connection is suggested when you need payments, without a Critical badge. Setup controls fit smaller screens, and Show more actually reveals the remaining tasks. Generated identifiers stay out of the welcome heading. The mobile menu and Create sheet support keyboard dismissal and focus management.
- **Posts require your own signed-in identity.** The older post writer now checks authorship inside the database function, including requests made directly to its API.

- **Request and Send start from your people.** Under From and To, before you type, the people you follow, who follow you and whoever you have asked or been asked by — each row saying why they are there. From the first letter the list narrows, and every account with a handle is found, not only the ones that wrote a bio: the person you followed this morning was invisible to the shared search, which lists a profile only once it has said something about itself. While the list has rows, "nobody goes by @me" stays quiet.
- **Receive is your code, nothing else.** "Add an amount" is gone from under the QR: the code says who you are, the payer types what they owe on the page it opens, and a figure you want from a particular person is a Request. The link under the code no longer wraps a raw BTC decimal across two lines.
- Wallets: the in-app Receive button is monochrome like every in-app action, the page is called Wallets, and every wallet carries the same mark instead of an emoji.

- **Home is easier to read on a phone.** Long suggestion and project names wrap, recent activity shares the dashboard's section layout, and the Cat tab replaces the floating button on mobile pages with a bottom bar. Project updates keep their source and full text behind “Read update”. Draft counts stay current; status copy describes Cat approvals rather than claiming nothing is waiting. Failed suggestion dismissals are reported, and cached suggestions no longer propose listing bitcoin as a rentable item.

- **Request and Send find the person as you type.** The field used to resolve an exact username after a pause, so "m" produced "Nobody goes by @m". Now a list of people appears under the field from the same typo-tolerant search as ⌘K; tap one and the handle is filled in.
- **Writing starts with your words.** The article editor leads with the title and body, with AI tools and cover details available when needed. Drafts flush before leaving the page, and failed local saves are visible. The article list keeps its Write label on phones.

- **One Cat mark across the app.** Cat's launcher, navigation and chat now use the same mark as the header. Install icons are versioned from that mark, and the app refreshes brand files instead of keeping old images indefinitely. The mobile Create button offers both Article and Post.

- **Write an article from Create.** Article appears alongside Post in the header menu, mobile sheet and Create page. Cat links directly to the article editor without requiring a project. The header menu now supports keyboard navigation and keeps its choices within the available screen space.

## 2026-10-21

### Changed

- **One orange.** The accent is now Bitcoin orange. It means two things and only two: Bitcoin, and the one button that brings someone in.
- **An invoice on a phone leads with Open in wallet.** A phone cannot scan its own screen, so the code moved behind "Show the code to scan" on phones and stays first on a laptop. One line says what the invoice is and how long it lasts.
- **Zcash instead of Monero** as the second self-custody way to be paid.
- The code scanner's "camera declined" card now says exactly where to allow it and has Try again beside Paste instead. Request and Send no longer say "nobody goes by @m" after one letter.
- **A way to be paid can be shared only when asked.** A Twint or Swish row is a phone number, and the first version printed it on your public pay page. Now each way is either on your page or shared on request: the page shows the rail by name, a payer taps Ask and it opens a message to you, and the number never reaches the page at all. Phone-number rails default to on request. Before you save any way, the sheet says what a payer learns — "your name and your phone number" for Twint, "only @you" for Bitcoin — because every fiat app shows the payer your registered name, whatever OrangeCat does.
- **Ways to be paid from everywhere.** Pix, UPI, M-Pesa, Alipay, WeChat Pay, PayNow, Swish, MobilePay, Bizum, Wero, Tikkie, Zelle and Interac e-Transfer join the list, grouped by where people use them, worldwide first. Each knows what you type (a UPI ID, a Pix key) and the amount travels into a link only in a currency that rail counts in.
- **Receive opens on a code people can scan.** The QR slot in the bottom bar now shows a QR of your pay link, with your name on it, the link under it, and Copy link · Share as two equal buttons. Add an amount and the code and the link carry it. Under the code, every way you are paid, in one list: Bitcoin first (your `name@orangecat.ch` and the wallet it lands in), then any other app you add.
  - Receive, Send and Request now share one frame — the same title shape, one line under it, the same tabs — and in-app buttons are monochrome; the orange stays on the public pages.
- **You can be paid in whatever people have.** Add Twint, PayPal, Revolut, Cash App, Venmo, Wise, a bank account or any link as a way to be paid. Your pay page shows each one with the one thing it supports: a tap that opens the app with the amount filled in, or the handle to copy. These settle in those apps, straight to you; OrangeCat shows them and never holds the money. A page with no Bitcoin wallet but a Twint number is still a page someone can pay.
- **Send reads what you give it.** One field takes a username, a Lightning address, an invoice, or a code from the camera — someone's Receive QR included, with the amount they asked for already filled in. The "To a person / Paste invoice" switch is gone; the text says which it is.

## 2026-10-20

### Added

- **An app you sign into with OrangeCat can list a service in your name.** It asks for that on the consent screen, marked as acting for you, like posting to your wall. A service listed through an app can be live at once instead of waiting as a draft, and when a client pays for it, Loki hears about it the way it already hears about project funding. This is how a builder booked through Loki gets paid: the fee is a service in the builder's own name, paid to the builder's own wallet, and the booking is marked paid from the payment itself.
  - The scope is `service.write`. Each app's ceiling of scopes now follows the code on every deploy: a widened ceiling used to reach the live sign-in only when someone re-ran the registration by hand.

### Fixed

- **A product, service, cause or document created for a group now belongs to the group.** The API layer worked out who the thing was for, but these four create paths rebuilt their row and dropped that, so the row fell to the person who clicked. The check that pins the carrier on every create path saw past them because of a type argument; it no longer does.

## 2026-10-12

### Changed

- **One wrong letter no longer loses anything.** Type `cqto` and you get Cato; `lki` finds Loki, `bitcon` finds Bitcoin, `farmhuose` finds Farmhouse, `setings` takes you to Settings. Every word may carry one slip from four letters and two from eight — a wrong key, a missing, doubled or swapped letter — and a short word that matches nothing may still be a longer name with a letter dropped. Exact names still come first, and what matched is marked even when it was misspelled. When nothing matches, Discover asks "Did you mean …?" with the closest real name.
  - The rules live in one shared package, `@bitbaum/searchkit`, so every site in the studio searches the same way instead of each writing its own. Its test suite misspells every word of the titles on Discover today, every way a finger can, and requires the right listing first — over five hundred cases, none missed.
- **Discover is a page you can finish.** One search field and one row of kinds — each with how many there are — then what was just listed, then a row of each kind: projects, things to buy, services, events, causes, people. Every card has the same parts in the same places: picture or initial, what kind of thing it is, the name, two lines, and the one fact that matters (the price, the goal, the date and place). It ends with the count of everything here and a way to list yours. It used to open on fifteen tabs and a sidebar of filters, several of which never filtered anything.
  - The page is rendered on the server and every state is a link — a search, a kind, "Show more" — so it can be shared, bookmarked and gone back to.
- **Search finds what you meant.** Type two letters and it finds names that start with them ("lo" finds Loki); get a letter wrong and it still finds it ("lokii", "bitcon"); accents don't matter ("zurich" finds Zürich). Exact and leading title matches come first. The words you typed are marked in every result.
  - The ⌘K search and Discover now use the same search, so "See all results" shows what the quick search just showed. They used to be two different searches, and Discover threw the ranking away and sorted newest first.
  - The quick search groups results by kind, shows what you searched for and opened lately when it opens empty, fills the screen on a phone, and when nothing public matches, offers to ask your Cat.
- **A project with nothing raised yet says "Be the first to back this"** on profiles, instead of a bold "No funds yet".
- **"What it solves" asks which problem is yours instead of listing all twelve.** Pick For you or For everyone, then the problem that sounds like you; its answer and the one thing to do next appear beside it (under it, on a phone). The same twelve answers, a sixth of the reading at a time.
- **Signing in looks like the front page.** The same mark drawing itself, the same depth behind it.
- **A project without a picture shows its initial,** not a generic target icon, on profiles.

### Fixed

- **The thing you typed whole comes before the longer thing that starts with it.** Searching "lki" put "Loki — Capability Layer for a Permissionless Economy" above the project named Loki; a name matched end to end now ranks first. And in the quick search, a page you misspelled ("setings") comes before a listing that only mentions the word somewhere in its description, so Enter opens Settings.
- **Settings → Usage only says what it knows.** The free-pool card said "nothing used yet — full allowance available" when it simply had no reading — next to a counter showing you had already sent a message. It now says "No reading yet", shows when each number was read, and says "Used up" when a provider has refused for the day, even if its headers still look healthy. Plans that can't be bought yet say "Not open yet" instead of "Activating", the Cat Credits card no longer points you to a top-up that is closed, and the explanations no longer credit Supporters who can't exist yet or give a reason for the midnight-UTC reset that isn't true.
  - The memory paragraph appeared twice and its button squeezed its caption into a one-word column off the edge of the card; it now appears once, with its link, in "What these numbers mean", which is folded at the foot of the page. "This week" is now "Last 7 days", which is what it counts. A message Cat could not answer is now stated to be free, which it always was.
- **A shared project link shows the project.** It used to preview as the creator's face — Loki's page showed Cato — or as a broken image when the creator had none. Now the card carries the project's own mark or initial, its name, one line on what it is, and who is behind it.
- **Discover's people are people who have shown up.** On the day the new Discover went live, its "Just listed" row was four untouched accounts with generated names and its People count was mostly the same. A person now appears once they have a name of their own, a bio or a picture, and "Just listed" shows listings, not sign-ups. The count of people on the front page follows. Those accounts still work and still open by link.
- **Search marks the words you typed, not letters inside other words.** Searching "lo" marked the middle of "technological"; now only words that start with what you typed are marked, which is how the search matches them.
- **One keystroke opens one search box.** The header carries the search twice (a bar on wide screens, an icon on phones), and each answered ⌘K, so two dialogs opened on top of each other.
- **Listings made with a test integration key stay off every public list.**
- **A listing with a broken picture shows its initial** instead of breaking the page.
- **Test listings no longer appear on Discover.** The first card there was a listing titled "TEST Session — TEST fixture — safe to delete". Listings whose title marks them as tests are now left out of Discover, its counts, search and the sitemap.

## 2026-10-11

### Added

- **Buy a paid ticket without an account.** On a paid event, a visitor who isn't signed in types their name and pays in Bitcoin, straight to the organizer's wallet. When the payment lands, the page that opens is the ticket: the QR for the door, the time and place. Close the tab before paying and coming back shows the same request, not a new one. The door list shows them by name; a paid ticket can't be given back from its page, and the organizer refunds it another way and records it, since there is no wallet on record to send Bitcoin back to. {#event-paid-guests}
  - Twint, bank and PayPal tickets are still not built; they need business accounts.

### Changed

- **OrangeCat has one mark now, and it is a cat made of one line.** A coil wound inward, two ears on its outer turn — Loki's spiral wearing the cat. It is the same mark in the header, in the browser tab, on the home screen when you install the app, and on every link preview. Until today those were three different drawings, and the tab icon was not an image at all: the file behind it was a web page, so most browsers showed nothing.
- **The front page opens like a product, not a pricing page.** One statement, the mark drawing itself above it, two actions, and real numbers underneath — how many projects are raising, how many people are here, how many studio products are live — counted the same way the directory counts them.
- **The studio is on the front page.** OrangeCat, Loki and Solon with their own faces, and under them every product built on this stack that is live, each one a door to its page. The same list, grouped by layer, now closes the stack page at /ecosystem.
- **A studio product's own page looks like that product.** Loki's project page wears Loki's mark, says it is live, when it last moved, opens its site, and leads to its sibling products.

### Fixed

- **The front page fits a phone, and a studio product's page opens the product.** The line above the headline ran off the right edge of a phone screen; it now shows one phrase there. Loki's page here showed Loki's face but no way to open Loki; it now has the button.
- **Listing pages open again on phones.** Since earlier today, a public product, service or event page with a "Buy" bar at the bottom loaded and then switched to "Something went wrong". The bar asked the browser for something while the page was still being built on the server; it now waits until it reaches the browser.
- **A seller can no longer hide their own reviews, and a buyer can no longer smuggle words past moderation.** Writing to the database directly, a seller could create a back-dated account record that took over their profile and showed an empty track record; a buyer could put arbitrary text where only yes/no answers belong, where hiding the review could not reach it. The server now sets when an account record was created, accepts only the questions OrangeCat asks, and computes each review's and reply's fingerprint itself.
- **Track records count cancellations.** A seller's track record said "N paid deals" including ones later cancelled, without saying so. It now lists cancelled deals next to refunded ones.

## 2026-10-09

### Added

- **Ask your Cat about the people you follow.** "What did people I follow post about Lightning this week?" now searches only the people you follow — their public posts and listings, newest first — instead of all of OrangeCat. Nothing they keep private is ever included.
- **Watch a person, or a topic among the people you follow.** Tell your Cat "tell me when @alice posts" (optionally "…about Lightning"), or "tell me when anyone I follow posts about Bitcoin education", and you get a notification for each new public post until you cancel it — never twice for the same post. It works under a post too: "@cat watch her posts for me".

## 2026-10-08

### Changed

- **Partners now have one home: bitbaum.** OrangeCat's partners page listed an OrangeCat guild that was never founded, so it showed an empty list while bitbaum had the real one. It now takes you straight to [bitbaum's partners](https://bitbaum.orangecat.ch/partners/), where independent engineers apply and the studio approves who is listed.

### Added

- **Decide where money paid to you goes, in order.** On Your money, under "Where your money goes", list your wallets in the order they should be covered: a share of everything that comes in (taxes first, say 25%), then amounts to fill — once, like paying back a debt, or every month, like rent or health insurance. When someone pays you, the whole payment goes to the first line still behind, and the page shows how far each line has got and where the next payment will land. OrangeCat never holds the money: the payer's wallet pays that wallet directly, and with no rule, payments land where they always did. {#money-routes}
  - It covers money sent to you through your profile, your Lightning address, tips and requests. A project or listing with its own wallet keeps receiving there.
  - A debt line can be an address the person you owe holds the key to, so the payment goes straight to them.
- **A deck, made in the room.** In your investor room, open **Deck** and generate a first draft from what the room and your product already say: the problem, the solution, live proof that it is real and moving, your own sections, the numbers, the roadmap and the ask — one claim per slide, nothing invented. Then edit any slide (its layout, words, figures, order), choose dark or light and your accent colour, and present it full screen with speaker notes. Investors open it from the room's **Open the deck**, swipe or arrow through it, link to a single slide, and save it as a PDF with real text. The proof slides read live data every time the deck is opened, so its numbers are never stale; opening the deck counts like any other open. {#room-deck}
- **Wallets for taxes and for paying back debt.** Two new purposes when you add a wallet: _Taxes_ — money set aside for the tax you owe — and _Debt repayment_ — money going back to someone you owe. Like rent or medical wallets, they appear on your profile with their purpose.
- **Every payment remembers what it was worth when it arrived.** When a payment to you is confirmed, OrangeCat now records the Bitcoin price at that moment in Swiss francs, euros, dollars and pounds. If no trustworthy price is available at that moment, it records nothing rather than a guess.
- **The investor room shows the evidence itself.** Open a room and the first screen now answers "is it real, and is it moving": when the product went live, how many changes shipped in the last 30 days, how many were merged to the main branch since it started, and where the roadmap stands — each with its source, generated from the product's public repository and its own records rather than typed by anyone. Below: why the product exists (problem, solution, mission, vision), a week-by-week shipping chart with what recently shipped, and the roadmap by now / next / later. A row of links jumps between sections, a new room's outline asks for the risks, and the page tells the reader plainly that the owner sees what is opened. {#room-evidence}
- **A product's own investor page leads into its room.** Heidi's /investors password now opens Heidi's investor room here. {#room-door}
- **An investor room on every project.** The owner of a project now has a private page for the investors they choose: a headline, the story in sections (the problem, what was built, proof, market, business model, team, roadmap, the ask), dated numbers with how to check each, the deck, documents, and the project's build record from Loki. Each person gets their own link — no account, no password — that says who it is for, and the owner sees, per person, when they opened the room and what they opened inside it. A link can be switched off at any time; its history stays. Open it with "Investor room" in the bar at the top of your project's page. {#room-links}
- **Who opened what, counted honestly.** The first time each person opens their link to an investor room, the owner gets a notification (and an email, which can be turned off). Link previews don't count: pasting a link into WhatsApp, Telegram, Slack or iMessage makes the app fetch the page for its preview card, and those fetches are no longer counted as someone opening it — in investor rooms and on profile claim links, where they were. Nor is the owner's own preview. {#room-opens}

### Fixed

- **"Came in" on Your money counts each sale once, at what it was worth.** From the first sale, a sale would have been counted twice — once as the payment and once as the order — and a year of income converted at today's Bitcoin price, so the income and the tax estimate built on it would both have been off. Each payment now counts once, valued at the price recorded when it arrived. A payment that arrived before prices were recorded is valued at today's rate, and the page says how many were.
- **A payment that timed out is no longer recorded as failed.** When your wallet doesn't answer in time, the Send screen already tells you the payment may still go through. OrangeCat's private record of the send now says the same: "unconfirmed", not "failed", because the money may have moved.

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
  - The same happened whenever Groq was merely busy: the prompt had been cut to fit Groq, Groq refused, and the next model was handed the cut version. Any model without Groq's limit now gets the whole prompt — as the fallback, or when it answers first.
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
