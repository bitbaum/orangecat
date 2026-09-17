/**
 * Two things that fail SILENTLY if they regress.
 *
 * 1. An unclaimed actor has no profile by construction (the CHECK requires
 *    `user_id IS NULL`). Every owner resolver in this codebase goes
 *    `actors.user_id → profiles`, so a placeholder renders as "Anonymous" with
 *    a dead link unless it is special-cased. Nothing throws; the page just
 *    stops saying whose it is, which is the one thing ADR-0005 exists to make
 *    it say.
 *
 * 2. The steward clause in `resolveCreationActor`. It is what lets the person
 *    who set the studio up keep editing it while the claim is pending — and,
 *    more importantly, what stops ANYONE ELSE creating rows owned by someone
 *    else's placeholder. If the clause were dropped, creating for someone else
 *    would 403; if it were widened to any pending claim, a stranger could hang
 *    entities off a placeholder that is not theirs.
 *
 * Source-level, comment-blind: the files' own prose names these identifiers.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const codeOnly = (s: string): string =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^[ \t]*\/\/.*$/gm, '');
const read = (rel: string): string => codeOnly(readFileSync(join(process.cwd(), rel), 'utf8'));

const fetchOwner = read('src/lib/entities/fetchEntityOwner.ts');
const resolver = read('src/services/actors/resolveCreationActor.ts');
const projectPage = read('src/app/projects/[id]/page.tsx');
const profilePage = read('src/app/profiles/[username]/page.tsx');

describe('an unclaimed owner is named, not anonymised', () => {
  it('selects the columns a placeholder actually has', () => {
    // display_name / avatar_url / slug live on the actor; without them in the
    // select there is nothing to fall back to.
    expect(fetchOwner).toMatch(
      /\.select\('id, actor_type, user_id, group_id, display_name, avatar_url, slug'\)/
    );
  });

  it('returns the actor row rather than looking for a profile that cannot exist', () => {
    expect(fetchOwner).toMatch(/if \(actor\.actor_type === 'unclaimed'\)/);
    expect(fetchOwner).toMatch(/isUnclaimed: true/);
    expect(fetchOwner).toMatch(/name: actor\.display_name/);
  });
});

describe('the pages say whose it is', () => {
  it('the project page loads the placeholder by actor_id and renders the band', () => {
    // actor_id, NOT user_id: user_id is the creating account, and for a
    // project set up for someone else those differ — reading user_id would
    // show the steward as the owner, which is the exact confusion the band
    // exists to remove.
    expect(projectPage).toMatch(/getUnclaimedOwner\(supabase, project\.actor_id\)/);
    expect(projectPage).toMatch(/<UnclaimedBand/);
  });

  it('the profile page resolves an unclaimed slug before 404ing', () => {
    // BOTH call sites matter and they fail differently: losing it in
    // `generateMetadata` titles her page "Profile Not Found"; losing it in the
    // page body 404s the page outright. Asserting the identifier once cannot
    // tell those apart, so assert the body's site specifically.
    const body = profilePage.slice(profilePage.indexOf('export default async function'));
    expect(body).toMatch(/getUnclaimedOwnerBySlug\(supabase, targetUsername\)/);
    expect(body).toMatch(/<UnclaimedProfileView/);

    const metadata = profilePage.slice(0, profilePage.indexOf('export default async function'));
    expect(metadata).toMatch(/getUnclaimedOwnerBySlug\(supabase, targetUsername\)/);
  });

  it('does not index an unclaimed page until its subject accepts', () => {
    // Public on-platform and by link; invisible to search engines until she
    // says yes. That is the line between a growth mechanic and putting a real
    // person's name into Google without asking.
    expect(profilePage).toMatch(/robots: \{ index: false, follow: false \}/);
  });
});

describe('only the steward may create for a placeholder', () => {
  it('admits the claim creator while the claim is pending', () => {
    expect(resolver).toMatch(/actor\?\.actor_type === 'unclaimed'/);
    expect(resolver).toMatch(/claim\?\.created_by === userId && claim\?\.status === 'pending'/);
  });

  it('throws for everyone else, rather than falling through to the group branch', () => {
    const block = resolver.slice(
      resolver.indexOf("actor?.actor_type === 'unclaimed'"),
      resolver.indexOf('const groupId =')
    );
    expect(block).toMatch(/throw new ActorNotPermittedError\(requestedActorId\)/);
  });
});
