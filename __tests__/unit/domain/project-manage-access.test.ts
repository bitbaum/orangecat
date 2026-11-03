import { canManageProject } from '@/domain/projects/manage-access';
import { checkOwnership } from '@/services/actors';
import { getEntityStewardUserId } from '@/domain/profileClaims/stewardship';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/services/actors', () => ({ checkOwnership: vi.fn() }));
vi.mock('@/domain/profileClaims/stewardship', () => ({ getEntityStewardUserId: vi.fn() }));
const input = {
  projectId: 'project-one',
  actorId: 'group-actor',
  viewerId: 'member-one',
  ownerUserId: null,
  unclaimed: false,
  supabase: {} as AnySupabaseClient,
};
beforeEach(() => vi.clearAllMocks());

it('shows project controls to an authorised group member, using the room’s ownership policy', async () => {
  vi.mocked(checkOwnership).mockResolvedValue(true);
  expect(await canManageProject(input)).toBe(true);
  expect(checkOwnership).toHaveBeenCalledWith(
    { actor_id: 'group-actor' },
    'member-one',
    input.supabase
  );
});
it('does not show private project controls to another signed-in person', async () => {
  vi.mocked(checkOwnership).mockResolvedValue(false);
  expect(await canManageProject(input)).toBe(false);
});
it('keeps anonymous visitors out without an ownership query', async () => {
  expect(await canManageProject({ ...input, viewerId: null })).toBe(false);
  expect(checkOwnership).not.toHaveBeenCalled();
});
it('preserves the owner and unclaimed-page steward controls', async () => {
  expect(await canManageProject({ ...input, ownerUserId: 'member-one' })).toBe(true);
  vi.mocked(getEntityStewardUserId).mockResolvedValue('member-one');
  expect(await canManageProject({ ...input, unclaimed: true })).toBe(true);
  expect(getEntityStewardUserId).toHaveBeenCalledWith('project', 'project-one');
});
