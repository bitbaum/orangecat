/**
 * Legal document content — SSOT for the public /privacy and /terms pages.
 *
 * Adapted from the counsel-facing drafts in legal/PRIVACY_POLICY.md and
 * legal/TERMS_OF_SERVICE.md. Both documents are still awaiting legal review,
 * so the pages render them behind an explicit draft banner — but a draft of
 * the real policy is more honest than the one-sentence stubs it replaces.
 *
 * When the reviewed versions land, update the content here and clear the
 * `draft` flag; bump `lastUpdated` on any substantive change.
 */

export interface LegalSection {
  heading: string;
  /** Paragraphs rendered before any bullets. */
  paragraphs?: readonly string[];
  bullets?: readonly string[];
  /** Paragraphs rendered after the bullets. */
  closing?: readonly string[];
}

export interface LegalDocument {
  title: string;
  /** ISO date of the last substantive content change. */
  lastUpdated: string;
  /** True while the document awaits legal review — renders the draft banner. */
  draft: boolean;
  intro: readonly string[];
  sections: readonly LegalSection[];
}

export const LEGAL_DRAFT_NOTICE =
  'Draft — pending legal review. This document reflects how OrangeCat intends to operate, but it has not yet been finalized with counsel and may change.';

export const PRIVACY_POLICY: LegalDocument = {
  title: 'Privacy Policy',
  lastUpdated: '2026-06-02',
  draft: true,
  intro: [
    'This Privacy Policy describes how OrangeCat ("we," "us," "our," or the "Service"), operated by Cato (pending incorporation of a successor corporate entity), collects, uses, and shares your personal information when you use the Service.',
    'By using the Service, you agree to the collection and use of information in accordance with this Policy.',
  ],
  sections: [
    {
      heading: 'Information you provide',
      bullets: [
        'Account information: name, email address, profile picture, username, and authentication credentials.',
        'Profile and listing data: product or service descriptions, prices, images, location, shipping or delivery details, and other content you publish to the marketplace.',
        'Transaction data: records of orders, listings purchased or sold, dispute history, and refund or cancellation actions.',
        'Payment-related information: Bitcoin wallet addresses, Lightning Network identifiers, payment metadata, and any payout details you provide. We may use third-party payment processors; sensitive payment information may be handled directly by those processors.',
        'Communications: messages between buyers and sellers within the Service, support requests, and feedback you send to us.',
      ],
    },
    {
      heading: 'Information collected automatically',
      bullets: [
        'Usage data: pages viewed, listings viewed, search queries, features used, time of access, actions taken in the Service.',
        'Device and connection data: IP address, browser type, operating system, device identifiers, referrer URLs.',
        'Cookies and similar technologies: session cookies, authentication tokens, preference cookies (see "Cookies and tracking" below).',
      ],
    },
    {
      heading: 'Information from third parties',
      bullets: [
        'OAuth providers: when you sign in with a third-party identity provider, we receive the identity information that provider shares.',
        'Payment processors and blockchain networks: transaction status, on-chain confirmations, payout history. Bitcoin transactions are by nature public on the blockchain.',
        'Identity verification (if used): when required for high-value transactions, regulatory compliance, or trust and safety, we may collect government-issued identification or use third-party KYC providers.',
      ],
    },
    {
      heading: 'How we use your information',
      paragraphs: ['We use the information we collect to:'],
      bullets: [
        'Provide, maintain, and improve the marketplace Service',
        'Facilitate transactions between buyers and sellers',
        'Authenticate users and prevent fraud, abuse, or illegal activity',
        'Resolve disputes and enforce our Terms of Service',
        'Comply with legal obligations, including anti-money-laundering (AML) and sanctions screening where applicable',
        'Communicate with you about your account, transactions, and the Service',
        'Provide trust and safety features (reviews, reputation, listing moderation)',
      ],
      closing: [
        'We do not sell your personal information. We do not use your content to train third-party AI models without your explicit consent.',
      ],
    },
    {
      heading: 'Bitcoin and blockchain transactions',
      paragraphs: [
        'OrangeCat enables payments using Bitcoin and Lightning Network. You understand and acknowledge:',
      ],
      bullets: [
        'Public ledger: on-chain Bitcoin transactions are recorded on a public, immutable ledger. Wallet addresses, transaction amounts, and timestamps may be visible to anyone. We cannot remove or alter blockchain records.',
        'Pseudonymity is not anonymity: while wallet addresses do not directly identify you, they may be linked to your identity through on-chain analysis or off-chain data we hold.',
        'Lightning Network: off-chain Lightning payments are not publicly visible in the same way as on-chain transactions, but routing nodes may observe payment hashes and amounts.',
        'Custody: OrangeCat is non-custodial — payments flow directly between buyer and seller wallets. If an escrow feature is ever offered, its custody terms will be disclosed before you use it.',
      ],
    },
    {
      heading: 'How we share your information',
      paragraphs: ['We share information only as described below:'],
      bullets: [
        'Other marketplace participants: sellers see buyer information necessary to fulfill an order (e.g., shipping address); buyers see seller information necessary to assess a listing (e.g., shop name, reviews, public profile).',
        'Service providers acting on our behalf: hosting and infrastructure, AI inference, authentication, email delivery, error monitoring, analytics, fraud detection, identity verification, payment routing. Each is bound by contractual or legal data-protection obligations.',
        'Legal requirements: when required by law, court order, subpoena, or other legal process; or when necessary to protect the rights, property, or safety of our users, ourselves, or others.',
        'Business transfers: in connection with a merger, acquisition, financing, or sale of assets, your information may be transferred. We will notify users of any such transfer that materially affects their rights.',
      ],
      closing: ['We do not share information with advertisers or data brokers.'],
    },
    {
      heading: 'Data retention',
      bullets: [
        'Account data: retained for as long as your account is active and for a reasonable period thereafter for legal, audit, AML, tax, and business continuity purposes.',
        'Transaction data: retained for the period required by applicable financial and tax law (typically 7–10 years).',
        'Listing data: retained as long as the listing is active, plus a reasonable period after delisting.',
        'Communications: retained for dispute resolution and audit purposes, typically 2 years.',
        'Logs and telemetry: typically 90 days, with security-related logs retained longer where required.',
        'Backups: may persist for up to 30 days after deletion.',
      ],
      closing: [
        'You may request earlier deletion under "Your rights" below, subject to legal retention obligations.',
      ],
    },
    {
      heading: 'Your rights',
      paragraphs: ['Depending on your jurisdiction, you may have the right to:'],
      bullets: [
        'Access the personal information we hold about you',
        'Correct inaccurate or incomplete data',
        'Delete your personal information ("right to erasure"). Deletion does not affect data we are legally required to retain (transaction, tax, AML records) or data already published to public blockchain networks.',
        'Export your data in a portable, machine-readable format',
        'Restrict or object to certain processing',
        'Withdraw consent where processing is based on consent',
        'Lodge a complaint with your supervisory authority (Swiss FDPIC, EU Data Protection Authority, etc.)',
      ],
      closing: [
        'To exercise these rights, contact us at the address in the "Contact" section. We will respond within 30 days.',
      ],
    },
    {
      heading: 'International transfers',
      paragraphs: [
        'The Service is operated from Switzerland and uses providers located in the United States, the European Union, and other jurisdictions. Where data is transferred outside your jurisdiction, we rely on appropriate legal mechanisms (Standard Contractual Clauses, adequacy decisions, or your explicit consent).',
      ],
    },
    {
      heading: 'Cookies and tracking',
      paragraphs: ['We use:'],
      bullets: [
        'Strictly necessary cookies — for authentication, security, and transaction integrity. These cannot be disabled without breaking the Service.',
        'Functional cookies — to remember preferences (currency display, language, theme).',
        'Analytics cookies (if any are deployed) — to understand marketplace usage patterns. We will list them here when active.',
      ],
      closing: ['We do not use third-party advertising cookies.'],
    },
    {
      heading: 'Security',
      paragraphs: [
        'We implement reasonable technical and organizational measures to protect your data, including encryption in transit (TLS), encrypted storage, access controls, audit logging, two-factor authentication for sensitive actions, and routine security reviews. However, no system is perfectly secure; we cannot guarantee absolute security.',
        'If we discover a data breach materially affecting you, we will notify you and the relevant supervisory authorities as required by law.',
        'Wallet security is your responsibility. We never request your private keys, seed phrases, or wallet recovery information. We will never ask you to send funds to "verify" your account.',
      ],
    },
    {
      heading: "Children's privacy",
      paragraphs: [
        'The Service is not directed to individuals under 18. We do not knowingly collect personal information from children. If we learn we have collected such information, we will delete it.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Cato (Data Controller, pending incorporation of a successor corporate entity) — hello@orangecat.ch',
      ],
    },
    {
      heading: 'Changes to this Policy',
      paragraphs: [
        'We may update this Policy from time to time. Material changes will be notified by email or in-product notice at least 30 days before they take effect. The "Last updated" date at the top of this document indicates the latest revision.',
      ],
    },
  ],
};

export const TERMS_OF_SERVICE: LegalDocument = {
  title: 'Terms of Service',
  lastUpdated: '2026-06-02',
  draft: true,
  intro: [
    'These Terms of Service ("Terms") govern your access to and use of OrangeCat (the "Service"), operated by Cato (pending incorporation of a successor corporate entity, herein "we," "us," "our"). By accessing or using the Service, you agree to be bound by these Terms.',
    'If you do not agree, do not use the Service.',
  ],
  sections: [
    {
      heading: 'The Service',
      paragraphs: [
        'OrangeCat is an online marketplace that connects buyers and sellers transacting in Bitcoin and Lightning Network. The Service provides listing, discovery, communication, and (optionally) escrow functionality. We are not a party to transactions between users; we are an intermediary platform.',
      ],
    },
    {
      heading: 'Eligibility',
      paragraphs: [
        'You must be at least 18 years old and capable of forming a legally binding contract under applicable law. You must not be located in, ordinarily resident in, or a national of any country subject to a comprehensive sanctions program of Switzerland, the United States, the European Union, or the United Nations, or appear on any government sanctions list.',
        'By using the Service, you represent that you meet these requirements.',
      ],
    },
    {
      heading: 'Accounts',
      bullets: [
        'You are responsible for safeguarding your account credentials and wallet keys.',
        'You agree to provide accurate information and keep it current.',
        'You may close your account at any time, subject to completion of pending transactions.',
        'We may suspend or terminate accounts that violate these Terms.',
      ],
    },
    {
      heading: 'Marketplace role',
      paragraphs: [
        'We are not a party to transactions. OrangeCat provides the platform; buyers and sellers form their own contracts. We do not:',
      ],
      bullets: [
        'Take title to goods or services listed',
        'Verify the quality, safety, or legality of listings unless explicitly stated',
        'Guarantee that any transaction will be completed',
        'Mediate disputes except where escrow or trust-and-safety policies explicitly provide',
      ],
      closing: ['You assume all risks of transacting on the platform.'],
    },
    {
      heading: 'Listings and acceptable use',
      paragraphs: ['Sellers may not list, and buyers may not purchase:'],
      bullets: [
        "Illegal goods or services under the laws of either party's jurisdiction",
        'Stolen, counterfeit, or infringing goods',
        'Goods or services that violate sanctions or export controls',
        'Firearms, ammunition, or weapons where regulated by jurisdiction',
        'Controlled substances or drug paraphernalia',
        'Adult content involving minors or non-consensual material',
        'Items that promote violence, terrorism, or hate',
        'Live animals, hazardous materials, or items subject to special regulation without proper licensing',
        'Personal data, identity documents, or hacked accounts',
        'Pyramid schemes, multi-level marketing, or fraudulent investment schemes',
      ],
      closing: [
        'We reserve the right to remove any listing and suspend any user at our sole discretion.',
      ],
    },
    {
      heading: 'Payments and Bitcoin',
      bullets: [
        'Transactions on OrangeCat are denominated in Bitcoin (BTC) and may be settled on-chain or via Lightning Network.',
        'Bitcoin is a volatile asset. Prices may change between listing and settlement. You acknowledge and accept this risk.',
        'Bitcoin transactions are generally irreversible once confirmed. We cannot reverse on-chain or Lightning payments.',
        'Custody: OrangeCat is non-custodial — payments flow directly between buyer and seller wallets, and we do not hold your funds. If an escrow feature is ever offered, its custody terms will be disclosed before you use it.',
        'We do not provide banking, investment, or financial advice. Nothing on the Service constitutes such advice.',
        'You are responsible for all taxes arising from your transactions on the Service.',
      ],
    },
    {
      heading: 'AML, KYC, and sanctions compliance',
      paragraphs: ['We reserve the right to:'],
      bullets: [
        'Collect identity verification information for high-value transactions, suspicious activity, or as required by law',
        'Screen users and transactions against government sanctions lists',
        'Report transactions to financial-crime authorities where required by law',
        'Freeze, hold, or refuse to process transactions reasonably believed to involve money laundering, terrorist financing, sanctions evasion, fraud, or other illegal activity',
      ],
      closing: [
        'You agree to cooperate with such requests and provide documentation as reasonably required.',
      ],
    },
    {
      heading: 'Disputes between users',
      bullets: [
        'Buyers and sellers should first attempt to resolve disputes directly through in-platform communication.',
        'If escrow is used, dispute-resolution procedures will be disclosed separately.',
        'We may, at our discretion, mediate or arbitrate disputes, but we are not obligated to do so.',
        'Our decisions, where rendered, are based on available evidence and made in good faith. They do not constitute legal adjudication.',
      ],
    },
    {
      heading: 'Fees',
      bullets: [
        'We may charge listing fees, transaction fees, payment-processing fees, or other fees as disclosed in the Service.',
        'Fees are disclosed before any transaction is finalized.',
        'Fees are generally non-refundable except as required by law or as explicitly stated.',
      ],
    },
    {
      heading: 'Your content',
      bullets: [
        'You retain ownership of all content you publish to the Service (listings, images, reviews, messages, profile information).',
        'You grant us a worldwide, non-exclusive, royalty-free license to host, display, reproduce, and distribute Your Content to the extent necessary to operate the Service.',
        "You represent that you have all necessary rights to Your Content and that it does not infringe any third party's rights.",
      ],
    },
    {
      heading: 'Reviews and reputation',
      bullets: [
        'Reviews must reflect genuine experience and may not contain fraudulent, misleading, defamatory, or harassing content.',
        'We may remove reviews that violate these standards but are not obligated to monitor reviews.',
      ],
    },
    {
      heading: 'Our intellectual property',
      bullets: [
        'The Service, its software, design, brand (including the OrangeCat name and visual identity), and documentation are our proprietary property.',
        'These Terms do not grant you any rights to our intellectual property except the limited right to use the Service as described above.',
        'Feedback, suggestions, or ideas you provide may be used by us without compensation or attribution.',
      ],
    },
    {
      heading: 'Third-party services',
      paragraphs: [
        'The Service integrates with third-party services (Bitcoin nodes, Lightning providers, AI providers, payment processors, identity verification, etc.). Your use of those services is subject to their respective terms and policies. We are not responsible for third-party services.',
      ],
    },
    {
      heading: 'Service availability',
      paragraphs: [
        'We strive for high availability but do not guarantee uninterrupted service. We may modify, suspend, or discontinue the Service or any portion of it at any time, with reasonable notice where feasible. Blockchain network conditions (congestion, fork events) may affect transaction settlement times.',
      ],
    },
    {
      heading: 'Termination',
      bullets: [
        'You may terminate your account at any time, subject to completion of pending transactions.',
        'We may suspend or terminate your access immediately, with or without notice, if you breach these Terms, are sanctioned, engage in fraudulent or illegal activity, or to protect the Service or other users.',
        'Upon termination, your right to access the Service ceases. The sections on marketplace role, payments, compliance, your content, intellectual property, disclaimers, limitation of liability, indemnification, and changes survive termination.',
      ],
    },
    {
      heading: 'Disclaimers',
      paragraphs: [
        'THE SERVICE IS PROVIDED "AS IS" AND "AS AVAILABLE," WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED. WE DISCLAIM ALL WARRANTIES INCLUDING MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE, NON-INFRINGEMENT, AND ACCURACY OF LISTINGS OR USER CONTENT. WE DO NOT WARRANT THAT THE SERVICE WILL BE UNINTERRUPTED, ERROR-FREE, SECURE, OR FREE OF MALICIOUS CODE.',
        'WE MAKE NO REPRESENTATIONS REGARDING THE LEGALITY, SAFETY, OR QUALITY OF GOODS OR SERVICES LISTED. WE MAKE NO REPRESENTATIONS REGARDING THE IDENTITY OR INTENT OF OTHER USERS.',
      ],
    },
    {
      heading: 'Limitation of liability',
      paragraphs: [
        'TO THE MAXIMUM EXTENT PERMITTED BY LAW, OUR AGGREGATE LIABILITY FOR ANY CLAIMS ARISING FROM OR RELATED TO THE SERVICE OR THESE TERMS SHALL NOT EXCEED THE GREATER OF (A) THE FEES YOU PAID US IN THE TWELVE MONTHS PRECEDING THE CLAIM, OR (B) CHF 500.',
        'WE SHALL NOT BE LIABLE FOR (i) LOSSES ARISING FROM TRANSACTIONS BETWEEN USERS, (ii) LOSSES DUE TO BITCOIN PRICE VOLATILITY, (iii) LOSSES FROM IRREVERSIBLE BLOCKCHAIN TRANSACTIONS, (iv) LOSSES FROM COMPROMISED WALLETS OR USER CREDENTIALS, OR (v) ANY INDIRECT, INCIDENTAL, SPECIAL, CONSEQUENTIAL, OR PUNITIVE DAMAGES, REGARDLESS OF THE THEORY OF LIABILITY.',
      ],
    },
    {
      heading: 'Indemnification',
      paragraphs: [
        "You agree to indemnify, defend, and hold harmless us, our affiliates, officers, employees, and agents from any claims, damages, losses, or expenses (including reasonable attorneys' fees) arising from (a) your use of the Service, (b) Your Content or listings, (c) your transactions with other users, (d) your breach of these Terms, or (e) your violation of any law or third-party right.",
      ],
    },
    {
      heading: 'Governing law and disputes',
      paragraphs: [
        'These Terms are governed by the laws of Switzerland, without regard to conflict-of-law principles. Any dispute arising under these Terms shall be resolved exclusively in the courts of Zurich, Switzerland, unless mandatory consumer-protection law of your jurisdiction provides otherwise.',
      ],
    },
    {
      heading: 'Changes to Terms',
      paragraphs: [
        'We may update these Terms from time to time. Material changes will be notified by email or in-product notice at least 30 days before they take effect. Continued use of the Service after the effective date constitutes acceptance.',
      ],
    },
    {
      heading: 'General',
      bullets: [
        'Severability: if any provision is unenforceable, the rest remains in effect.',
        'No waiver: our failure to enforce any provision is not a waiver of future enforcement.',
        'Assignment: you may not assign your rights without our consent. We may assign these Terms in connection with a merger, acquisition, or sale of assets.',
        'Entire agreement: these Terms and our Privacy Policy constitute the entire agreement between you and us regarding the Service.',
      ],
    },
    {
      heading: 'Contact',
      paragraphs: [
        'Cato (pending incorporation of a successor corporate entity) — hello@orangecat.ch',
      ],
    },
  ],
};
