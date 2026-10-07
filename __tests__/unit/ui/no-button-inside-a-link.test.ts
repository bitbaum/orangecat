/**
 * A <Button> inside a <Link> renders a <button> inside an <a>: invalid HTML,
 * two tab stops for one action, read out twice by a screen reader. <Button
 * href> renders the link itself (and carries aria-label, title and disabled
 * since 2026-10-07). 52 were converted mechanically; the rest put a class or
 * a target on the outer link, where moving it onto the button can change
 * layout, so each needs a look. This ratchet may only fall.
 */
import { execSync } from 'node:child_process';

const REMAINING = 42;

function countNested(): number {
  const out = execSync(
    `grep -rn -A1 "<Link " src --include=*.tsx | grep -B1 -E "^\\S*-\\s*<Button" | grep -c "<Link " || true`,
    { encoding: 'utf8' }
  );
  return Number(out.trim() || 0);
}

describe('no <Button> inside a <Link>', () => {
  it(`stays at or below ${REMAINING} (lower REMAINING when you fix one)`, () => {
    expect(countNested()).toBeLessThanOrEqual(REMAINING);
  });
});
