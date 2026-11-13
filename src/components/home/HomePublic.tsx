import HeroSection from '@/components/home/sections/HeroSection';
import StudioSection from '@/components/home/sections/StudioSection';
import ProblemsSection from '@/components/home/sections/ProblemsSection';

/**
 * Public home page — one fold, then what it solves, then the studio behind it.
 *
 * The fold carries the three first moves itself (meet your Cat, see what
 * exists, how it works). "What it solves" comes next, for the visitor who
 * needs to know what this is for before they act. On a phone it used to sit
 * under about 4,100px of studio products, a dozen screens down; the owner
 * chose this order on 2026-11-12. The studio follows: the products built on
 * this stack, live, each with its own mark — the proof that this is a
 * working economy and not a pitch. Longer explanation (steps, comparison)
 * still lives on /how-it-works and /discover.
 */
export default function HomePublic() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <ProblemsSection />
      <StudioSection />
    </div>
  );
}
