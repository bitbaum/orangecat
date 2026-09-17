/**
 * A public page may not claim a version the app is not on.
 *
 * `/docs` told the world it ran Next.js 15, TypeScript 5.8 and Tailwind CSS 3
 * while the app was on 16, 6 and 4. It was not a stale comment in a private
 * file — it was the public documentation, which is what a coding agent reads
 * before it touches this repo, and what a person reads before trusting it.
 *
 * `.claude/CLAUDE.md` already carried a warning about this exact claim. Being
 * warned did not help, because nothing connected the claim to the fact. This
 * does.
 */

import { STACK, majorOf, versioned } from '@/config/stack-versions';
import pkg from '../../../package.json';

const deps: Record<string, string> = {
  ...(pkg.dependencies as Record<string, string>),
  ...(pkg.devDependencies as Record<string, string>),
};

describe('the claim matches the lockable fact', () => {
  it.each([
    ['next', STACK.next],
    ['typescript', STACK.typescript],
    ['tailwindcss', STACK.tailwind],
    ['react', STACK.react],
  ])('%s says the major that is actually installed', (name, claim) => {
    const major = deps[name].match(/(\d+)\./)?.[1];
    expect(major).toBeTruthy();
    expect(claim).toContain(major as string);
  });

  it('never invents a number for something that is not installed', () => {
    // The failure this prevents is worse than being stale: a confident "0".
    expect(majorOf('a-package-nobody-installed')).toBeNull();
    expect(versioned('Nothing', 'a-package-nobody-installed')).toBe('Nothing');
  });

  it('claims a major line, not a patch', () => {
    // "16.3.5" churns on every bump and tells a reader nothing they need.
    for (const claim of Object.values(STACK)) {
      expect(claim).not.toMatch(/\d+\.\d+/);
    }
  });

  it('pins the versions that were wrong in public', () => {
    // Regression guard on the three actual lies, by name.
    expect(STACK.next).not.toBe('Next.js 15');
    expect(STACK.typescript).not.toBe('TypeScript 5');
    expect(STACK.tailwind).not.toBe('Tailwind CSS 3');
  });
});
