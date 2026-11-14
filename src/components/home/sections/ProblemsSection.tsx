import { PublicStartBand } from '@/components/layout/PublicStartBand';
import { FEE_CLAIMS } from '@/config/landing-page';
import { PROBLEMS_SECTION } from '@/config/problems-we-solve';
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

        <PublicStartBand className="mt-12 sm:mt-16">
          Whichever one is yours, it starts the same way: a free account and a page of your own.
          Selling on it costs {FEE_CLAIMS.platformFee}.
        </PublicStartBand>
      </div>
    </section>
  );
}
