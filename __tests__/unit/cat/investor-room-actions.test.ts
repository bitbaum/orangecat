import { investorRoomHandlers as handlers } from '@/services/cat/handlers/investor-room';
import { INVESTOR_ROOM_ACTIONS } from '@/config/cat-actions-room';
import { ROUTES } from '@/config/routes';
import {
  getOwnerRoom,
  saveRoomContent,
  createRoomLink,
  revokeRoomLink,
} from '@/domain/projectRooms/service';
import { loadRoomDeck, saveRoomDeck } from '@/domain/projectRooms/deck';
import { getRoomEvidence } from '@/domain/projectRooms/evidence';
import type { OwnerRoom } from '@/domain/projectRooms/types';
import type { AnySupabaseClient } from '@/lib/supabase/types';

vi.mock('@/domain/projectRooms/service', () => ({
  getOwnerRoom: vi.fn(),
  saveRoomContent: vi.fn(),
  createRoomLink: vi.fn(),
  revokeRoomLink: vi.fn(),
}));
vi.mock('@/domain/projectRooms/deck', async original => ({
  ...(await original<object>()),
  loadRoomDeck: vi.fn(),
  saveRoomDeck: vi.fn(),
}));
vi.mock('@/domain/projectRooms/evidence', () => ({ getRoomEvidence: vi.fn() }));
vi.mock('@/domain/projectRooms/evidence/loki', () => ({
  getFleetProject: vi.fn(async () => null),
}));
vi.mock('@/services/loki/project-link', () => ({
  getLokiProjectLink: vi.fn(async () => ({ linked: false })),
}));

const client = {} as AnySupabaseClient;
const room: OwnerRoom = {
  project: {
    id: 'project-one',
    title: 'Studio',
    description: 'A real studio.',
    website_url: null,
    cover_image_url: null,
    actor_id: 'actor-one',
    user_id: 'owner-one',
  },
  exists: true,
  content: {
    headline: 'Before',
    sections: [{ title: 'Risks', body: 'A documented risk.' }],
    metrics: [{ label: 'Revenue', value: 'None yet', verify: 'The owner’s records.' }],
    documents: [{ title: 'Brief', url: 'https://example.com/brief' }],
  },
  links: [],
  opens: [],
};
const run = (action: keyof typeof handlers, params: Record<string, unknown> = {}) =>
  handlers[action](client, 'owner-one', 'actor-one', { project_id: 'project-one', ...params });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(getOwnerRoom).mockResolvedValue({ ok: true, data: structuredClone(room) });
  vi.mocked(loadRoomDeck).mockResolvedValue(null);
  vi.mocked(getRoomEvidence).mockResolvedValue({ fleet: null, pace: null, facts: [] });
  vi.mocked(saveRoomContent).mockImplementation(async (_id, _user, _client, content) => ({
    ok: true,
    data: content,
  }));
  vi.mocked(saveRoomDeck).mockImplementation(async (_id, _user, _client, deck) => ({
    ok: true,
    data: deck as never,
  }));
});

it('reads through ownership checks and gives the model the room content and destinations', async () => {
  const result = await run('get_investor_room');
  expect(getOwnerRoom).toHaveBeenCalledWith('project-one', 'owner-one', client);
  expect(result.success).toBe(true);
  const data = result.data as { modelContext: string; editor_url: string };
  expect(JSON.parse(data.modelContext).content).toEqual(room.content);
  expect(data.editor_url).toBe(ROUTES.PROJECTS.ROOM('project-one'));
});

it('does not read private decks or build data after ownership is refused', async () => {
  vi.mocked(getOwnerRoom).mockResolvedValue({
    ok: false,
    code: 'forbidden',
    message: 'Not your project',
  });
  expect((await run('get_investor_room')).success).toBe(false);
  expect(loadRoomDeck).not.toHaveBeenCalled();
  expect((await run('generate_investor_deck')).success).toBe(false);
  expect(saveRoomDeck).not.toHaveBeenCalled();
});

it('patches a headline while preserving sections, metrics and documents', async () => {
  const result = await run('save_investor_room', { content: { headline: 'Updated story' } });
  expect(result.success).toBe(true);
  expect(saveRoomContent).toHaveBeenCalledWith('project-one', 'owner-one', client, {
    ...room.content,
    headline: 'Updated story',
  });
});

it.each([
  {},
  { invented_field: 'x' },
  { documents: [{ title: 'Unsafe', url: 'javascript:alert(1)' }] },
])('rejects invalid or empty room patches without saving: %j', async content => {
  expect((await run('save_investor_room', { content })).success).toBe(false);
  expect(saveRoomContent).not.toHaveBeenCalled();
});

it('never saves a room when the owner check fails', async () => {
  vi.mocked(getOwnerRoom).mockResolvedValue({
    ok: false,
    code: 'forbidden',
    message: 'Not your project',
  });
  expect((await run('save_investor_room', { content: { headline: 'Changed' } })).success).toBe(
    false
  );
  expect(saveRoomContent).not.toHaveBeenCalled();
});

it('creates a recipient-specific link and exposes the actual URL to the confirmation UI', async () => {
  vi.mocked(createRoomLink).mockResolvedValue({
    ok: true,
    data: { id: 'link-one', token: 'recipient-token', label: 'Anna' } as never,
  });
  const result = await run('create_investor_room_link', { label: 'Anna', is_shared: true });
  expect(createRoomLink).toHaveBeenCalledWith('project-one', 'owner-one', client, {
    label: 'Anna',
    is_shared: false,
  });
  const data = result.data as { url: string; displayMessage: string };
  expect(new URL(data.url).pathname).toBe(ROUTES.ROOM('recipient-token'));
  expect(data.displayMessage).toContain('No invitation has been sent');
});

it('rejects a missing recipient instead of inventing one', async () => {
  expect((await run('create_investor_room_link', { label: '' })).success).toBe(false);
  expect(createRoomLink).not.toHaveBeenCalled();
});

it('revokes only the specified link through the project-scoped domain service', async () => {
  vi.mocked(revokeRoomLink).mockResolvedValue({ ok: true, data: { id: 'link-one' } });
  expect((await run('revoke_investor_room_link', { link_id: 'link-one' })).success).toBe(true);
  expect(revokeRoomLink).toHaveBeenCalledWith('project-one', 'link-one', 'owner-one', client);
});

it('generates a real deck through the same package and room evidence as the UI', async () => {
  const result = await run('generate_investor_deck');
  expect(result.success).toBe(true);
  const deck = vi.mocked(saveRoomDeck).mock.calls[0][3] as { slides: Array<{ title?: string }> };
  expect(deck.slides.length).toBeGreaterThan(0);
  expect(JSON.stringify(deck)).toContain('Studio');
  expect((result.data as { url: string }).url).toBe(ROUTES.PROJECTS.ROOM_DECK('project-one'));
});

it('preserves an existing deck unless replacement is explicitly requested', async () => {
  vi.mocked(loadRoomDeck).mockResolvedValue({ slides: [{ title: 'Existing work' }] } as never);
  expect((await run('generate_investor_deck')).success).toBe(false);
  expect(saveRoomDeck).not.toHaveBeenCalled();
  expect(getRoomEvidence).not.toHaveBeenCalled();
});

it('leaves read access separate from the confirmation required for room writes', () => {
  expect(INVESTOR_ROOM_ACTIONS.get_investor_room).toMatchObject({
    category: 'context',
    riskLevel: 'low',
    requiresConfirmation: false,
  });
  for (const action of Object.values(INVESTOR_ROOM_ACTIONS).filter(
    action => action.id !== 'get_investor_room'
  )) {
    expect(action.requiresConfirmation).toBe(true);
  }
});
