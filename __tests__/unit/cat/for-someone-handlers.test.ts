/**
 * Cat's verb for ADR-0005: `create_project_for_person` makes the placeholder
 * AND the project she owns in one go, and `send_to_fleetcrown` mints the same
 * handoff the entity page's card mints. These pin the two invariants that
 * matter: the project is owned by the placeholder (never by the caller), and a
 * failed project takes the placeholder down with it.
 */

import { vi } from 'vitest';
import { forSomeoneHandlers } from '@/services/cat/handlers/for-someone';
import { generateActionDescription } from '@/services/cat/action-descriptions';
import { CAT_ACTIONS } from '@/config/cat-actions';

const createProfileClaim = vi.fn();
const declineProfileClaim = vi.fn();
vi.mock('@/domain/profileClaims/service', () => ({
  createProfileClaim: (...args: unknown[]) => createProfileClaim(...args),
  declineProfileClaim: (...args: unknown[]) => declineProfileClaim(...args),
}));

const createFleetCrownHandoff = vi.fn();
vi.mock('@/services/fleetcrown/handoff', () => ({
  createFleetCrownHandoff: (...args: unknown[]) => createFleetCrownHandoff(...args),
}));

function mockSupabase(opts: { insertResult?: unknown; rows?: unknown[] } = {}) {
  const inserted: unknown[] = [];
  const chain: Record<string, unknown> = {};
  chain.insert = vi.fn((payload: unknown) => {
    inserted.push(payload);
    return chain;
  });
  chain.select = vi.fn().mockReturnThis();
  chain.eq = vi.fn().mockReturnThis();
  chain.or = vi.fn().mockReturnThis();
  chain.ilike = vi.fn().mockReturnThis();
  chain.order = vi.fn().mockReturnThis();
  chain.limit = vi.fn().mockResolvedValue({ data: opts.rows ?? [], error: null });
  chain.single = vi
    .fn()
    .mockResolvedValue(opts.insertResult ?? { data: { id: 'project-1' }, error: null });
  const supabase = { from: vi.fn(() => chain) };
  return { supabase: supabase as never, inserted };
}

beforeEach(() => {
  createProfileClaim.mockReset();
  declineProfileClaim.mockReset();
  createFleetCrownHandoff.mockReset();
});

describe('create_project_for_person', () => {
  it('creates the placeholder, then a project OWNED BY IT, created by the steward', async () => {
    createProfileClaim.mockResolvedValue({
      ok: true,
      data: { id: 'claim-1', token: 'tok-1', actorId: 'placeholder-actor', slug: 'annushka' },
    });
    const { supabase, inserted } = mockSupabase();

    const result = await forSomeoneHandlers.create_project_for_person(
      supabase,
      'steward-user',
      'steward-actor',
      {
        person_name: 'Annushka',
        title: "Annushka's network",
        description: 'People say who they are',
      }
    );

    expect(result.success).toBe(true);
    expect(createProfileClaim).toHaveBeenCalledWith({
      createdBy: 'steward-user',
      draft: { kind: 'person', profile: { name: 'Annushka', bio: undefined, website: undefined } },
    });
    const row = inserted[0] as Record<string, unknown>;
    expect(row.actor_id).toBe('placeholder-actor');
    expect(row.user_id).toBe('steward-user');
    expect(row.status).toBe('active');
    const data = result.data as Record<string, unknown>;
    expect(data.claimUrl).toContain('/claim/tok-1');
    expect(data.shareUrl).toContain('/dashboard/profile-claims/claim-1/share');
    expect(data.pageUrl).toContain('/projects/project-1');
    expect(declineProfileClaim).not.toHaveBeenCalled();
  });

  it('is always public — a draft nobody can see is not a page set up for someone', async () => {
    createProfileClaim.mockResolvedValue({
      ok: true,
      data: { id: 'c', token: 't', actorId: 'a', slug: 's' },
    });
    const { supabase, inserted } = mockSupabase();
    await forSomeoneHandlers.create_project_for_person(supabase, 'u', 'ua', {
      person_name: 'Maria',
      title: 'Studio',
      publish: false, // the free model sends this unprompted; it must not matter
    });
    expect((inserted[0] as Record<string, unknown>).status).toBe('active');
  });

  it('takes the placeholder down again when the project cannot be created', async () => {
    createProfileClaim.mockResolvedValue({
      ok: true,
      data: { id: 'c', token: 'tok-1', actorId: 'a', slug: 's' },
    });
    declineProfileClaim.mockResolvedValue({ ok: true, data: null });
    const { supabase } = mockSupabase({
      insertResult: { data: null, error: { message: 'insert failed' } },
    });
    const result = await forSomeoneHandlers.create_project_for_person(supabase, 'u', 'ua', {
      person_name: 'Maria',
      title: 'Studio',
    });
    expect(result.success).toBe(false);
    expect(declineProfileClaim).toHaveBeenCalledWith('tok-1');
  });

  it('refuses without a person or a title, before touching anything', async () => {
    const { supabase } = mockSupabase();
    const noPerson = await forSomeoneHandlers.create_project_for_person(supabase, 'u', 'ua', {
      title: 'Studio',
    });
    const noTitle = await forSomeoneHandlers.create_project_for_person(supabase, 'u', 'ua', {
      person_name: 'Maria',
    });
    expect(noPerson.success).toBe(false);
    expect(noTitle.success).toBe(false);
    expect(createProfileClaim).not.toHaveBeenCalled();
  });

  it('the confirm card says whose it is and that no money moves until they accept', () => {
    const text = generateActionDescription(CAT_ACTIONS.create_project_for_person, {
      person_name: 'Annushka',
      title: "Annushka's network",
    });
    expect(text).toContain('Annushka');
    expect(text).toContain('owned by Annushka');
    expect(text.toLowerCase()).toContain('nothing can receive money');
  });
});

describe('send_to_fleetcrown', () => {
  it('resolves a title among the caller’s own rows and returns the handoff link', async () => {
    const { supabase } = mockSupabase({ rows: [{ id: 'p-1', title: 'Network' }] });
    createFleetCrownHandoff.mockResolvedValue({
      ok: true,
      url: 'https://fleetcrown.orangecat.ch/integrations/orangecat/build?intent=x',
      expiresInSeconds: 600,
      title: 'Network',
      role: 'steward',
    });
    const result = await forSomeoneHandlers.send_to_fleetcrown(supabase, 'u', 'ua', {
      title: 'Network',
    });
    expect(result.success).toBe(true);
    expect(createFleetCrownHandoff).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: 'project',
        entityId: 'p-1',
        sourcePath: '/projects/p-1',
      })
    );
    expect((result.data as Record<string, unknown>).url).toContain('intent=x');
  });

  it('refuses an ambiguous title rather than guessing', async () => {
    const { supabase } = mockSupabase({ rows: [{ id: 'a' }, { id: 'b' }] });
    const result = await forSomeoneHandlers.send_to_fleetcrown(supabase, 'u', 'ua', {
      title: 'Net',
    });
    expect(result.success).toBe(false);
    expect(createFleetCrownHandoff).not.toHaveBeenCalled();
  });

  it('passes the service’s refusal through untouched', async () => {
    const { supabase } = mockSupabase();
    createFleetCrownHandoff.mockResolvedValue({ ok: false, code: 'forbidden', message: 'nope' });
    const result = await forSomeoneHandlers.send_to_fleetcrown(supabase, 'u', 'ua', {
      entity_id: '11111111-1111-1111-1111-111111111111',
    });
    expect(result).toEqual({ success: false, error: 'nope' });
  });
});
