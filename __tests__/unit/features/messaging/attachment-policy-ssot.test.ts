import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { MESSAGE_ATTACHMENT_POLICY } from '@/config/message-attachments';

/**
 * One policy, three enforcers: the browser, the routes and the storage bucket.
 * The first two import config/message-attachments.ts; the bucket is set by a
 * migration, which cannot import anything. This test is what keeps the third
 * in step — a ceiling raised in one place and not the other is an upload the
 * app allows and the storage refuses, shown to a person as "could not be
 * uploaded".
 */
const migration = readFileSync(
  'supabase/migrations/20261112200000_messages_can_carry_files.sql',
  'utf8'
);

describe('message attachments: the policy and the bucket agree', () => {
  it('the bucket takes exactly the types the policy names', () => {
    const block = /insert into storage\.buckets[\s\S]*?array\[([\s\S]*?)\]\s*\)/.exec(migration);
    expect(block, 'the migration creates the bucket with a type list').not.toBeNull();
    const inBucket = [...block![1]!.matchAll(/'([^']+)'/g)].map(m => m[1]!).sort();
    const inPolicy = Object.values(MESSAGE_ATTACHMENT_POLICY.accept).flat().sort();
    expect(inBucket).toEqual(inPolicy);
  });

  it("the bucket's size limit is the policy's largest file", () => {
    const limit = /false,\s*(\d+),\s*array\[/.exec(migration);
    expect(limit, 'the migration sets file_size_limit').not.toBeNull();
    expect(Number(limit![1])).toBe(Math.max(...Object.values(MESSAGE_ATTACHMENT_POLICY.maxBytes)));
  });

  it('the bucket is private and no browser role can touch the table', () => {
    expect(migration).toMatch(/'message-attachments',\s*'message-attachments',\s*false/);
    expect(migration).toMatch(/enable row level security/);
    expect(migration).toMatch(
      /revoke all on table public\.message_attachments from anon, authenticated/
    );
    expect(migration).not.toMatch(/create policy/i);
  });

  it('nothing that can run script is accepted', () => {
    const accepted = Object.values(MESSAGE_ATTACHMENT_POLICY.accept).flat();
    expect(accepted).not.toContain('image/svg+xml');
    expect(accepted).not.toContain('text/html');
    expect(accepted.some(type => type.includes('*'))).toBe(false);
  });
});
