'use client';

import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { PageLayout, PageHeader, PageSection } from '@/components/layout/PageLayout';
import {
  Bitcoin,
  Zap,
  Users,
  Globe,
  ArrowRight,
  Check,
  BarChart3,
  Ticket,
  QrCode,
  Camera,
  PartyPopper,
  Palette,
  Tent,
  Music,
} from 'lucide-react';
import { BADGE_COLORS } from '@/config/badge-colors';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { FEE_CLAIMS } from '@/config/landing-page';
import { authLoginPath } from '@/lib/navigation/safe-return-path';

export default function EventsPage() {
  const _router = useRouter();
  const { user: _user, session } = useAuth();

  const features = [
    {
      icon: Ticket,
      title: 'Bitcoin Ticketing',
      description:
        'Sell tickets with Bitcoin, accept instant payments, and eliminate payment processing fees',
    },
    {
      icon: QrCode,
      title: 'Smart Check-in',
      description:
        'QR code entry system with real-time attendance tracking and automated verification',
    },
    {
      icon: Users,
      title: 'RSVP Management',
      description:
        'Track responses, manage capacity limits, and send automated updates to attendees',
    },
    {
      icon: Globe,
      title: 'Global Reach',
      description: 'Connect with attendees worldwide through open, borderless event discovery',
    },
    {
      icon: Camera,
      title: 'Event Media',
      description:
        'Share photos, live updates, and create lasting memories with integrated media tools',
    },
    {
      icon: BarChart3,
      title: 'Event Analytics',
      description: 'Track attendance, engagement, and revenue with comprehensive event insights',
    },
  ];

  const eventTypes = [
    {
      category: 'Social Events',
      icon: PartyPopper,
      examples: [
        'Birthday Parties',
        'Anniversary Celebrations',
        'Graduation Parties',
        'Holiday Gatherings',
      ],
      color: BADGE_COLORS.pink,
    },
    {
      category: 'Art & Culture',
      icon: Palette,
      examples: ['Art Exhibits', 'Gallery Openings', 'Photography Shows', 'Cultural Festivals'],
      color: BADGE_COLORS.tiffany,
    },
    {
      category: 'Adventure & Travel',
      icon: Tent,
      examples: [
        'Weekend Getaways',
        'Group Hiking Trips',
        'Camping Adventures',
        'City Explorations',
      ],
      color: BADGE_COLORS.success,
    },
    {
      category: 'Community & Business',
      icon: Music,
      examples: ['Local Festivals', 'Professional Meetups', 'Workshops', 'Networking Events'],
      color: BADGE_COLORS.info,
    },
  ];

  const benefits = [
    'Zero ticket processing fees - keep 100% of revenue',
    'Instant Bitcoin payments directly to your wallet',
    'Global attendee reach with no geographic barriers',
    'Automated check-in and attendance management',
    'Integrated event promotion and social sharing',
    'Real-time analytics and performance tracking',
    'Flexible pricing with Bitcoin and fiat options',
    'Professional event pages with customization',
  ];

  const handleGetStarted = () => {
    if (session) {
      _router.push(`${ENTITY_REGISTRY['event'].publicBasePath}/create`);
    } else {
      _router.push(authLoginPath(`${ENTITY_REGISTRY['event'].publicBasePath}/create`));
    }
  };

  return (
    <PageLayout>
      {/* Hero Section */}
      <PageHeader
        title="Event Organization with Bitcoin"
        description="Create unforgettable parties, art exhibits, and gatherings with seamless ticketing and Bitcoin-powered event management"
      />

      {/* Key Features */}
      <PageSection>
        <h2 className="text-2xl font-semibold text-center mb-12">Why Choose Bitcoin for Events?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className="p-6 text-center">
              <feature.icon className="w-12 h-12 text-fg-primary mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-3">{feature.title}</h3>
              <p className="text-fg-secondary">{feature.description}</p>
            </Card>
          ))}
        </div>
      </PageSection>

      {/* Event Types */}
      <PageSection background="tiffany">
        <h2 className="text-2xl font-semibold text-center mb-12">What Events Can You Organize?</h2>
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
          {eventTypes.map((type, index) => (
            <Card key={index} className="p-6">
              <type.icon className={`w-12 h-12 mx-auto mb-4 ${type.color}`} />
              <h3 className="text-lg font-semibold mb-4 text-center">{type.category}</h3>
              <ul className="text-fg-secondary space-y-2">
                {type.examples.map((example, i) => (
                  <li key={i} className="flex items-center text-sm">
                    <Check className="w-4 h-4 text-fg-primary mr-2 flex-shrink-0" />
                    {example}
                  </li>
                ))}
              </ul>
            </Card>
          ))}
        </div>
      </PageSection>

      {/* Benefits Section */}
      <PageSection>
        <div className="grid lg:grid-cols-2 gap-12 items-center">
          <div>
            <h2 className="text-2xl font-semibold mb-6">Why Event Organizers Choose OrangeCat</h2>
            <div className="space-y-4">
              {benefits.map((benefit, index) => (
                <div key={index} className="flex items-start">
                  <Check className="w-5 h-5 text-fg-primary mr-3 mt-0.5 flex-shrink-0" />
                  <span className="text-fg-primary">{benefit}</span>
                </div>
              ))}
            </div>
          </div>
          {/* Right column previously rendered a 4-card "stat" grid:
              0% Processing Fees / < 2min Ticket Setup / Global Attendee Reach /
              Instant Check-in. Three of those (< 2min, Global, Instant) are
              qualitative claims styled as measured stats — we have no
              benchmark backing them. The 0% claim duplicates the homepage
              hero. Replaced with a feature list that doesn't pretend to
              have measurements behind it. */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Card className="p-6">
              <Bitcoin className="w-8 h-8 text-fg-primary mb-3" />
              <h3 className="font-semibold mb-1">
                {FEE_CLAIMS.feeBadgeLabel.replace('fees', 'platform fees')}
              </h3>
              <p className="text-sm text-fg-secondary">
                Ticket sales go directly to your Bitcoin or Lightning wallet — we never sit between
                you and the buyer.
              </p>
            </Card>
            <Card className="p-6">
              <Zap className="w-8 h-8 text-fg-primary mb-3" />
              <h3 className="font-semibold mb-1">Lightning-Native</h3>
              <p className="text-sm text-fg-secondary">
                Accept micropayments and full-price tickets over Lightning with no special
                integration.
              </p>
            </Card>
            <Card className="p-6">
              <Users className="w-8 h-8 text-fg-primary mb-3" />
              <h3 className="font-semibold mb-1">No Geographic Limits</h3>
              <p className="text-sm text-fg-secondary">
                Bitcoin works the same in every country. Anyone with a wallet can buy a ticket.
              </p>
            </Card>
            <Card className="p-6">
              <QrCode className="w-8 h-8 text-fg-primary mb-3" />
              <h3 className="font-semibold mb-1">QR Check-In</h3>
              <p className="text-sm text-fg-secondary">
                Each ticket gets a unique code attendees show at the door — no printing, no apps to
                install.
              </p>
            </Card>
          </div>
        </div>
      </PageSection>

      {/* How It Works */}
      <PageSection background="gray">
        <h2 className="text-2xl font-semibold text-center mb-12">How Event Organization Works</h2>
        <div className="grid md:grid-cols-4 gap-6">
          <div className="text-center">
            <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-fg-primary">1</span>
            </div>
            <h3 className="text-lg font-semibold mb-3">Create Your Event</h3>
            <p className="text-fg-secondary">
              Set up your event details, ticket pricing, and Bitcoin payment address
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-fg-primary">2</span>
            </div>
            <h3 className="text-lg font-semibold mb-3">Promote & Sell</h3>
            <p className="text-fg-secondary">
              Share your event and sell tickets with instant Bitcoin payments
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-fg-primary">3</span>
            </div>
            <h3 className="text-lg font-semibold mb-3">Manage Attendees</h3>
            <p className="text-fg-secondary">
              Track RSVPs, send updates, and manage your attendee list
            </p>
          </div>
          <div className="text-center">
            <div className="w-16 h-16 bg-surface-raised rounded-full flex items-center justify-center mx-auto mb-4">
              <span className="text-2xl font-bold text-fg-primary">4</span>
            </div>
            <h3 className="text-lg font-semibold mb-3">Run the Event</h3>
            <p className="text-fg-secondary">
              Use QR check-in, track attendance, and create memorable experiences
            </p>
          </div>
        </div>
      </PageSection>

      {/* CTA Section */}
      <PageSection>
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-6">Ready to Organize Your Event?</h2>
          <p className="text-xl text-fg-secondary mb-8 max-w-2xl mx-auto">
            Join event organizers worldwide who use OrangeCat to create amazing experiences with
            seamless ticketing and Bitcoin-native payments.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Button
              onClick={handleGetStarted}
              size="lg"
              className="bg-surface-raised hover:bg-fg-primary text-fg-primary hover:text-fg-inverted transition-colors"
            >
              Create Your Event
              <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </div>
        </div>
      </PageSection>
    </PageLayout>
  );
}
