// @vitest-environment jsdom
/**
 * Tap targets measured on production at 390px with a touch pointer
 * (2026-11-12): the header logo link was 36x36, "Forgot password?" 20px tall,
 * "Create an account" 24px, and Discover's "Also here" links 17px. Each is
 * the only way to what it opens, so each gets the 44px (min-h-11) a finger
 * needs. The logo's `min-h-11` was already there and did nothing: the link
 * was inline, and min-height does not apply to an inline box.
 */
import { readFileSync } from 'fs';
import { join } from 'path';
import { render, screen } from '@testing-library/react';
import { AuthSocialLogin } from '@/app/auth/AuthSocialLogin';
import { BrandMark } from '@/components/shell/BrandMark';

describe('phone tap targets', () => {
  it('the header logo link is a 44px box, not an inline one', () => {
    render(<BrandMark href="/" />);
    const link = screen.getByRole('link', { name: /home/ });
    expect(link.className).toMatch(/\binline-flex\b/);
    expect(link.className).toMatch(/\bmin-h-11\b/);
    expect(link.className).toMatch(/\bmin-w-11\b/);
  });

  it('the switch between signing in and signing up is 44px tall', () => {
    render(
      <AuthSocialLogin mode="login" setMode={() => {}} loading={false} onOAuthSignIn={() => {}} />
    );
    expect(screen.getByRole('button', { name: 'Create an account' }).className).toMatch(
      /\bmin-h-11\b/
    );
  });

  it("Discover's inline links are 44px tall", () => {
    const css = readFileSync(join(process.cwd(), 'src/app/globals.css'), 'utf8');
    const rule = css.slice(css.indexOf('.oc-discover-inline-link {'));
    expect(rule.slice(0, rule.indexOf('}'))).toMatch(/inline-flex min-h-11 items-center/);
  });
});
