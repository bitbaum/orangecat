---
title: 'A Messenger for Words, Agents and Money'
excerpt: 'Messages on OrangeCat are becoming a messenger in their own right: replies, reactions, files, an agent nobody mistakes for a person, and money asked for and paid inside the conversation. What ships today, what we learned from Signal, SimpleX and Telegram, and what is not built yet.'
date: '2026-11-13'
tags: ['Platform Updates', 'Building in Public', 'Roadmap', 'Bitcoin']
featured: false
author: 'Cato'
published: true
---

A conversation is where people already agree on things: a time, a price, who owes whom. Most messengers stop at the words. The money moves somewhere else, and the assistant lives in a third app.

OrangeCat's messages are being rebuilt to hold all three in one place. This is where that stands. **Status: the interface is live and growing; the security work is a plan, and is written as one.**

## What works today

- **Reply.** Answer one message. Your answer carries a line of the original, and tapping it takes you there.
- **React.** Six emoji, one per person per message.
- **Files.** Photos, videos and documents, stored privately.
- **The Cat, marked.** Type `@cat` and the agent answers in the conversation. It has its own face, the word "Agent", and the name of the person it answered for. Nobody should have to guess whether a friend or a machine wrote something.
- **Money.** Open the "+" in a conversation with one person. "Request money" puts a card in the thread with the amount and a Pay button. When it is paid, the card says so. "Send money" opens their pay page.

OrangeCat never holds the money. A payment goes from the payer's wallet to the wallet of the person paid.

## One screen, for every product

The messenger is not part of OrangeCat's code. It is a package, `@bitbaum/chatkit/messenger`. OrangeCat supplies its own storage, accounts and wording; the screen is shared. The next product that needs conversations gets the same one, and a fix made once reaches all of them.

## What the others do well

We read what ten messengers publish about themselves. Three ideas stood out, and identity is the one that matters most to us.

| Messenger                                                         | To sign up you need | Worth knowing                                                                                             |
| ----------------------------------------------------------------- | ------------------- | --------------------------------------------------------------------------------------------------------- |
| [Signal](https://signal.org/blog/phone-number-privacy-usernames/) | A phone number      | A username is optional; your number is hidden from people who do not already have it                      |
| [WhatsApp](https://faq.whatsapp.com/820124435853543)              | A phone number      | Usernames are [being added](https://blog.whatsapp.com/its-time-to-reserve-your-whatsapp-username?lang=en) |
| [Telegram](https://telegram.org/faq)                              | A phone number      | One account per number; a public username is optional                                                     |
| [Threema](https://threema.com/en/faq/threema-id)                  | Nothing             | A random 8-character ID; linking a number or email is optional                                            |
| [Session](https://getsession.org/faq)                             | Nothing             | An Account ID, restored with a recovery password                                                          |
| [Delta Chat](https://delta.chat/en/help)                          | Nothing             | A random address, and several profiles side by side                                                       |
| [SimpleX](https://simplex.chat/docs/guide/chat-profiles.html)     | Nothing             | No user ID at all; several profiles, and a fresh random name per contact if you want                      |

**Identity.** SimpleX assigns its users no identifier of any kind, and lets one person keep several profiles. That is close to where OrangeCat is heading: one person acting under more than one name. We call those names heteronyms. A conversation should see the one you choose, and nothing should link it to your others. This is a plan, not a feature.

**Link previews.** In Signal, [the sender's app makes the preview](https://signal.org/blog/i-link-therefore-i-am/), so the server never learns which link was shared. We will do the same.

**Apps inside a chat.** Telegram has [Mini Apps](https://core.telegram.org/bots/webapps); Delta Chat has small apps that [cannot reach the internet](https://delta.chat/en/help) and share state only inside the chat. Our payment card is the first small step in that direction.

```deep Under the hood: who encrypts what
- **Signal**: end-to-end by default. It added a post-quantum ratchet in October 2025 ([SPQR](https://signal.org/blog/spqr/)). Its private group system means the service keeps no record of who is in which group ([source](https://signal.org/blog/signal-private-group-system/)).
- **WhatsApp**: end-to-end by default, using the Signal protocol ([whitepaper](https://www.whatsapp.com/security/WhatsApp-Security-Whitepaper.pdf)).
- **Telegram**: ordinary chats are encrypted between you and the server. Only "secret chats" are end-to-end, and they are tied to one device ([source](https://core.telegram.org/api/end-to-end)).
- **Matrix / Element**: end-to-end is optional in the protocol and has been the default for new private conversations in Element since May 2020 ([source](https://element.io/blog/e2e-encryption-by-default-cross-signing-is-here/)).
- **Wire**: end-to-end, and since April 2025 on MLS, the IETF's group standard ([source](https://wire.com/en/blog/wire-mls-is-now-generally-available)).
- **Session**: onion-routed, and by its own account without forward secrecy today; a second version of the protocol is in design ([source](https://getsession.org/blog/session-protocol-v2)).
```

## What is not built

**OrangeCat's messages are not end-to-end encrypted today.** The words are stored on our own server and the files in private cloud storage, both behind access rules, and both readable by whoever runs them. We would rather say that plainly than let a padlock icon imply otherwise.

Getting there is the direction, and it is harder in a browser than in an app. A website sends its code again on every visit, so whoever controls the server could send different code. WhatsApp answers this with [a browser extension that checks the code](https://engineering.fb.com/2022/03/10/security/code-verify/) against hashes held by a third party. Signal's [download page](https://signal.org/download/) offers desktop apps and no browser version.

```deep Under the hood: the security plan
In the order we expect to take it:

1. **End-to-end by default**, for two people and for groups. No separate "secret" mode. When the Cat is called, it is a visible member of the conversation, because an agent that reads a message must be seen to.
2. **A standard group protocol**, not our own: MLS ([RFC 9420](https://www.rfc-editor.org/rfc/rfc9420.html)), which gives forward secrecy and recovery after a key is stolen. Open libraries exist ([OpenMLS](https://github.com/openmls/openmls), [ts-mls](https://github.com/LukaJCB/ts-mls)); neither choice is made, and either needs an audit.
3. **Keys per device**, kept so that scripts cannot export them. The [Web Crypto standard](https://www.w3.org/TR/WebCryptoAPI/) allows this and is clear about its limit: a hostile script cannot steal such a key, but could still use it.
4. **Less for the server to know**: not who is in a group, not what it is called, and nothing shared between one person's heteronyms.
5. **Code you can check**: published hashes of every build, and an installable app beside the website.
```

Also not built: voice messages, search inside a conversation, forwarding, disappearing messages, polls. A payment made from a conversation does not yet leave a card behind; only a request does. The order is on the [roadmap](https://orangecat.ch/roadmap).

## Why inside OrangeCat first

A separate secure messenger is on the roadmap too. It starts here because the hard parts of a messenger are not the bubbles. They are identity, money and trust, and OrangeCat already has to get those right.

Words, agents and money belong in the same conversation, and nobody should have to wonder who is speaking or who can read it.
