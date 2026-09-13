'use client';

import { useState } from 'react';
import Link from 'next/link';
import {
  ChevronDown,
  Bot,
  Coins,
  Users,
  Shield,
  Zap,
  HelpCircle,
  Clapperboard,
} from 'lucide-react';
import { PageHeading } from '@/components/layout/PageHeading';
import { ROUTES } from '@/config/routes';
import { cn } from '@/lib/utils';

interface FaqItem {
  question: string;
  answer: string | React.ReactNode;
}

interface FaqSection {
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  color: string;
  items: FaqItem[];
}

const FAQ_SECTIONS: FaqSection[] = [
  {
    title: 'About OrangeCat',
    icon: HelpCircle,
    color: 'text-fg-primary',
    items: [
      {
        question: 'What is OrangeCat?',
        answer:
          'OrangeCat is your AI economic agent — a platform where any person, pseudonym, or organization can make the work and be paid for it. Make video, music, writing and artwork in the Studio, finance unfinished work as a project, sell finished work as a product, and lend, invest and coordinate from the same place. Bitcoin and Lightning Network are the live settlement rails.',
      },
      {
        question: 'Who is OrangeCat for?',
        answer:
          'Anyone who wants to participate in economic activity without gatekeepers. Film-makers, musicians and writers making the work and funding it, creators selling what they have made, researchers seeking funding, communities pooling resources, borrowers and lenders connecting directly, organizations making collective decisions — if you want to make something or exchange value with anyone in the world, OrangeCat is for you.',
      },
      {
        question: 'Is OrangeCat free to use?',
        answer:
          'Creating a profile and using the platform is free. OrangeCat does not take a cut of Bitcoin or Lightning payments — you send and receive directly. Some premium Cat AI features may use credits. Check the pricing page for the latest details.',
      },
      {
        question: 'Do I need to use my real name?',
        answer:
          'No. OrangeCat is pseudonymous by default. You can participate fully — sell, fund, lend, invest — under any identity you choose. Real-name verification is opt-in only, never required.',
      },
    ],
  },
  {
    title: 'The Studio (making things)',
    icon: Clapperboard,
    color: 'text-fg-primary',
    items: [
      {
        question: 'Can I actually make video and music here?',
        answer:
          'Yes. The Studio generates video, music, longform writing and artwork. You describe what you want, watch or listen to it, and then say what should be different in ordinary words — "the middle drags", "colder light", "start in the middle of the argument". That becomes the next version.',
      },
      {
        question: 'I am not a musician. Is this for me?',
        answer:
          'That is exactly who it is for. You do not need to name a tempo or a key to know that a track drags, and you do not need to know a lens to know the light is wrong. Saying what is wrong is enough to change it — the Studio translates your words into what the model needs.',
      },
      {
        question: 'What does the Studio cost?',
        answer:
          'Writing runs on OrangeCat’s own free models, so it costs nothing. Video, music and artwork run on your own AI provider key (Settings → AI) — you pay your provider directly at their prices, and OrangeCat adds nothing on top. The free pool is text-only and never pays for a render.',
      },
      {
        question: 'Who owns what I make?',
        answer:
          'You do. OrangeCat stores your renders so the link does not expire, and claims no rights over them. What your AI provider permits is set by that provider’s own terms, which you accept directly with them when you add your key.',
      },
      {
        question: 'How do I get paid for it?',
        answer:
          'Two ways, and most creators use both in order. While the work is unfinished, publish it as a project so people can fund it as you go. When it is finished, list it as a product with a price. Payment settles in Bitcoin straight to your wallet — OrangeCat takes no cut.',
      },
    ],
  },
  {
    title: 'Your Cat (AI Agent)',
    icon: Bot,
    color: 'text-fg-primary',
    items: [
      {
        question: 'What is "My Cat"?',
        answer:
          '"My Cat" is your personal AI economic agent. It understands your context — your projects, services, goals — and acts on your behalf. You can ask it to create projects, draft product listings, find investment opportunities, compose messages, and much more, all in plain language.',
      },
      {
        question: 'What can the Cat do for me?',
        answer: (
          <div>
            <p className="mb-2">Your Cat can:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                Create and manage your economic entities (projects, products, services, causes,
                loans, investments)
              </li>
              <li>Draft descriptions, milestones, and terms in your voice</li>
              <li>Search the platform to find relevant opportunities, backers, or collaborators</li>
              <li>Send messages and coordinate with others on your behalf</li>
              <li>Provide context-aware suggestions based on your goals</li>
              <li>Help you understand your funding progress and next steps</li>
            </ul>
          </div>
        ),
      },
      {
        question: 'How do I talk to my Cat?',
        answer:
          'Open the Cat panel from your dashboard (the chat icon in the bottom right). Just type naturally — "Create a project for my open-source library with a 0.1 BTC goal" or "Help me write a description for my consulting service." The Cat understands context and will walk you through anything it needs.',
      },
      {
        question: 'Is the Cat reading all my data?',
        answer:
          "The Cat only accesses data you have authorized it to see — your own entities, public profiles you interact with, and conversations you start. It does not access other users' private data. You remain in control; the Cat proposes actions and waits for your confirmation before executing them.",
      },
    ],
  },
  {
    title: 'Economic Activity',
    icon: Coins,
    color: 'text-fg-primary',
    items: [
      {
        question: 'What kinds of economic activity can I do on OrangeCat?',
        answer: (
          <div>
            <p className="mb-2">The full economic spectrum:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>
                <strong>Exchange</strong> — Sell products (physical or digital) and services
              </li>
              <li>
                <strong>Fund</strong> — Launch projects with milestone-based accountability, or
                causes for outright giving
              </li>
              <li>
                <strong>Lend</strong> — Offer or take peer-to-peer loans with custom terms
              </li>
              <li>
                <strong>Invest</strong> — Equity-style or revenue-share investing without
                intermediaries
              </li>
              <li>
                <strong>Research</strong> — Decentralized science funding and collaboration
              </li>
              <li>
                <strong>Coordinate</strong> — Form groups with shared treasuries and collective
                decision-making
              </li>
            </ul>
          </div>
        ),
      },
      {
        question: 'How do projects work?',
        answer:
          'Projects are milestone-based funding vehicles. You set a goal, define milestones, and backers fund you knowing exactly what their support will achieve. Funds are tracked transparently. You can post updates and supporters can follow your progress. The Cat can help you structure milestones and write compelling descriptions.',
      },
      {
        question: 'What is the difference between a project and a cause?',
        answer:
          'Projects have milestones and accountability — backers expect progress reports and deliverables. Causes are no-strings funding for meaningful purposes — community support, education, environment, or any cause where the act of giving is the goal itself. Both can receive Bitcoin and Lightning payments.',
      },
      {
        question: 'How do loans work?',
        answer:
          'Loans connect borrowers and lenders directly. You set the amount, interest rate (or zero for interest-free), repayment schedule, and any collateral terms. OrangeCat records the agreement and tracks repayments. There is no bank in the middle — the agreement is between the two parties.',
      },
    ],
  },
  {
    title: 'Payments & Bitcoin',
    icon: Zap,
    color: 'text-fg-primary',
    items: [
      {
        question: 'Do I need Bitcoin to use OrangeCat?',
        answer:
          'You can sign up and publish without owning Bitcoin. To receive payments you need a Lightning or Bitcoin wallet. Fiat methods such as Twint and privacy coins are not available now; the roadmap explains the accountability tradeoffs.',
      },
      {
        question: 'What is the Lightning Network?',
        answer:
          "The Lightning Network is a payment layer built on top of Bitcoin. It enables near-instant transactions with fees of a fraction of a cent — far cheaper and faster than on-chain Bitcoin. Think of it as Bitcoin's payment rails for everyday transactions. Once you connect a Lightning-capable wallet, your username becomes a Lightning address (e.g. yourname@orangecat.ch) people can pay you at.",
      },
      {
        question: 'Does OrangeCat hold my Bitcoin?',
        answer:
          'No. OrangeCat never holds your funds. You add your own Bitcoin address or Lightning wallet address, and payments go directly to you. We record the transaction for transparency, but the money flows directly between sender and receiver without passing through OrangeCat.',
      },
      {
        question: 'What currencies are displayed?',
        answer:
          'You can choose your preferred display currency (CHF, USD, EUR, GBP, or Bitcoin) in your profile settings. All amounts are stored in BTC internally for precision, then converted for display using live exchange rates. This means you always see amounts in the currency you understand best.',
      },
    ],
  },
  {
    title: 'Groups & Governance',
    icon: Users,
    color: 'text-fg-primary',
    items: [
      {
        question: 'What are Groups?',
        answer:
          'Groups are organizations on OrangeCat with a shared identity, treasury, and governance. A group can have members with different roles, propose and vote on decisions, manage shared funds, and run economic activities collectively. Think DAOs, cooperatives, clubs, or any collective that needs to coordinate.',
      },
      {
        question: 'What is a Circle?',
        answer:
          'Circles are lighter-weight communities — less formal than groups, more suited for interest communities, study groups, or loose collaborations. Circles can share a space for discussion and coordination without the full governance machinery of a Group.',
      },
    ],
  },
  {
    title: 'Privacy & Security',
    icon: Shield,
    color: 'text-fg-primary',
    items: [
      {
        question: 'Who can see my activity?',
        answer:
          'You control visibility. Each entity (project, product, service, etc.) has a visibility setting: public (anyone can see), followers-only, or private (only you). Your profile information is also configurable. Pseudonymous use means you can be fully public without revealing your real identity.',
      },
      {
        question: 'How is my data protected?',
        answer:
          "All data is stored in a PostgreSQL database with row-level security — meaning queries are enforced at the database level so one user cannot access another's private data. Authentication is handled by Supabase Auth with industry-standard practices. Passwords are hashed and never stored in plaintext.",
      },
      {
        question: 'Can I delete my account?',
        answer:
          'Yes. You can delete your account from Settings. Deletion removes your profile and private data. Public transaction records (for transparency and audit purposes) may be anonymized rather than deleted, as they form part of a shared ledger of economic activity.',
      },
    ],
  },
];

function FaqAccordionItem({
  item,
  isOpen,
  onToggle,
}: {
  item: FaqItem;
  isOpen: boolean;
  onToggle: () => void;
}) {
  return (
    <div className="border border-default rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={onToggle}
        className="w-full flex items-center justify-between px-5 py-4 text-left bg-surface-base hover:bg-surface-raised transition-colors"
        aria-expanded={isOpen}
      >
        <span className="font-medium text-fg-primary pr-4">{item.question}</span>
        <ChevronDown
          className={cn(
            'h-5 w-5 text-fg-tertiary flex-shrink-0 transition-transform duration-200',
            isOpen && 'rotate-180'
          )}
        />
      </button>
      {isOpen && (
        <div className="px-5 pb-5 pt-1 bg-surface-base border-t border-subtle">
          <div className="text-base leading-relaxed text-fg-secondary">{item.answer}</div>
        </div>
      )}
    </div>
  );
}

export default function FAQPage() {
  const [openItems, setOpenItems] = useState<Record<string, boolean>>({});

  const toggle = (key: string) => {
    setOpenItems(prev => ({ ...prev, [key]: !prev[key] }));
  };

  return (
    <div className="min-h-screen pt-20 pb-24">
      {/* Header */}
      <div className="border-b border-default bg-surface-page py-16 px-4">
        <div className="max-w-3xl mx-auto text-center">
          <PageHeading className="mb-4">Frequently Asked Questions</PageHeading>
          <p className="text-xl text-fg-secondary max-w-2xl mx-auto">
            Everything you need to know about OrangeCat — your AI economic agent.
          </p>
        </div>
      </div>

      {/* Content — two-column at lg+ (sticky section list left, content right) */}
      <div className="max-w-6xl mx-auto px-4 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-[200px_minmax(0,1fr)] gap-8 lg:gap-12">
          {/* Sticky section nav — desktop only */}
          <aside className="hidden lg:block">
            <nav className="sticky top-24 space-y-1" aria-label="FAQ sections">
              {FAQ_SECTIONS.map(section => (
                <a
                  key={section.title}
                  href={`#${slugifyFaqSection(section.title)}`}
                  className="block rounded-md px-3 py-2 text-sm text-fg-secondary transition-colors hover:bg-surface-raised hover:text-fg-primary"
                >
                  {section.title}
                </a>
              ))}
            </nav>
          </aside>

          <div className="space-y-12">
            {FAQ_SECTIONS.map(section => {
              const Icon = section.icon;
              return (
                <section
                  key={section.title}
                  id={slugifyFaqSection(section.title)}
                  className="scroll-mt-24"
                >
                  <div className="flex items-center gap-3 mb-5">
                    <div className={cn('p-2 rounded-lg bg-surface-raised', section.color)}>
                      <Icon className="h-5 w-5" />
                    </div>
                    <h2 className="text-xl font-semibold text-fg-primary">{section.title}</h2>
                  </div>
                  <div className="space-y-2">
                    {section.items.map((item, i) => {
                      const key = `${section.title}-${i}`;
                      return (
                        <FaqAccordionItem
                          key={key}
                          item={item}
                          isOpen={!!openItems[key]}
                          onToggle={() => toggle(key)}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}

            {/* Still have questions */}
            <div className="text-center bg-surface-raised border border-default rounded-lg p-8">
              <h3 className="text-lg font-semibold text-fg-primary mb-2">Still have questions?</h3>
              <p className="text-fg-secondary mb-4">
                Ask the Cat directly — no account needed. It answers right away, and a human reads
                every message.
              </p>
              <div className="flex flex-wrap items-center justify-center gap-3">
                <Link
                  href={ROUTES.FEEDBACK}
                  className="inline-flex items-center gap-2 bg-fg-primary hover:bg-muted-strong text-fg-inverted font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Ask the Cat
                </Link>
                <a
                  href="mailto:hello@orangecat.ch"
                  className="inline-flex items-center gap-2 border border-default text-fg-primary hover:bg-surface-base font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Contact us
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function slugifyFaqSection(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}
