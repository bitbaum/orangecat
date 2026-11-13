# Full-path review — 2026-11-13

Every path a person or a bot can take on orangecat.ch, walked on
production at 390px and 1440px, dark and light. Seven reviewers each took
one area: first visit, makers, media, money, social, agents, system. Each
scored its area 1–5 on seven questions:

1. Function — does it work?
2. UX — is the next step obvious?
3. UI — how does it look?
4. Copy — is it true, and does it sell?
5. Media — pictures and share cards.
6. Creator economy — would a maker, person or bot, be proud of it?
7. Coherence — does it fit with the rest?

This file summarises the seven area reports. Each finding in them has a severity, its cause (file:line) and a proposed fix. The research-draft leak shipped first in #1735; everything under "Being fixed now" ships in the pull request that adds this file.

The review was read-only. One exception: the social reviewer had already
started when that rule went out. It created a TEST organization, two events,
a guest ticket and a post on the test account, then deleted all of them
(each now returns 404). Nothing was paid, and no real person was followed,
messaged or invited.

## Scores

| Area        | Function | UX  | UI  | Copy | Media | Creators | Coherence |
| ----------- | :------: | :-: | :-: | :--: | :---: | :------: | :-------: |
| First visit |    4     |  3  |  4  |  2   |   2   |    2     |     3     |
| Makers      |    3     |  3  |  3  |  3   |   1   |    2     |     2     |
| Media       |    3     |  3  |  3  |  3   |   2   |    2     |     2     |
| Money       |    3     |  3  |  3  |  3   |   4   |    3     |     2     |
| Social      |    2     |  3  |  3  |  2   |   2   |    2     |     2     |
| Agents      |    3     |  3  |  4  |  2   |   2   |   1.5    |     2     |
| System      |    4     |  3  |  3  |  3   |   2   |    3     |     2     |

**123 findings:**

| Severity | Count |
| -------- | ----: |
| Blocker  |     1 |
| High     |    27 |
| Medium   |    53 |
| Low      |    42 |

The frame is sound:

- 0 elements under 4.5:1 contrast across 236 captures.
- No sideways scroll on public pages.
- Every page has one h1.
- Public pages show their main content in 2–3 seconds on a throttled phone.

Three things are weak, and they are the ones the owner's goal depends on:

- **Media.** Pictures and share cards are missing almost everywhere.
- **Creator economy.** It is not yet a place a maker, or a bot, is proud to send people to.
- **Coherence.** The same thing goes by several names.

## By question

**Function.** Most paths work end to end. Some do not:

- **Blocker.** Deleting a published event said it worked, and the event stayed live with tickets on sale. The shared delete never checked that a row was removed.
- **Research drafts leaked.** The research API listed drafts publicly; fixed in #1735.
- **Money fields accept nonsense.** They are not checked when you leave them, and live data already has CHF 0.001 prices.
- **A dead link on the home page.** The first "Live now" tile opens a 404.
- **People search misses people.** It filters after paging.
- **A broken photo search hides its failure.** It reports "No images found" for every search.

**UX.** The search palette and the /pay page are models to keep. The rest has these problems:

- The next action differs for every kind of item.
- Signed in, Discover sits under "More".
- Paying and booking a service are two paths that never meet.
- Four payment flows use four sets of words.
- Signed-in pages take about 7 seconds on a throttled phone, and the dashboard shows three loading states in a row.

**UI and aesthetics.** Tokens, type and both themes hold together. What a person sees is still unfinished:

- Most cards are a letter on a grey plate.
- There are three 404 designs.
- The composer pushes the page sideways on a phone.
- The Cat has three avatars.

**Copy and marketing.**

- The home page never shows the outcome: what you would make, and money arriving. Its button names a mascot.
- The promise is written four ways.
- Pricing leads with AI vendors, not "0% to sell".
- The FAQ and the pricing page disagree on credits.
- The bot creator promises earnings and compute that are not built.

**Media.**

- 3 of 14 create forms take a picture.
- 8 of 11 kinds, and every shared post, use one generic share card.
- The cover-photo search is broken.
- Articles are signed with raw `user_…` handles.

**Creator economy.** The two biggest gaps:

- **The public feed.** /community is 78 of 80 automated build logs (raised by three reviewers).
- **Bots are not makers yet.** A bot cannot be paid, its page is a robot icon with no share card, and nothing it makes carries its name.

Also:

- A signed-out purchase is never recorded as an order.
- Hosts are not told when someone takes a ticket.

**Coherence.**

- The agent kind has five names, and money has five names.
- Organization, Document and Research each have several names.
- OrangeCat, Loki and Solon use three different headers. The fleet rule says the frame comes from `@bitbaum/sitekit`.

## Fixed in this pull request

1. **Feed.** Automated status updates stay off /community and the newcomer feed. The home page's 404 tile is fixed.
2. **Publishing.**
   - The composer fits a phone.
   - The photo search reports an outage as an outage.
   - A byline never shows a raw handle.
3. **Money trust.**
   - Amount fields are checked when you leave them.
   - A request needs a wallet to receive.
   - Amounts start empty, not at odd defaults.
   - Investment terms render properly.
   - Loans show in the viewer's currency.
   - The QR screen shows the BTC figure and the note.
4. **One name.**
   - One registry name each for bots, organizations, documents and research.
   - Discover is a top-level item when signed in.
   - The dashboard has one loading state.
5. **Share cards.** One registry-driven card for every kind, using its own picture, title, maker and figure, plus cards for shared posts.
6. **Bots as makers.**
   - A public bot with a wallet can be supported.
   - Untrue creator copy is removed.
   - The bot's page has its face and its own card.
   - "Made with <bot>" appears on what it helped make.
7. **Honest writes.**
   - A delete that removes nothing says so.
   - A published event can be unpublished or cancelled.
   - People search works across the whole directory.
   - Notifications filter by category and are keyboard-reachable.
   - /events lists events by default.

## Next, by size

- **One payment flow:** purchases, tips, support and investments on the /pay flow's words, states and receipt. A purchase becomes a real order. A service is booked first and paid when the provider accepts.
- **A picture for every kind:** one cover field in `base-config-factory`, which becomes the hero image on the page and on Discover.
- **The home page sells the outcome:** "Claim orangecat.ch/pay/your-name", one promise everywhere, and real makers' work instead of the studio grid.
- **A visitor's first sentence gets one real Cat answer before they sign up**, as /feedback already does.
- **One fleet frame:** move the header, tab bar and footer to `@bitbaum/sitekit`, or write down why not.
- **For the Messenger's owner** (`@bitbaum/chatkit`):
  - The Cat should answer a one-to-one without an @-mention.
  - The New message picker is empty until you type.
  - Edit and Delete cannot be reached by keyboard or on a phone.
  - A one-to-one with only the Cat never shows Read.
- **Terms and Privacy** are marked "Draft" and name the operator only as "Cato", with no address. The owner needs to provide the legal entity details.
