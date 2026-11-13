import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { AVATAR_HUES, AVATAR_SHAPES, avatarPath, parseFaceUrl } from '@/config/companion-avatars';
import { updateRoomSchema } from '@/lib/api/companion-rooms';

/**
 * A group chat's own face: one of our shapes and colours by id, or null for
 * its members' faces again. The client never sends a URL.
 */
describe('a group chat’s own face', () => {
  const face = { shape: AVATAR_SHAPES[0].id, hue: AVATAR_HUES[0].id };

  it('takes a known shape and colour, null, a name, or a name and a face', () => {
    expect(updateRoomSchema.safeParse({ face }).success).toBe(true);
    expect(updateRoomSchema.safeParse({ face: null }).success).toBe(true);
    expect(updateRoomSchema.safeParse({ title: 'Site crew' }).success).toBe(true);
    expect(updateRoomSchema.safeParse({ title: 'Site crew', face }).success).toBe(true);
  });

  it('refuses an unknown shape or colour, a URL, and a change of nothing', () => {
    expect(updateRoomSchema.safeParse({ face: { ...face, shape: 'nope' } }).success).toBe(false);
    expect(updateRoomSchema.safeParse({ face: { ...face, hue: 'nope' } }).success).toBe(false);
    expect(updateRoomSchema.safeParse({ face: 'https://example.com/a.png' }).success).toBe(false);
    expect(updateRoomSchema.safeParse({}).success).toBe(false);
    expect(updateRoomSchema.safeParse({ title: ' ' }).success).toBe(false);
  });

  it('is stored as a face the list can draw without a request', () => {
    expect(parseFaceUrl(avatarPath(face.shape, face.hue))).toEqual(face);
  });

  it('adds the column without touching a room that has none', () => {
    const sql = readFileSync(
      'supabase/migrations/20261113170000_a_group_chat_can_have_its_own_face.sql',
      'utf8'
    );
    expect(sql).toMatch(/ADD COLUMN IF NOT EXISTS avatar_url TEXT/);
    expect(sql).not.toMatch(/NOT NULL|DROP /);
  });
});
