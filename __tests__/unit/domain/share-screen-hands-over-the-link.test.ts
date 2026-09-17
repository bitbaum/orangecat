/**
 * The share screen is where the link reaches a person.
 *
 * Everything before it produces a claim; this is the step that decides whether
 * the link is *sent*. Two things must hold, and both fail quietly:
 *
 * 1. Creating for someone else must LAND here. If the redirect regresses to
 *    the entity or the claims list, nothing errors — the creator simply never
 *    sees a send affordance, and the link sits unsent. That is the exact
 *    failure ADR-0005 D8 exists to prevent, and it looks like success.
 *
 * 2. The screen is creator-only. It shows the claim TOKEN — the credential
 *    that lets its holder take the page over — so a page that fetched by id
 *    without checking `created_by` would hand any logged-in user the keys to
 *    anyone's claim.
 *
 * Source-level and comment-blind: the files' own prose names these symbols.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (rel: string): string => codeOnly(readFileSync(join(process.cwd(), rel), 'utf8'));

const submit = read('src/components/create/EntityForm/hooks/entityFormSubmitAction.ts');
const sharePage = read('src/app/(authenticated)/dashboard/profile-claims/[id]/share/page.tsx');
// Creator-side operations moved to `creator.ts` when service.ts hit the size
// limit: `token` addresses what the public does, `id` what the creator does.
const creator = read('src/domain/profileClaims/creator.ts');
const shareUi = read('src/components/claim/ShareClaim.tsx');

describe('creating for someone else lands on the send screen', () => {
  it('redirects to the share route, not to the entity', () => {
    expect(submit).toMatch(/ROUTES\.DASHBOARD\.PROFILE_CLAIMS_SHARE\(claimIdForShare\)/);
  });

  it('does not fall through to the ordinary success redirect', () => {
    // The branch must come BEFORE the generic `config.successUrl` push —
    // otherwise the creator lands on a page that belongs to someone who has
    // not seen it yet.
    const shareAt = submit.indexOf('PROFILE_CLAIMS_SHARE');
    const successAt = submit.indexOf('router.push(redirectUrl)');
    expect(shareAt).toBeGreaterThan(-1);
    expect(successAt).toBeGreaterThan(shareAt);
  });
});

describe('the share screen is creator-only', () => {
  it('fetches through the creator-scoped helper', () => {
    expect(sharePage).toMatch(/getProfileClaimForCreator\(id, user\.id\)/);
  });

  it('that helper refuses a claim the caller did not create', () => {
    // Bounded to THIS function. Slicing to end-of-file made the assertion
    // vacuous: `revokeProfileClaim` further down carries an identical
    // ownership check, so deleting this one still matched.
    const start = creator.indexOf('export async function getProfileClaimForCreator');
    const end = creator.indexOf('export async function', start + 1);
    const fn = creator.slice(start, end === -1 ? undefined : end);

    expect(fn).toMatch(/row\.created_by !== requestedBy/);
    // Not-found, never forbidden: whether a given claim id exists is not a
    // stranger's business.
    expect(fn).toMatch(/code: 'not_found'/);
  });

  it('sends anonymous visitors to log in rather than rendering', () => {
    expect(sharePage).toMatch(/if \(!user\) \{\s*redirect\(ROUTES\.AUTH_LOGIN\)/);
  });

  it('is never indexed — it contains a credential', () => {
    expect(sharePage).toMatch(/robots: \{ index: false, follow: false \}/);
  });
});

describe('the message is already written', () => {
  it('carries the claim link, not the public page link', () => {
    // The public page cannot be taken over; sending it would look right and
    // strand the recipient with no way in.
    expect(shareUi).toMatch(/\$\{claimUrl\}/);
  });

  it('offers the channels people actually hand things over on', () => {
    expect(shareUi).toMatch(/wa\.me/);
    expect(shareUi).toMatch(/signal\.me/);
    expect(shareUi).toMatch(/mailto:/);
  });

  it('warns that the link is bearer-authority', () => {
    expect(shareUi).toMatch(/Anyone with this link can take it over/);
  });
});
