import HeroSection from '@/components/home/sections/HeroSection';
import MakersSection from '@/components/home/sections/MakersSection';
import FirstAnswerSection from '@/components/home/sections/FirstAnswerSection';
import ProblemsSection from '@/components/home/sections/ProblemsSection';

/**
 * Public home page: the outcome, the proof, a first answer, then what it solves.
 *
 * The fold is the promise and the one action that delivers it (claim your pay
 * link). Under it, what people have actually listed, from Discover. Then the
 * Cat's door, where a visitor's own sentence gets one real answer before any
 * account. "What it solves" follows for the visitor who needs to know what
 * this is for, and ends on the one start action. The studio's own products
 * used to stand here as the proof; they are on /ecosystem, and the longer
 * explanation (steps, comparison) is on /how-it-works.
 */
export default function HomePublic() {
  return (
    <div className="min-h-screen">
      <HeroSection />
      <MakersSection />
      <FirstAnswerSection />
      <ProblemsSection />
    </div>
  );
}
