import Card from '@/components/ui/Card';
import { Shield, Zap, Eye, Sparkles } from 'lucide-react';
import { HOW_IT_WORKS_STEPS, SECTION_HEADERS, FEE_CLAIMS } from '@/config/landing-page';
import { INTENT_LIST } from '@/config/intents';
import { ROUTES } from '@/config/routes';
import { PUBLIC_PAGE_WIDTH, PublicPageHeader } from '@/components/layout/PublicPageHeader';
import { PublicLinkList } from '@/components/layout/PublicLinkList';
import { PublicStartBand } from '@/components/layout/PublicStartBand';

/**
 * How it works: the steps a person takes, what each kind of thing they can
 * do here is for, and why it settles in Bitcoin — then the one way to start.
 *
 * Its title used to be "Meet Your Cat" and its middle a compact copy of the
 * capability cards on /what-you-can-do. The middle is now one row per intent,
 * each a link into that page's section, so the detail lives in one place.
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

const intentRows = INTENT_LIST.map(intent => ({
  href: `${ROUTES.WHAT_YOU_CAN_DO}#do-${intent.id}`,
  title: intent.title,
  line: intent.how,
}));

export default function HowItWorksPage() {
  const { howItWorks, whatCanYouDo } = SECTION_HEADERS;

  return (
    <div className="min-h-screen bg-surface-page pb-16">
      <div className={PUBLIC_PAGE_WIDTH.wide}>
        <PublicPageHeader title={howItWorks.title} lede={howItWorks.subtitle} />

        <section aria-labelledby="steps-heading" className="max-w-5xl mx-auto mb-20">
          <h2 id="steps-heading" className="text-2xl font-semibold text-center mb-12">
            Get started in {HOW_IT_WORKS_STEPS.length} steps
          </h2>

          <ol className="space-y-8">
            {HOW_IT_WORKS_STEPS.map(step => {
              const Icon = step.icon;
              return (
                <li key={step.number}>
                  <Card className="p-6 md:p-8">
                    <div className="flex flex-col md:flex-row gap-6">
                      <div className="flex-shrink-0">
                        <div className="oc-icon-tile mb-4 h-12 w-12 md:mb-0">
                          <Icon className="h-6 w-6" />
                        </div>
                      </div>

                      <div className="flex-1">
                        <div className="flex items-start gap-3 mb-3">
                          <span className="mt-1 shrink-0 rounded-full border border-default bg-surface-raised px-3 py-1 text-xs font-medium uppercase tracking-caps text-fg-secondary">
                            Step {step.number}
                          </span>
                          <h3 className="text-2xl font-bold text-fg-primary flex-1">
                            {step.title}
                          </h3>
                        </div>
                        <p className="mb-0 text-fg-secondary text-lg leading-relaxed">
                          {step.description}
                        </p>
                      </div>
                    </div>
                  </Card>
                </li>
              );
            })}
          </ol>
        </section>

        <section aria-labelledby="what-heading" className="max-w-3xl mx-auto mb-20">
          <div className="text-center mb-8">
            <h2 id="what-heading" className="text-2xl font-semibold mb-4">
              {whatCanYouDo.title}
            </h2>
            <p className="text-xl text-fg-secondary">{whatCanYouDo.subtitle}</p>
          </div>
          <PublicLinkList rows={intentRows} />
        </section>

        <section aria-labelledby="why-bitcoin-heading" className="mb-20">
          <div className="text-center mb-12">
            <h2 id="why-bitcoin-heading" className="text-2xl font-semibold mb-4">
              Why Bitcoin powers everything
            </h2>
            <p className="text-xl text-fg-secondary max-w-3xl mx-auto">
              Bitcoin isn't just a payment method—it's the foundation for transparent, global,
              permissionless transactions.
            </p>
          </div>

          <div className="grid md:grid-cols-2 gap-6 max-w-5xl mx-auto">
            {whyBitcoin.map(item => {
              const Icon = item.icon;
              return (
                <Card key={item.title} className="p-6 h-full">
                  <div className="flex items-start gap-4">
                    <div className="bg-surface-raised p-3 rounded-lg flex-shrink-0">
                      <Icon className="w-6 h-6 text-fg-primary" />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold mb-2">{item.title}</h3>
                      <p className="mb-0 text-fg-secondary leading-relaxed">{item.description}</p>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        </section>

        <PublicStartBand className="max-w-5xl mx-auto">
          Tell your Cat what you want to do. It sets it up; Bitcoin settles; you stay in charge.
        </PublicStartBand>
      </div>
    </div>
  );
}
