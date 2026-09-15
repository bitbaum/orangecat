import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';

/**
 * Source-level pins on the migration that makes companions possible. A
 * migration cannot be unit-tested against a database here; what it MUST say
 * can be, so a later edit cannot quietly restore the owner-read policies or
 * drop the pair scoping from recall.
 */
const sql = readFileSync(
  'supabase/migrations/20260915090000_a_companion_remembers_the_person_not_the_owner.sql',
  'utf8'
);

describe('a companion remembers the person, not the owner', () => {
  it('keys memory by the pair and never lets a pair read another', () => {
    expect(sql).toMatch(/CREATE TABLE IF NOT EXISTS public\.companion_memories/);
    expect(sql).toMatch(
      /assistant_id uuid NOT NULL REFERENCES public\.ai_assistants\(id\) ON DELETE CASCADE/
    );
    expect(sql).toMatch(/user_id uuid NOT NULL REFERENCES auth\.users\(id\) ON DELETE CASCADE/);
    expect(sql).toMatch(/where cm\.assistant_id = p_assistant_id\s+and cm\.user_id = p_user_id/);
    expect(sql).toMatch(
      /companion_memories_pair_created[\s\S]*\(assistant_id, user_id, created_at DESC\)/
    );
  });

  it('uses the vector schema the rest of the database uses', () => {
    expect(sql).toContain('printcraft.vector(1536)');
    expect(sql).toContain('printcraft.vector_cosine_ops');
    expect(sql).toMatch(/SET search_path TO 'public', 'printcraft'/);
  });

  it('grants the recall function to client roles', () => {
    expect(sql).toMatch(
      /GRANT ALL ON FUNCTION public\.match_companion_memories\(uuid, uuid, printcraft\.vector, integer, double precision\) TO authenticated/
    );
  });

  it('drops both policies that let an owner read other people', () => {
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Assistant owners can view conversations" ON public.ai_conversations;'
    );
    expect(sql).toContain(
      'DROP POLICY IF EXISTS "Assistant owners can view messages" ON public.ai_messages;'
    );
    expect(sql).not.toMatch(/CREATE POLICY "Assistant owners/);
  });

  it('lets a person delete messages in their own conversations', () => {
    expect(sql).toMatch(
      /CREATE POLICY "Users can delete messages in own conversations" ON public\.ai_messages\s+FOR DELETE/
    );
  });

  it('records where a clone came from without cascading deletes', () => {
    expect(sql).toMatch(
      /ADD COLUMN IF NOT EXISTS cloned_from uuid REFERENCES public\.ai_assistants\(id\) ON DELETE SET NULL/
    );
  });

  it('scopes every companion-memory policy to the caller', () => {
    const policies =
      sql.match(/CREATE POLICY "Users can \w+ own companion memories"[\s\S]*?;/g) ?? [];
    expect(policies).toHaveLength(4);
    for (const p of policies) {
      expect(p).toContain('user_id = (SELECT auth.uid())');
    }
  });
});
