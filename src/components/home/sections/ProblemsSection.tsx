import Link from 'next/link';
import { ArrowRight, Cat } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { CTA_LABELS } from '@/config/landing-page';
import { PROBLEMS_SECTION, PROBLEM_SCALES } from '@/config/problems-we-solve';
import { ROUTES } from '@/config/routes';

/**
 * "What it solves": concrete problems, one person's first, then society's.
 * Each card is problem → what happens → the entity that does it. That last
 * line is read from the registry, so it names and links a real feature.
 */
export default function ProblemsSection() {
  return (
    <section
      aria-labelledby="problems-heading"
      className="py-12 sm:py-20 bg-surface-page border-t border-default"
    >
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8">
        <header className="max-w-3xl">
          <h2
            id="problems-heading"
            className="font-heading tracking-display text-2xl sm:text-4xl font-bold text-fg-primary"
          >
            {PROBLEMS_SECTION.title}
          </h2>
          <p className="mt-3 text-base sm:text-lg text-fg-secondary">{PROBLEMS_SECTION.subtitle}</p>
        </header>

        {PROBLEM_SCALES.map(scale => (
          <div key={scale.id} className="mt-10 sm:mt-14">
            <h3 className="text-xl sm:text-2xl font-semibold text-fg-primary">{scale.title}</h3>
            <p className="mt-1 text-sm sm:text-base text-fg-secondary">{scale.subtitle}</p>

            <ul className="mt-5 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {scale.items.map(item => {
                const meta = ENTITY_REGISTRY[item.entityType];
                const Icon = meta.icon;
                return (
                  <li key={item.id} className="oc-surface flex h-full min-w-0 flex-col p-5 sm:p-6">
                    <p className="text-base sm:text-lg font-semibold text-fg-primary">
                      {item.problem}
                    </p>
                    <p className="mt-3 text-sm sm:text-base text-fg-secondary flex-1">
                      {item.solution}
                    </p>
                    <Link
                      href={meta.createPath}
                      className="mt-5 inline-flex min-h-11 items-center gap-2 text-sm font-semibold text-fg-primary hover:underline"
                    >
                      <Icon className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                      <span>{meta.plain.verb}</span>
                      <ArrowRight className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>
        ))}

        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row sm:items-center gap-4 oc-surface p-5 sm:p-6">
          <p className="flex-1 text-base sm:text-lg text-fg-primary">
            Don’t see your problem? Describe it to your Cat. It will tell you which of these fits,
            and set it up.
          </p>
          <Link href={ROUTES.AUTH} className="w-full sm:w-auto">
            <Button variant="accent" size="lg" className="w-full sm:w-auto">
              <Cat className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
              {CTA_LABELS.primaryAction}
            </Button>
          </Link>
        </div>
      </div>
    </section>
  );
}
