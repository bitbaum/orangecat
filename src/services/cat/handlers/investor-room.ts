import { generateDeck } from '@bitbaum/deckkit';
import { roomContentSchema, newRoomLinkSchema } from '@/config/project-room';
import { ROUTES } from '@/config/routes';
import {
  getOwnerRoom,
  saveRoomContent,
  createRoomLink,
  revokeRoomLink,
} from '@/domain/projectRooms/service';
import {
  loadRoomDeck,
  saveRoomDeck,
  deckDataFromEvidence,
  deckSourceFromRoom,
} from '@/domain/projectRooms/deck';
import { getRoomEvidence } from '@/domain/projectRooms/evidence';
import { getLokiProjectLink } from '@/services/loki/project-link';
import { getFleetProject } from '@/domain/projectRooms/evidence/loki';
import { SITE_URL } from '@/config/brand';
import type { ActionHandler } from './types';

const destinations = (id: string) => ({
  url: ROUTES.PROJECTS.ROOM(id),
  editor_url: ROUTES.PROJECTS.ROOM(id),
  deck_editor_url: ROUTES.PROJECTS.ROOM_DECK(id),
  project_url: ROUTES.PROJECTS.VIEW(id),
});

/** The same ownership-checked room services the hand-operated UI calls. */
export const investorRoomHandlers: Record<string, ActionHandler> = {
  get_investor_room: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    const room = await getOwnerRoom(id, userId, supabase);
    if (!room.ok) {
      return { success: false, error: room.message };
    }
    const [deck, build, record] = await Promise.all([
      loadRoomDeck(id),
      getLokiProjectLink(id),
      getFleetProject(id),
    ]);
    const context = {
      project: room.data.project,
      exists: room.data.exists,
      content: room.data.content,
      deck,
      build,
      product_record: record
        ? { identity: record.identity, roadmap: record.roadmap, sources: record.sources }
        : null,
      links: room.data.links.slice(0, 50),
      links_total: room.data.links.length,
      recent_opens: room.data.opens.slice(0, 20),
      ...destinations(id),
    };
    return {
      success: true,
      data: {
        ...room.data,
        deck,
        build,
        ...destinations(id),
        modelContext: JSON.stringify(context),
        displayMessage: `Read the investor room for ${room.data.project.title}.`,
      },
    };
  },
  save_investor_room: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    const patch = roomContentSchema.partial().strict().safeParse(params.content);
    if (!patch.success || !Object.keys(patch.data).length) {
      return { success: false, error: 'Supply valid room fields to change. No content was saved.' };
    }
    const room = await getOwnerRoom(id, userId, supabase);
    if (!room.ok) {
      return { success: false, error: room.message };
    }
    const content = roomContentSchema.safeParse({ ...room.data.content, ...patch.data });
    if (!content.success) {
      return { success: false, error: 'The room content is invalid. No content was saved.' };
    }
    const saved = await saveRoomContent(id, userId, supabase, content.data);
    return saved.ok
      ? {
          success: true,
          data: {
            content: saved.data,
            ...destinations(id),
            displayMessage: `Saved the investor room for ${room.data.project.title}.`,
          },
        }
      : { success: false, error: saved.message };
  },
  create_investor_room_link: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    const input = newRoomLinkSchema.safeParse({
      label: params.label,
      email: params.email,
      is_shared: false,
    });
    if (!input.success) {
      return {
        success: false,
        error: 'Supply a recipient label and, if provided, a valid email address.',
      };
    }
    const result = await createRoomLink(id, userId, supabase, input.data);
    return result.ok
      ? {
          success: true,
          data: {
            link: result.data,
            room_url: new URL(ROUTES.ROOM(result.data.token), SITE_URL).toString(),
            ...destinations(id),
            url: new URL(ROUTES.ROOM(result.data.token), SITE_URL).toString(),
            displayMessage: `Created a private room link for ${result.data.label}. No invitation has been sent.`,
          },
        }
      : { success: false, error: result.message };
  },
  revoke_investor_room_link: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    const result = await revokeRoomLink(id, String(params.link_id), userId, supabase);
    return result.ok
      ? {
          success: true,
          data: {
            ...result.data,
            ...destinations(id),
            displayMessage: 'The investor-room link is switched off. Its history is retained.',
          },
        }
      : { success: false, error: result.message };
  },
  generate_investor_deck: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    const room = await getOwnerRoom(id, userId, supabase);
    if (!room.ok) {
      return { success: false, error: room.message };
    }
    const existing = await loadRoomDeck(id);
    if (existing && params.replace_existing !== true) {
      return {
        success: false,
        error:
          'This room already has a deck. Ask whether to edit it or replace it before generating another.',
      };
    }
    const evidence = await getRoomEvidence(id);
    const deck = generateDeck(
      deckSourceFromRoom(room.data.project, room.data.content, evidence),
      deckDataFromEvidence(evidence)
    );
    const result = await saveRoomDeck(id, userId, supabase, deck);
    return result.ok
      ? {
          success: true,
          data: {
            deck: result.data,
            ...destinations(id),
            url: ROUTES.PROJECTS.ROOM_DECK(id),
            displayMessage: `Saved a first investor deck for ${room.data.project.title}, generated from its room and product records.`,
          },
        }
      : { success: false, error: result.message };
  },
  save_investor_deck: async (supabase, userId, _actorId, params) => {
    const id = String(params.project_id);
    if (
      !params.deck ||
      typeof params.deck !== 'object' ||
      JSON.stringify(params.deck).length > 200_000
    ) {
      return { success: false, error: 'The deck is too large.' };
    }
    const result = await saveRoomDeck(id, userId, supabase, params.deck);
    return result.ok
      ? {
          success: true,
          data: {
            deck: result.data,
            ...destinations(id),
            url: ROUTES.PROJECTS.ROOM_DECK(id),
            displayMessage: 'Saved the investor deck.',
          },
        }
      : { success: false, error: result.message };
  },
};
