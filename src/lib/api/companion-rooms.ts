/**
 * The room routes' shared pieces: the request shapes and the one mapping
 * from a room error to an HTTP answer, so four routes do not each carry a
 * copy of the switch.
 */

import { z } from 'zod';
import type { NextResponse } from 'next/server';
import { isFleetBotSlug } from '@/config/fleet-bots';
import { AI_MESSAGE_MAX_CHARS } from '@/lib/validation/ai';
import {
  MAX_BOT_TURNS,
  MAX_ROOM_MEMBERS,
  MIN_ROOM_MEMBERS,
} from '@/services/companions/rooms/plan';
import type { RoomTurnError } from '@/services/companions/rooms/types';
import {
  apiError,
  apiInternalError,
  apiNotFound,
  apiRateLimited,
  apiServiceUnavailable,
} from './standardResponse';

export const ROOM_TITLE_MAX = 100;

export const roomMemberSchema = z.union([
  z.object({ assistantId: z.string().guid() }),
  z.object({ fleetSlug: z.string().refine(isFleetBotSlug, 'Unknown fleet bot') }),
]);

export const newRoomSchema = z.object({
  title: z.string().trim().max(ROOM_TITLE_MAX).optional().nullable(),
  members: z
    .array(roomMemberSchema)
    .min(MIN_ROOM_MEMBERS, `A group chat needs at least ${MIN_ROOM_MEMBERS} companions`)
    .max(MAX_ROOM_MEMBERS, `A group chat holds at most ${MAX_ROOM_MEMBERS} companions`),
});

export const renameRoomSchema = z.object({
  title: z.string().trim().min(1).max(ROOM_TITLE_MAX),
});

export const roundStateSchema = z.object({
  queue: z.array(z.string()).max(MAX_BOT_TURNS),
  turnsLeft: z.number().int().min(0).max(MAX_BOT_TURNS),
});

export const roomMessageSchema = z.object({
  content: z.string().trim().min(1).max(AI_MESSAGE_MAX_CHARS),
});

export const roomTurnSchema = z.object({ round: roundStateSchema });

export const fleetAskSchema = z.object({
  messages: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string().min(1).max(AI_MESSAGE_MAX_CHARS),
      })
    )
    .min(1)
    .max(20),
});

/** A room error as the HTTP answer the one-to-one messages route gives for the same case. */
export function roomErrorResponse(error: RoomTurnError): NextResponse {
  switch (error.code) {
    case 'NOT_FOUND':
      return apiNotFound(error.message);
    case 'RATE_LIMITED':
      return apiRateLimited(error.message);
    case 'SERVICE_UNAVAILABLE':
      return apiServiceUnavailable('AI service not configured');
    case 'INSUFFICIENT_CREDITS':
      return apiError('Insufficient credits', 'INSUFFICIENT_CREDITS', 402, {
        currentBalance: error.currentBalance,
        requiredAmount: error.requiredAmount,
        shortfall: error.shortfall,
      });
    case 'AI_ERROR':
      return apiError('Failed to generate AI response', 'AI_ERROR', 502, {
        message: error.message,
      });
    case 'DB_ERROR':
      return apiInternalError(error.message);
  }
}
