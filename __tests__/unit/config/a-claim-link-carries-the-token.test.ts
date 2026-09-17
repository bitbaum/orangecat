/**
 * The link carries the credential, not the identity.
 *
 * `profile_claims.id` used to double as the claim token, so `/claim/<id>` was
 * both the row's name and its password. That made the row impossible to
 * reference anywhere public — a greyed `@karl` chip, an unclaimed placeholder
 * page, a share card — because naming it would hand over the ability to take
 * it (ADR-0004 D4).
 *
 * Splitting them is a ONE-WAY DOOR: free while `profile_claims` has zero
 * production rows, and afterwards it costs rotating every link already sent to
 * a person. These tests keep the two halves from silently merging back:
 *
 *   token → public routes  (preview, claim, decline)
 *   id    → creator routes (list, revoke)
 *
 * Source-level because the wiring being protected is which VALUE reaches which
 * URL builder, and that is not observable from a unit-testable export.
 * Assertions match call syntax rather than bare identifiers, and run against
 * comment-stripped source — this file's own subject matter appears in the
 * comments of the files it scans.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

function codeOnly(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
}

const read = (rel: string): string => codeOnly(readFileSync(join(process.cwd(), rel), 'utf8'));

const claimsRoute = read('src/app/api/profile-claims/route.ts');
const apiRoutes = read('src/config/api-routes.ts');
const claimClient = read('src/components/claim/ClaimPageClient.tsx');
const service = read('src/domain/profileClaims/service.ts');
// Creator-side operations live in `creator.ts` — see the split's rationale there.
const creator = read('src/domain/profileClaims/creator.ts');

describe('a claim link carries the token', () => {
  it('builds every claim URL from the token', () => {
    expect(claimsRoute).toMatch(/ROUTES\.CLAIM\(result\.data\.token\)/);
    expect(claimsRoute).toMatch(/ROUTES\.CLAIM\(claim\.token\)/);
  });

  it('never builds a claim URL from the row id', () => {
    // The exact regression: `ROUTES.CLAIM(claim.id)`.
    expect(claimsRoute).not.toMatch(/ROUTES\.CLAIM\([^)]*\.id\)/);
  });

  it('routes the public endpoints under /token/', () => {
    expect(apiRoutes).toMatch(/PREVIEW:.*profile-claims\/token\//);
    expect(apiRoutes).toMatch(/CLAIM:.*profile-claims\/token\//);
    expect(apiRoutes).toMatch(/DECLINE:.*profile-claims\/token\//);
  });

  it('has the claim page call those endpoints with the token', () => {
    expect(claimClient).toMatch(/PROFILE_CLAIMS\.CLAIM\(claimToken\)/);
    expect(claimClient).toMatch(/PROFILE_CLAIMS\.DECLINE\(claimToken\)/);
    expect(claimClient).not.toMatch(/preview\.id/);
  });
});

describe('the service addresses each half by the right column', () => {
  it('looks public operations up by token', () => {
    expect(service).toMatch(/\.eq\('token', token\)/);
    expect(service).toMatch(/\.eq\('token', claimToken\)/);
  });

  it('compare-and-swaps the claim on the token, not the id', () => {
    // The CAS is what makes two tabs unable to both win. If it moved back to
    // `id` while the route passed a token, it would match zero rows and every
    // claim would report "already claimed".
    const cas = service.slice(service.indexOf("status: 'claimed'"));
    expect(cas).toMatch(/\.eq\('token', claimToken\)[\s\S]{0,120}\.eq\('status', 'pending'\)/);
  });

  it('keeps revoke — a creator action — addressed by id', () => {
    const revoke = creator.slice(creator.indexOf('export async function revokeProfileClaim'));
    expect(revoke.slice(0, 900)).toMatch(/\.eq\('id', id\)/);
  });

  it('never puts the credential in a log line', () => {
    // A token in a log is a token in whatever reads logs. The service logs
    // errors around these lookups; none of them may carry it.
    expect(service).not.toMatch(/logger\.[a-z]+\([^)]*\btoken\b[^)]*\)/);
  });
});
