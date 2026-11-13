'use client';

const EXAMPLE_PROMPTS = [
  "I'm a freelance graphic designer looking to find clients and sell design templates",
  'I run a small community garden and want to raise funds for seeds and equipment',
  'I make handmade jewellery and want to start selling online',
  "I'm a musician who wants to fund an album and connect with fans",
  'I teach yoga and want to offer online classes and workshops',
  'My neighbourhood needs a community space — I want to fundraise and organise it',
];

/**
 * Example bios to start from. Each chip shows the whole sentence and lets CSS
 * clamp it to two lines, so a long one ends at a line, not mid-word as the old
 * 50-character slice did ("start sellin…").
 */
export function OnboardingExamples({ onPick }: { onPick: (prompt: string) => void }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-fg-tertiary font-medium uppercase tracking-wide">Examples</p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_PROMPTS.map(prompt => (
          <button
            key={prompt}
            type="button"
            onClick={() => onPick(prompt)}
            className="rounded-sm border border-subtle px-3 py-1.5 text-left text-xs text-fg-secondary transition-colors hover:border-strong hover:bg-surface-raised hover:text-fg-primary"
          >
            <span className="line-clamp-2">{prompt}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
