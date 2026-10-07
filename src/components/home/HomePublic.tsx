import HeroSectionStatic from '@/components/home/sections/HeroSectionStatic';
import FirstMoveSection from '@/components/home/sections/FirstMoveSection';
import ProblemsSection from '@/components/home/sections/ProblemsSection';

/**
 * Public home page — one fold, three first moves, then what it solves.
 *
 * The first moves stay directly under the hero so nobody has to read before
 * acting. "What it solves" follows for the visitor who needs to know what
 * this is for before they act: concrete problems for one person and for
 * society, each linked to the feature that solves it. Longer explanation
 * (steps, comparison) still lives on /how-it-works and /discover.
 */
export default function HomePublic() {
  return (
    <div className="min-h-screen">
      <HeroSectionStatic />
      <FirstMoveSection />
      <ProblemsSection />
    </div>
  );
}
