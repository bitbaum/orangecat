import React from 'react';
import { Metadata } from 'next';
import { Briefcase, Users, Zap, Heart, Globe, Code, Handshake, Bitcoin } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';

export const metadata: Metadata = {
  title: 'Build with us',
  description:
    'OrangeCat is open source under the MIT licence. Ways to build it with us: code, partnership, or backing.',
};

/**
 * /company/careers — the ways in. It used to list four full-time openings with
 * salaries, health cover and unlimited PTO, none of which existed, under
 * buttons that went nowhere. The true doors are the open repository, the
 * partners (on bitbaum) and backing in Bitcoin, so those are what it lists.
 */
export default function CareersPage() {
  const ways = [
    {
      icon: <Code className="w-6 h-6" />,
      title: 'Contribute code',
      description:
        'The whole platform is open source under the MIT licence. Read it, open an issue, or send a pull request.',
      href: 'https://github.com/bitbaum/orangecat',
      label: 'Open the repository',
    },
    {
      icon: <Handshake className="w-6 h-6" />,
      title: 'Build for others as a partner',
      description:
        'Partners are independent engineers who watch over projects built with Loki and move them forward, at their own price. You apply on bitbaum; the studio approves who is listed.',
      href: ROUTES.PARTNERS,
      label: 'See the partners',
    },
    {
      icon: <Bitcoin className="w-6 h-6" />,
      title: 'Back it in Bitcoin',
      description: 'Fund the economy, execution or governance layer — or all three.',
      href: ROUTES.SUPPORT,
      label: 'Choose what to support',
    },
  ];

  const values = [
    {
      icon: <Heart className="w-6 h-6" />,
      title: 'Open Economic Access',
      description:
        'We believe any person, pseudonym, or organization should be able to participate in the full economic spectrum — without gatekeepers.',
    },
    {
      icon: <Users className="w-6 h-6" />,
      title: 'Community Driven',
      description:
        'Our success depends on the communities we serve. We listen, learn, and build together.',
    },
    {
      icon: <Zap className="w-6 h-6" />,
      title: 'Always Day 1',
      description:
        'We maintain an entrepreneurial mindset, staying agile and innovative in everything we do.',
    },
    {
      icon: <Globe className="w-6 h-6" />,
      title: 'Global Impact',
      description:
        'Our work empowers creators, communities, and individuals worldwide to participate economically under their chosen identity.',
    },
  ];

  return (
    <div className="min-h-screen bg-surface-page">
      {/* Hero Section */}
      <div className="bg-surface-base border-b border-default">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
          <div className="text-center">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-surface-raised border border-subtle rounded-full mb-8">
              <Briefcase className="w-8 h-8 text-fg-secondary" />
            </div>
            <h1 className="font-heading tracking-display text-4xl font-bold text-fg-primary sm:text-5xl mb-4">
              Build OrangeCat with us
            </h1>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
              A platform that lets anyone — including a pseudonym or agent — organize and fund work
              with Bitcoin. It is built in the open, and there is more than one way in.
            </p>
          </div>
        </div>
      </div>

      {/* Our Mission */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-16">
          <h2 className="text-2xl font-semibold text-fg-primary mb-6">Why OrangeCat?</h2>
          <p className="text-lg text-fg-secondary max-w-4xl mx-auto">
            We&apos;re not just building software — we&apos;re creating infrastructure for open
            economic participation. Bitcoin is the only live settlement rail while other payment
            systems remain explicit roadmap work. The Cat helps every user navigate that economy.
          </p>
        </div>

        {/* Values */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-16">
          {values.map((value, index) => (
            <div key={index} className="text-center p-6 bg-surface-base rounded-lg shadow-sm">
              <div className="w-12 h-12 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mx-auto mb-4 text-fg-secondary">
                {value.icon}
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">{value.title}</h3>
              <p className="text-fg-secondary text-sm">{value.description}</p>
            </div>
          ))}
        </div>

        {/* Ways in */}
        <div id="ways-in" className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {ways.map(way => (
            <div
              key={way.title}
              className="flex flex-col bg-surface-base rounded-lg shadow-sm p-6 border border-default"
            >
              <div className="w-12 h-12 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mb-4 text-fg-secondary">
                {way.icon}
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">{way.title}</h3>
              <p className="text-fg-secondary text-sm mb-6 flex-1">{way.description}</p>
              <Button href={way.href} variant="outline" size="sm">
                {way.label}
              </Button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
