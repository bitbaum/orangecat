import { Cat } from 'lucide-react';
import Button from '@/components/ui/Button';
import { CTA_LABELS } from '@/config/landing-page';
import { PROBLEMS_SECTION } from '@/config/problems-we-solve';
import { ROUTES } from '@/config/routes';
import ProblemsExplorer from './ProblemsExplorer';

/**
 * "What it solves": concrete problems, one person's first, then society's.
 * The picker (ProblemsExplorer) shows one scale at a time and one answer at a
 * time; each answer's action is read from the registry, so it names and
 * links a real feature.
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

        <ProblemsExplorer />

        <div className="mt-12 sm:mt-16 flex flex-col sm:flex-row sm:items-center gap-4 oc-surface p-5 sm:p-6">
          <p className="flex-1 text-base sm:text-lg text-fg-primary">
            Don’t see your problem? Describe it to your Cat. It will tell you which of these fits,
            and set it up.
          </p>
          <Button
            href={ROUTES.AUTH}
            variant="accent"
            size="lg"
            className="w-full sm:w-auto w-full sm:w-auto"
          >
            <Cat className="mr-2 h-4 w-4 sm:h-5 sm:w-5" />
            {CTA_LABELS.primaryAction}
          </Button>
        </div>
      </div>
    </section>
  );
}
