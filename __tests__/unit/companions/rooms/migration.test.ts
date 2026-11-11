import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { DATABASE_TABLES } from '@/config/database-tables';

/**
 * Source-level pins on the migration that lets companions talk together. A
 * later edit cannot quietly open a room to anyone but its owner, let a member
 * be both a companion and a fleet bot, or let a line lose who said it.
 */
const sql = readFileSync('supabase/migrations/20261030090000_companions_talk_together.sql', 'utf8');

describe('companions talk together', () => {
  it('creates the three tables the constants name', () => {
    for (const table of [
      DATABASE_TABLES.COMPANION_ROOMS,
      DATABASE_TABLES.COMPANION_ROOM_MEMBERS,
      DATABASE_TABLES.COMPANION_ROOM_MESSAGES,
    ]) {
      expect(sql).toContain(`CREATE TABLE IF NOT EXISTS public.${table}`);
      expect(sql).toContain(`ALTER TABLE public.${table} ENABLE ROW LEVEL SECURITY`);
    }
  });

  it('keeps a room to its owner, and members and messages behind the room', () => {
    expect(sql).toMatch(/FOR ALL USING \(user_id = \(SELECT auth\.uid\(\)\)\)/);
    expect(
      sql.match(/WHERE r\.id = room_id AND r\.user_id = \(SELECT auth\.uid\(\)\)/g)
    ).toHaveLength(4);
    expect(sql).not.toMatch(/CREATE POLICY "Assistant owners/);
  });

  it('makes a member exactly one of: a companion, a fleet bot', () => {
    expect(sql).toMatch(/CHECK \(\(assistant_id IS NULL\) <> \(fleet_slug IS NULL\)\)/);
    expect(sql).toMatch(/UNIQUE \(room_id, assistant_id\)/);
    expect(sql).toMatch(/UNIQUE \(room_id, fleet_slug\)/);
  });

  it('keeps who spoke on every line, even after the member is gone', () => {
    expect(sql).toMatch(
      /member_id uuid REFERENCES public\.companion_room_members\(id\) ON DELETE SET NULL/
    );
    expect(sql).toMatch(/speaker text/);
    expect(sql).toMatch(/CHECK \(role IN \('user', 'assistant'\)\)/);
  });

  it('cascades a deleted room and a deleted companion', () => {
    expect(sql).toMatch(
      /room_id uuid NOT NULL REFERENCES public\.companion_rooms\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(
      /assistant_id uuid REFERENCES public\.ai_assistants\(id\) ON DELETE CASCADE/
    );
  });
});
