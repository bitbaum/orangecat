import HeroSection from '@/components/home/sections/HeroSection';
import StudioSection from '@/components/home/sections/StudioSection';
import ProblemsSection from '@/components/home/sections/ProblemsSection';

/**
 * Public home page — one fold, then the studio behind it, then what it solves.
 *
 * The fold carries the three first moves itself (meet your Cat, see what
 * exists, how it works), so the row of three cards that used to repeat them
 * directly underneath is gone. Next comes the studio: the products built on
 * this stack, live, each with its own mark — the proof that this is a
 * working economy and not a pitch. "What it solves" follows for the visitor
 * who needs to know what this is for before they act. Longer explanation
 * (steps, comparison) still lives on /how-it-works and /discover.
 */
export default function HomePublic() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <StudioSection />
      <ProblemsSection />
    </div>
  );
}
