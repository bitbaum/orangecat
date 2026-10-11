/**
 * A <Button> inside a <Link> renders a <button> inside an <a>: invalid HTML,
 * two tab stops for one action, read out twice by a screen reader. Use
 * <Button href> — it renders the link itself and carries aria-label, title,
 * id, target and disabled. There were 94; there are none, and there stay none.
 */
import { execSync } from 'node:child_process';

function nested(): string[] {
  const out = execSync(
    `grep -rn -A1 "<Link " src --include=*.tsx | grep -B1 -E "^\\S*-\\s*<Button" | grep "<Link " || true`,
    { encoding: 'utf8' }
  );
  return out.trim() ? out.trim().split('\n') : [];
}

describe('no <Button> inside a <Link>', () => {
  it('uses <Button href> instead', () => {
    expect(nested()).toEqual([]);
  });
});
