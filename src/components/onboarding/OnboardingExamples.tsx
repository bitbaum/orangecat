'use client';

const EXAMPLE_PROMPTS = [
  "I'm a freelance graphic designer looking to find clients and sell design templates",
  'I run a small community garden and want to raise funds for seeds and equipment',
  'I make handmade jewellery and want to start selling online',
  "I'm a musician who wants to fund an album and connect with fans",
  'I teach yoga and want to offer online classes and workshops',
  'My neighbourhood needs a community space — I want to fundraise and organise it',
];

/** How many to show: three whole sentences read; six wrapped pills were a wall. */
const SHOWN = 3;

/**
 * Example bios to start from: whole sentences, one per row, each a full-width
 * 44px target, so none is cut mid-word and nothing wraps into a pill box.
 */
export function OnboardingExamples({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-2">
      <p
        id="onboarding-examples"
        className="mb-0 text-xs font-medium uppercase tracking-wide text-fg-secondary"
      >
        Examples
      </p>
      <ul aria-labelledby="onboarding-examples" className="flex flex-col gap-2">
        {EXAMPLE_PROMPTS.slice(0, SHOWN).map(prompt => (
          <li key={prompt}>
            <button
              type="button"
              onClick={() => onPick(prompt)}
              className="flex min-h-11 w-full items-center rounded-md border border-subtle px-3 py-2 text-left text-sm text-fg-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-fg-primary"
            >
              {prompt}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
