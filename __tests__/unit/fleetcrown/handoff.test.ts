/**
 * The OrangeCat → FleetCrown handoff as a service. The steward of a page set
 * up for someone else may hand it over while the claim is pending; nobody
 * else but the owner may; and the payload names who the client is.
 */

import { vi } from 'vitest';
import { createFleetCrownHandoff } from '@/services/fleetcrown/handoff';

const resolveManagementRole = vi.fn();
vi.mock('@/domain/profileClaims/stewardship', () => ({
  resolveManagementRole: (...a: unknown[]) => resolveManagementRole(...a),
}));
const getUnclaimedOwner = vi.fn();
vi.mock('@/domain/profileClaims/unclaimed', () => ({
  getUnclaimedOwner: (...a: unknown[]) => getUnclaimedOwner(...a),
}));
vi.mock('@/services/actors/getOrCreateUserActor', () => ({
  getOrCreateUserActor: vi.fn().mockResolvedValue({ id: 'caller-actor' }),
}));
vi.mock('@/lib/supabase/admin', () => ({
  getAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({
            data: {
              id: 'p-1',
              title: "Annushka's network",
              description: 'People say who they are',
              actor_id: 'placeholder',
            },
          }),
        }),
      }),
    }),
  }),
}));

const ENTITY_ID = '11111111-1111-1111-1111-111111111111';

function decodePayload(url: string): Record<string, unknown> {
  const token = new URL(url).searchParams.get('intent') ?? '';
  return JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString('utf8'));
}

beforeEach(() => {
  process.env.FLEETCROWN_BUILD_INTENT_SECRET = 'x'.repeat(48);
  resolveManagementRole.mockReset();
  getUnclaimedOwner.mockReset();
});

describe('createFleetCrownHandoff', () => {
  it('refuses anyone who is neither owner nor steward', async () => {
    resolveManagementRole.mockResolvedValue(null);
    const result = await createFleetCrownHandoff({
      supabase: {} as never,
      userId: 'stranger',
      entityType: 'project',
      entityId: ENTITY_ID,
      sourcePath: `/projects/${ENTITY_ID}`,
    });
    expect(result).toMatchObject({ ok: false, code: 'forbidden' });
  });

  it('lets the steward hand over an unclaimed page, and names the client in the payload', async () => {
    resolveManagementRole.mockResolvedValue('steward');
    getUnclaimedOwner.mockResolvedValue({
      actorId: 'placeholder',
      name: 'Annushka',
      avatarUrl: null,
      slug: 'annushka',
      stewardUsername: 'catomean',
    });
    const result = await createFleetCrownHandoff({
      supabase: {} as never,
      userId: 'steward',
      entityType: 'project',
      entityId: ENTITY_ID,
      sourcePath: `/projects/${ENTITY_ID}`,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.role).toBe('steward');
    const payload = decodePayload(result.url);
    expect(payload.owner).toMatchObject({
      kind: 'unclaimed',
      displayName: 'Annushka',
      stewardUsername: 'catomean',
    });
    expect((payload.suggestedHandoff as string[])[0]).toContain('Client: Annushka');
    expect((payload.entity as Record<string, unknown>).publicUrl).toContain(
      `/projects/${ENTITY_ID}`
    );
  });

  it('rejects unsafe inputs before touching anything', async () => {
    const bad = await createFleetCrownHandoff({
      supabase: {} as never,
      userId: 'u',
      entityType: 'project',
      entityId: ENTITY_ID,
      sourcePath: '//evil.example/x',
    });
    expect(bad).toMatchObject({ ok: false, code: 'invalid' });
    expect(resolveManagementRole).not.toHaveBeenCalled();
  });

  it('reports an unconfigured deploy as such, not as a fault', async () => {
    delete process.env.FLEETCROWN_BUILD_INTENT_SECRET;
    resolveManagementRole.mockResolvedValue('owner');
    getUnclaimedOwner.mockResolvedValue(null);
    const result = await createFleetCrownHandoff({
      supabase: {} as never,
      userId: 'u',
      entityType: 'project',
      entityId: ENTITY_ID,
      sourcePath: `/projects/${ENTITY_ID}`,
    });
    expect(result).toMatchObject({ ok: false, code: 'unconfigured' });
  });
});
