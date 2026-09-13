import React from 'react';
import Link from 'next/link';
import { Metadata } from 'next';
import { Briefcase, Users, Zap, Heart, Globe, Coffee } from 'lucide-react';
import Button from '@/components/ui/Button';

export const metadata: Metadata = {
  title: 'Careers — Join Our Mission',
  description:
    'Work with us to build open economic participation around accountable Bitcoin settlement.',
};

/**
 * /company/careers — monochrome surfaces, single warm-accent CTA on the
 * Apply / View Open Positions buttons per Loki contract. Value
 * cards, position tiles, and perk pills all unified neutral. Migration 6/N.
 */
export default function CareersPage() {
  const openPositions = [
    {
      title: 'Senior Bitcoin Developer',
      department: 'Engineering',
      location: 'Remote / Switzerland',
      type: 'Full-time',
      description:
        'Build Bitcoin-native applications and integrations. Experience with Lightning Network, NWC, and BTCPay Server preferred.',
    },
    {
      title: 'Community Manager',
      department: 'Operations',
      location: 'Remote',
      type: 'Full-time',
      description:
        'Help grow and nurture communities of creators, researchers, entrepreneurs, and groups using OrangeCat worldwide.',
    },
    {
      title: 'Product Designer',
      department: 'Design',
      location: 'Remote / Switzerland',
      type: 'Full-time',
      description:
        'Design intuitive interfaces for economic participation — from funding to governance to AI-assisted workflows.',
    },
    {
      title: 'DevRel Engineer',
      department: 'Engineering',
      location: 'Remote',
      type: 'Full-time',
      description:
        'Build developer tools, documentation, and community around the OrangeCat platform and Cat agent ecosystem.',
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

  const perks = [
    '100% Remote Work',
    'Competitive Bitcoin Compensation',
    'Health & Dental Coverage',
    'Unlimited PTO',
    'Learning & Development Budget',
    'Bitcoin Conference Attendance',
    'Home Office Stipend',
    'Flexible Hours',
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
              Join OrangeCat
            </h1>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
              Help us build universal economic participation. Work on a platform that lets anyone —
              including a pseudonym or agent — organize and fund work with Bitcoin.
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
            Every role at OrangeCat contributes to this mission.
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

        {/* Open Positions */}
        <div className="mb-16">
          <h2 className="text-2xl font-semibold text-fg-primary text-center mb-12">
            Open Positions
          </h2>

          {openPositions.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {openPositions.map((position, index) => (
                <div
                  key={index}
                  className="bg-surface-base rounded-lg shadow-sm p-6 border border-default"
                >
                  <div className="flex justify-between items-start mb-4">
                    <div>
                      <h3 className="text-lg font-semibold text-fg-primary mb-1">
                        {position.title}
                      </h3>
                      <p className="text-fg-secondary font-medium text-sm">{position.department}</p>
                    </div>
                    <span className="px-3 py-1 bg-surface-raised text-fg-primary rounded-full text-sm font-medium">
                      {position.type}
                    </span>
                  </div>

                  <p className="text-fg-secondary text-sm mb-4">{position.description}</p>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-fg-secondary">{position.location}</span>
                    <Button variant="accent" size="sm">
                      Apply Now
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
                <Coffee className="w-8 h-8 text-fg-tertiary/50" />
              </div>
              <h3 className="text-lg font-semibold text-fg-primary mb-2">
                No Open Positions Right Now
              </h3>
              <p className="text-fg-secondary mb-6">
                We&apos;re always growing! Send us your resume and we&apos;ll keep you in mind for
                future opportunities.
              </p>
              <Button variant="accent" size="lg">
                Send Your Resume
              </Button>
            </div>
          )}
        </div>

        {/* Perks & Benefits */}
        <div className="bg-surface-base rounded-lg shadow-sm p-8 mb-16">
          <h2 className="text-2xl font-semibold text-fg-primary text-center mb-8">
            Why Work With Us?
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {perks.map((perk, index) => (
              <div
                key={index}
                className="flex items-center p-4 bg-surface-raised/40 border border-subtle rounded-lg"
              >
                <div className="w-8 h-8 bg-surface-raised border border-subtle rounded-full flex items-center justify-center mr-3">
                  <span className="text-fg-secondary text-sm font-bold">✓</span>
                </div>
                <span className="text-fg-primary font-medium text-sm">{perk}</span>
              </div>
            ))}
          </div>

          <div className="text-center">
            <p className="text-fg-secondary mb-6">
              We believe in compensating our team fairly with competitive salaries, Bitcoin bonuses,
              and benefits that support work-life balance.
            </p>
          </div>
        </div>

        {/* CTA */}
        <div className="text-center">
          <h2 className="text-2xl font-semibold text-fg-primary mb-4">
            Ready to Join Our Mission?
          </h2>
          <p className="text-lg text-fg-secondary mb-8 max-w-2xl mx-auto">
            Whether we have an open position or not, we&apos;d love to hear from talented
            individuals who share our passion for open economic participation and Bitcoin.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link href="#open-positions">
              <Button variant="accent" size="lg">
                View Open Positions
              </Button>
            </Link>
            <Button variant="outline" size="lg">
              Send Your Resume
            </Button>
          </div>

          <p className="text-sm text-fg-secondary mt-6">
            We are an equal opportunity employer and value diversity at our company. We do not
            discriminate on the basis of race, religion, color, national origin, gender, sexual
            orientation, age, marital status, veteran status, or disability status.
          </p>
        </div>
      </div>
    </div>
  );
}
