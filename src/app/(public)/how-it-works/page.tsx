'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import { Shield, Zap, Eye, Sparkles, ArrowRight } from 'lucide-react';
import {
  HOW_IT_WORKS_STEPS,
  SECTION_HEADERS,
  CTA_LABELS,
  SUPER_APP_CATEGORIES,
  FEE_CLAIMS,
} from '@/config/landing-page';
import { ROUTES } from '@/config/routes';

/**
 * How It Works Page - Detailed walkthrough
 *
 * Uses the same steps as the home page for consistency; the count comes from
 * HOW_IT_WORKS_STEPS, so adding a step cannot leave the heading lying about
 * how many there are.
 */

const whyBitcoin = [
  {
    icon: Shield,
    title: 'Trustless & Secure',
    description:
      "Bitcoin's blockchain ensures every transaction is permanent, transparent, and immutable. No chargebacks.",
  },
  {
    icon: Zap,
    title: 'Fast & Borderless',
    description:
      'Send and receive funds anywhere in the world, instantly with Lightning Network or within minutes on-chain.',
  },
  {
    icon: Eye,
    title: 'Complete Transparency',
    description:
      'Every transaction is publicly verifiable on the Bitcoin blockchain. Build trust through radical transparency.',
  },
  {
    icon: Sparkles,
    title: 'Zero Platform Fees',
    description: `Direct peer-to-peer payments. ${FEE_CLAIMS.passthroughClaim}`,
  },
];

export default function HowItWorksPage() {
  const { howItWorks, whatCanYouDo } = SECTION_HEADERS;

  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className="container mx-auto px-4">
        {/* Hero Section */}
        <div className="text-center py-12 sm:py-16 mb-8">
          <div className="inline-flex items-center gap-2 bg-surface-base text-fg-primary border border-default px-4 py-2 rounded-full mb-6">
            <Sparkles className="w-4 h-4" />
            <span className="text-sm font-medium">Simple, Universal, Powerful</span>
          </div>
          <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold mb-6 text-fg-primary">
            {howItWorks.title}
          </h1>
          <p className="text-xl text-fg-secondary max-w-3xl mx-auto leading-relaxed">
            Make the work, raise the money to finish it, and get paid for it — in one place, under
            whatever name you choose.
          </p>
        </div>

        {/* Steps Section - Matches home page; count derived from the SSOT */}
        <div className="max-w-5xl mx-auto mb-20">
          <h2 className="text-3xl font-bold text-center mb-12">
            Get Started in {HOW_IT_WORKS_STEPS.length} Simple Steps
          </h2>

          <div className="space-y-8">
            {HOW_IT_WORKS_STEPS.map(step => {
              const Icon = step.icon;
              return (
                <div key={step.number}>
                  <Card className="p-6 md:p-8 oc-card-link">
                    <div className="flex flex-col md:flex-row gap-6">
                      {/* Step Number & Icon */}
                      <div className="flex-shrink-0">
                        <div
                          className={`${step.iconGradient} w-16 h-16 rounded-full flex items-center justify-center text-white mb-4 md:mb-0`}
                        >
                          <Icon className="w-8 h-8" />
                        </div>
                      </div>

                      {/* Content */}
                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <span
                            className={`${step.iconGradient} text-white text-sm font-bold px-3 py-1 rounded-full`}
                          >
                            Step {step.number}
                          </span>
                          <h3 className="text-2xl font-bold text-fg-primary flex-1">
                            {step.title}
                          </h3>
                        </div>
                        <p className="text-fg-secondary text-lg leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* What You Can Do Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold mb-4">{whatCanYouDo.title}</h2>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">{whatCanYouDo.subtitle}</p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {SUPER_APP_CATEGORIES.map(category => {
              const Icon = category.icon;
              return (
                <div key={category.id}>
                  <Card className="p-6 h-full oc-card-link">
                    <div className="flex items-start gap-4">
                      <div className={`${category.bgColor} p-3 rounded-lg flex-shrink-0`}>
                        <Icon className="w-6 h-6 text-fg-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{category.title}</h3>
                        <p className="text-fg-secondary mb-3">{category.description}</p>
                        <ul className="space-y-1">
                          {category.features.map(feature => (
                            <li
                              key={feature.title}
                              className="text-sm text-fg-secondary flex items-center gap-2"
                            >
                              <div
                                className={`w-1.5 h-1.5 rounded-full ${category.iconGradient}`}
                              />
                              {feature.title}: {feature.description}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* Why Bitcoin Section */}
        <div className="mb-20">
          <div className="text-center mb-12">
            <h2 className="text-2xl font-semibold mb-4">Why Bitcoin Powers Everything</h2>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
              Bitcoin isn't just a payment method—it's the foundation for transparent, global,
              permissionless transactions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {whyBitcoin.map(item => {
              const Icon = item.icon;
              return (
                <div key={item.title}>
                  <Card className="p-6 h-full oc-card-link">
                    <div className="flex items-start gap-4">
                      <div className="bg-surface-raised p-3 rounded-lg flex-shrink-0">
                        <Icon className="w-6 h-6 text-fg-primary" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                        <p className="text-fg-secondary leading-relaxed">{item.description}</p>
                      </div>
                    </div>
                  </Card>
                </div>
              );
            })}
          </div>
        </div>

        {/* CTA Section */}
        <div className="text-center">
          <Card className="p-12 bg-surface-raised/30 border-default">
            <h2 className="text-2xl font-semibold mb-4">Ready to Get Started?</h2>
            <p className="text-xl text-fg-secondary mb-8 max-w-2xl mx-auto">
              Make it in the Studio, publish it, fund it, and coordinate it — with your AI agent
              doing the setup. Bitcoin is the settlement rail available today.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button
                href={`${ROUTES.AUTH}?mode=register`}
                size="lg"
                variant="gradient"
                className="group"
              >
                {CTA_LABELS.createAccount}
                <ArrowRight className="ml-2 w-5 h-5 group-hover:translate-x-1 transition-transform" />
              </Button>
              <Button href={ROUTES.DISCOVER} variant="outline" size="lg">
                {CTA_LABELS.secondaryAction}
              </Button>
            </div>
            <p className="mt-6 text-sm text-fg-secondary">
              No credit card required • Free forever • Set up in minutes
            </p>
          </Card>
        </div>

        {/* Additional Help */}
        <div className="mt-12 text-center">
          <p className="text-fg-secondary mb-4">Need more help?</p>
          <div className="flex flex-wrap gap-4 justify-center">
            <Button href={ROUTES.STUDIO} variant="ghost">
              See the Studio
            </Button>
            <Button href={ROUTES.DISCOVER} variant="ghost">
              See What Others Are Doing
            </Button>
            <Button href={ROUTES.ABOUT} variant="ghost">
              About OrangeCat
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
