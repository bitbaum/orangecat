import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  claimableAttachments,
  displayName,
  signedAttachmentUrl,
  startUpload,
  sweepAttachments,
  type AttachmentRow,
} from '@/features/messaging/server/attachments';
import { MESSAGE_ATTACHMENT_POLICY } from '@/config/message-attachments';

/**
 * Who may put a file into a conversation, and who may get one out.
 *
 * These decisions run with the service role, where row-level security is not
 * a backstop: if this code says yes, the answer is yes. So each rule is pinned
 * here against a database that answers exactly what the test says it does.
 */

type Call = { table: string; steps: Array<[string, unknown[]]> };

function fakeAdmin(script: {
  tables?: Record<string, Array<{ data?: unknown; error?: unknown }>>;
  usedBytes?: number;
}) {
  const calls: Call[] = [];
  const queues = new Map(Object.entries(script.tables ?? {}).map(([t, r]) => [t, [...r]]));
  const storage = {
    createSignedUploadUrl: vi.fn(async (path: string) => ({
      data: { signedUrl: `https://storage.test/upload/${path}?token=t`, token: 't', path },
      error: null,
    })),
    createSignedUrl: vi.fn(async (path: string, _ttl: number, options?: { download?: string }) => ({
      data: {
        signedUrl: `https://storage.test/read/${path}${options?.download ? '?download=1' : ''}`,
      },
      error: null,
    })),
    info: vi.fn(
      async (_path: string) =>
        ({ data: { size: 1234 }, error: null }) as {
          data: { size: number } | null;
          error: unknown;
        }
    ),
    remove: vi.fn(async (_paths: string[]) => ({ data: [], error: null })),
  };
  const admin = {
    from(table: string) {
      const call: Call = { table, steps: [] };
      calls.push(call);
      const result = queues.get(table)?.shift() ?? { data: null, error: null };
      const chain: unknown = new Proxy(
        {},
        {
          get(_target, prop: string) {
            if (prop === 'then') {
              return (resolve: (value: unknown) => unknown) =>
                Promise.resolve(result).then(resolve);
            }
            return (...args: unknown[]) => {
              call.steps.push([prop, args]);
              return chain;
            };
          },
        }
      );
      return chain;
    },
    rpc: vi.fn(async () => ({ data: script.usedBytes ?? 0, error: null })),
    storage: { from: () => storage },
  };
  return { admin: admin as unknown as SupabaseClient, calls, storage };
}

const row = (overrides: Partial<AttachmentRow> = {}): AttachmentRow => ({
  id: 'a1',
  conversation_id: 'c1',
  message_id: null,
  uploader_id: 'me',
  kind: 'image',
  name: 'cat.jpg',
  mime_type: 'image/jpeg',
  bytes: 1000,
  width: 100,
  height: 80,
  duration_ms: null,
  storage_path: 'c1/a1.jpg',
  poster_path: null,
  created_at: '2026-11-12T00:00:00Z',
  sent_at: null,
  removed_at: null,
  ...overrides,
});

const upload = { conversationId: 'c1', name: 'cat.jpg', mimeType: 'image/jpeg', bytes: 1000 };
const steps = (call: Call | undefined, name: string) =>
  (call?.steps ?? []).filter(([step]) => step === name).map(([, args]) => args);

beforeEach(() => vi.clearAllMocks());

describe('starting an upload', () => {
  it('refuses someone who is not in the conversation, before anything is stored', async () => {
    const { admin, calls, storage } = fakeAdmin({
      tables: { conversation_participants: [{ data: null }] },
    });
    const result = await startUpload(admin, 'stranger', upload);
    expect(result).toEqual({ ok: false, code: 'forbidden' });
    expect(calls.some(c => c.table === 'message_attachments')).toBe(false);
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('refuses a type the policy does not name, whatever the caller calls it', async () => {
    const { admin, storage } = fakeAdmin({
      tables: { conversation_participants: [{ data: { user_id: 'me' } }] },
    });
    const result = await startUpload(admin, 'me', {
      ...upload,
      name: 'photo.jpg',
      mimeType: 'text/html',
    });
    expect(result).toMatchObject({ ok: false, code: 'refused', refusal: { reason: 'type' } });
    expect(storage.createSignedUploadUrl).not.toHaveBeenCalled();
  });

  it('refuses a file that would not fit in what the person has left', async () => {
    const { admin } = fakeAdmin({
      tables: { conversation_participants: [{ data: { user_id: 'me' } }] },
      usedBytes: MESSAGE_ATTACHMENT_POLICY.quotaBytes!,
    });
    const result = await startUpload(admin, 'me', upload);
    expect(result).toMatchObject({ ok: false, code: 'refused', refusal: { reason: 'quota' } });
  });

  it('records the file under its conversation and hands back one signed URL for it', async () => {
    const { admin, calls, storage } = fakeAdmin({
      tables: {
        conversation_participants: [{ data: { user_id: 'me' } }],
        message_attachments: [{ data: row() }],
      },
    });
    const result = await startUpload(admin, 'me', { ...upload, name: '../../etc/pass wd.JPG' });
    expect(result.ok).toBe(true);
    const inserted = steps(
      calls.find(c => c.table === 'message_attachments'),
      'insert'
    )[0]![0] as Record<string, unknown>;
    expect(inserted.kind).toBe('image');
    expect(inserted.uploader_id).toBe('me');
    // The key is the conversation and a fresh id: nothing of the file's name
    // but its extension, so a name can never be a path.
    expect(inserted.storage_path).toMatch(/^c1\/[0-9a-f-]{36}\.jpg$/);
    expect(inserted.name).toBe('.. .. etc pass wd.JPG');
    expect(storage.createSignedUploadUrl).toHaveBeenCalledTimes(1);
    expect(storage.createSignedUploadUrl).toHaveBeenCalledWith(inserted.storage_path);
    if (result.ok) {
      expect(result.upload.url).toContain('https://storage.test/upload/c1/');
      expect(result.attachment.url).toBe('/api/messages/attachments/a1');
    }
  });

  it('a video asks for a second signed URL, for its still', async () => {
    const { admin, storage } = fakeAdmin({
      tables: {
        conversation_participants: [{ data: { user_id: 'me' } }],
        message_attachments: [
          { data: row({ kind: 'video', mime_type: 'video/mp4', poster_path: 'c1/a1.poster.jpg' }) },
        ],
      },
    });
    const result = await startUpload(admin, 'me', {
      ...upload,
      name: 'hike.mp4',
      mimeType: 'video/mp4',
      poster: true,
    });
    expect(storage.createSignedUploadUrl).toHaveBeenCalledTimes(2);
    expect(result.ok && result.poster?.url).toContain('.poster.jpg');
  });
});

describe('putting uploads on a message', () => {
  it('takes only the sender’s own unsent uploads for this conversation', async () => {
    const { admin, calls } = fakeAdmin({ tables: { message_attachments: [{ data: [row()] }] } });
    const result = await claimableAttachments(admin, 'me', 'c1', ['a1', 'a2']);
    // Two were asked for and one came back: the other is somebody else's,
    // another conversation's, already sent, or gone. All the same answer.
    expect(result).toEqual({ ok: false, code: 'invalid' });
    const query = calls[0]!;
    expect(steps(query, 'eq')).toEqual(
      expect.arrayContaining([
        ['uploader_id', 'me'],
        ['conversation_id', 'c1'],
      ])
    );
    expect(steps(query, 'is')).toEqual(
      expect.arrayContaining([
        ['message_id', null],
        ['removed_at', null],
      ])
    );
  });

  it('refuses an upload whose bytes never reached storage', async () => {
    const { admin, storage } = fakeAdmin({ tables: { message_attachments: [{ data: [row()] }] } });
    storage.info.mockResolvedValueOnce({ data: null, error: { message: 'not found' } });
    expect(await claimableAttachments(admin, 'me', 'c1', ['a1'])).toEqual({
      ok: false,
      code: 'not_uploaded',
    });
  });

  it('counts the size that was stored, not the size that was promised', async () => {
    const { admin } = fakeAdmin({
      tables: { message_attachments: [{ data: [row({ bytes: 5 })] }] },
    });
    const result = await claimableAttachments(admin, 'me', 'c1', ['a1']);
    expect(result.ok && result.rows[0]!.bytes).toBe(1234);
  });

  it('takes no more files than one message may carry', async () => {
    const { admin, calls } = fakeAdmin({});
    const ids = Array.from(
      { length: MESSAGE_ATTACHMENT_POLICY.maxPerMessage + 1 },
      (_, i) => `a${i}`
    );
    expect(await claimableAttachments(admin, 'me', 'c1', ids)).toEqual({
      ok: false,
      code: 'too_many',
    });
    expect(calls).toHaveLength(0);
  });
});

describe('reading a file', () => {
  it('an upload not yet on a message is its uploader’s alone', async () => {
    const { admin, storage } = fakeAdmin({ tables: { message_attachments: [{ data: row() }] } });
    expect(await signedAttachmentUrl(admin, 'someone-else', 'a1')).toBeNull();
    expect(storage.createSignedUrl).not.toHaveBeenCalled();
  });

  it('a file on a message is for the people in its conversation, and nobody else', async () => {
    const sent = row({ message_id: 'm1', sent_at: '2026-11-12T00:01:00Z' });
    const outsider = fakeAdmin({
      tables: {
        message_attachments: [{ data: sent }],
        conversation_participants: [{ data: null }],
      },
    });
    expect(await signedAttachmentUrl(outsider.admin, 'stranger', 'a1')).toBeNull();
    expect(outsider.storage.createSignedUrl).not.toHaveBeenCalled();

    const member = fakeAdmin({
      tables: {
        message_attachments: [{ data: sent }],
        conversation_participants: [{ data: { user_id: 'maya' } }],
      },
    });
    expect(await signedAttachmentUrl(member.admin, 'maya', 'a1')).toBe(
      'https://storage.test/read/c1/a1.jpg'
    );
  });

  it('a document is downloaded, never opened in place; a picture is shown', async () => {
    const file = row({
      kind: 'file',
      name: 'route.pdf',
      mime_type: 'application/pdf',
      storage_path: 'c1/a1.pdf',
    });
    const { admin, storage } = fakeAdmin({ tables: { message_attachments: [{ data: file }] } });
    await signedAttachmentUrl(admin, 'me', 'a1');
    expect(storage.createSignedUrl).toHaveBeenCalledWith('c1/a1.pdf', expect.any(Number), {
      download: 'route.pdf',
    });

    const picture = fakeAdmin({ tables: { message_attachments: [{ data: row() }] } });
    await signedAttachmentUrl(picture.admin, 'me', 'a1');
    expect(picture.storage.createSignedUrl).toHaveBeenCalledWith(
      'c1/a1.jpg',
      expect.any(Number),
      undefined
    );
  });

  it('a file that is gone and a file that is not yours get the same answer', async () => {
    const { admin } = fakeAdmin({ tables: { message_attachments: [{ data: null }] } });
    expect(await signedAttachmentUrl(admin, 'me', 'missing')).toBeNull();
  });
});

describe('the daily sweep', () => {
  it('removes the objects, stills included, and only then the rows', async () => {
    const order: string[] = [];
    const { admin, calls, storage } = fakeAdmin({
      tables: {
        message_attachments: [
          {
            data: [
              { id: 'a1', storage_path: 'c1/a1.mp4', poster_path: 'c1/a1.poster.jpg' },
              { id: 'a2', storage_path: 'c1/a2.jpg', poster_path: null },
            ],
          },
          { data: null },
        ],
      },
    });
    storage.remove.mockImplementationOnce(async () => {
      order.push('objects');
      return { data: [], error: null };
    });
    const swept = await sweepAttachments(admin, new Date('2026-11-13T00:00:00Z'));
    order.push('rows');
    expect(swept).toBe(2);
    expect(storage.remove).toHaveBeenCalledWith(['c1/a1.mp4', 'c1/a1.poster.jpg', 'c1/a2.jpg']);
    expect(order).toEqual(['objects', 'rows']);
    // Unsent uploads older than the policy's hours, or files of deleted messages.
    const filter = steps(calls[0], 'or')[0]![0] as string;
    expect(filter).toContain('removed_at.not.is.null');
    expect(filter).toContain('created_at.lt.2026-11-12T00:00:00.000Z');
  });

  it('keeps the rows when the objects could not be removed, so the next run retries', async () => {
    const { admin, calls, storage } = fakeAdmin({
      tables: {
        message_attachments: [
          { data: [{ id: 'a1', storage_path: 'c1/a1.jpg', poster_path: null }] },
        ],
      },
    });
    storage.remove.mockResolvedValueOnce({ data: [], error: { message: 'storage down' } } as never);
    await expect(sweepAttachments(admin)).rejects.toThrow(/storage down/);
    expect(calls.filter(c => steps(c, 'delete').length > 0)).toHaveLength(0);
  });
});

describe('a file name', () => {
  it('is one bounded line and never a path', () => {
    expect(displayName('a/b\\c.png')).toBe('a b c.png');
    expect(displayName('   ')).toBe('file');
    expect(displayName('x'.repeat(500))).toHaveLength(200);
  });
});
