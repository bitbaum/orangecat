/**
 * Files on direct messages: the server half.
 *
 * The bytes never pass through this app. A participant asks to upload, gets a
 * signed URL that puts exactly one object into the private bucket, and sends
 * the file straight to storage; a participant who reads a message is
 * redirected to a short-lived signed link. What this file decides is who may
 * do either — by PARTICIPATION in the conversation the file belongs to, never
 * by a column on the file — and what is allowed in at all
 * (config/message-attachments.ts, one policy shared with the browser and the
 * bucket).
 *
 * Every function takes the admin client: the table has no policy for a
 * browser role, on purpose. A caller reaching these has already been
 * authenticated by its route.
 */

import { randomUUID } from 'crypto';
import { checkAttachment, type AttachmentKind, type AttachmentRefusal } from '@bitbaum/chatkit';
import { API_ROUTES } from '@/config/api-routes';
import { DATABASE_TABLES, STORAGE_BUCKETS } from '@/config/database-tables';
import {
  MESSAGE_ATTACHMENT_POLICY,
  MESSAGE_ATTACHMENT_URL_TTL_SECONDS,
} from '@/config/message-attachments';
import { callRpc, fromTable } from '@/lib/supabase/untyped';
import { logger } from '@/utils/logger';
import type { SupabaseClient } from '@supabase/supabase-js';

const BUCKET = STORAGE_BUCKETS.MESSAGE_ATTACHMENTS;
const TABLE = DATABASE_TABLES.MESSAGE_ATTACHMENTS;
const COLUMNS =
  'id, conversation_id, message_id, uploader_id, kind, name, mime_type, bytes, width, height, duration_ms, storage_path, poster_path, created_at, sent_at, removed_at';

export interface AttachmentRow {
  id: string;
  conversation_id: string;
  message_id: string | null;
  uploader_id: string;
  kind: AttachmentKind;
  name: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  storage_path: string;
  poster_path: string | null;
  created_at: string;
  sent_at: string | null;
  removed_at: string | null;
}

/** A file as the messages API hands it to the Messenger. */
export interface MessageAttachmentDto {
  id: string;
  kind: AttachmentKind;
  name: string;
  mime_type: string;
  bytes: number;
  width: number | null;
  height: number | null;
  duration_ms: number | null;
  /** This app's route: it checks the reader and redirects to storage. */
  url: string;
  poster_url: string | null;
}

export function toAttachmentDto(row: AttachmentRow): MessageAttachmentDto {
  const url = API_ROUTES.MESSAGES.ATTACHMENT(row.id);
  return {
    id: row.id,
    kind: row.kind,
    name: row.name,
    mime_type: row.mime_type,
    bytes: Number(row.bytes),
    width: row.width,
    height: row.height,
    duration_ms: row.duration_ms,
    url,
    poster_url: row.poster_path ? `${url}?poster=1` : null,
  };
}

/** An extension for the object key, from the name the device gave the file. */
function extensionOf(name: string): string {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name.trim());
  return match ? match[1]!.toLowerCase() : 'bin';
}

/** The name readers see: one line, no path, bounded. Never used as a key. */
export function displayName(name: string): string {
  const base = name
    .replace(/[\\/]/g, ' ')
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .trim();
  return (base || 'file').slice(0, 200);
}

async function isActiveParticipant(
  admin: SupabaseClient,
  conversationId: string,
  userId: string
): Promise<boolean> {
  const { data } = await admin
    .from(DATABASE_TABLES.CONVERSATION_PARTICIPANTS)
    .select('user_id')
    .eq('conversation_id', conversationId)
    .eq('user_id', userId)
    .eq('is_active', true)
    .maybeSingle();
  return Boolean(data);
}

/** Bytes this person has stored and not deleted — what the quota counts. */
export async function storedBytesOf(admin: SupabaseClient, userId: string): Promise<number> {
  const { data, error } = await callRpc(admin, 'message_attachment_bytes', {
    p_uploader: userId,
  });
  if (error) {
    throw Object.assign(new Error('Could not read attachment usage'), { status: 500 });
  }
  return Number(data ?? 0);
}

export interface StartUploadInput {
  conversationId: string;
  name: string;
  mimeType: string;
  bytes: number;
  width?: number;
  height?: number;
  durationMs?: number;
  /** A small JPEG still goes with it (a video's first frame). */
  poster?: boolean;
}

export type StartUploadResult =
  | {
      ok: true;
      attachment: MessageAttachmentDto;
      /** Where the browser PUTs the bytes. Valid for two hours, for this one object. */
      upload: { url: string };
      poster: { url: string } | null;
    }
  | { ok: false; code: 'forbidden' }
  | { ok: false; code: 'refused'; refusal: AttachmentRefusal };

/**
 * Record an upload and issue the signed URL that carries it out.
 *
 * The kind is decided HERE from the type, never taken from the caller, and
 * the bucket re-checks type and size on the upload itself — so the route
 * cannot be talked into storing what the policy does not take.
 */
export async function startUpload(
  admin: SupabaseClient,
  userId: string,
  input: StartUploadInput
): Promise<StartUploadResult> {
  if (!(await isActiveParticipant(admin, input.conversationId, userId))) {
    return { ok: false, code: 'forbidden' };
  }

  const usedBytes = await storedBytesOf(admin, userId);
  const check = checkAttachment(
    { mimeType: input.mimeType, bytes: input.bytes },
    { usedBytes },
    MESSAGE_ATTACHMENT_POLICY
  );
  if (!check.ok) {
    return { ok: false, code: 'refused', refusal: check };
  }

  const id = randomUUID();
  const storagePath = `${input.conversationId}/${id}.${extensionOf(input.name)}`;
  const posterPath = input.poster ? `${input.conversationId}/${id}.poster.jpg` : null;

  const { data: row, error } = await fromTable(admin, TABLE)
    .insert({
      id,
      conversation_id: input.conversationId,
      uploader_id: userId,
      kind: check.kind,
      name: displayName(input.name),
      mime_type: input.mimeType.split(';')[0]!.trim().toLowerCase(),
      bytes: input.bytes,
      width: input.width ?? null,
      height: input.height ?? null,
      duration_ms: input.durationMs ?? null,
      storage_path: storagePath,
      poster_path: posterPath,
    })
    .select(COLUMNS)
    .single();
  if (error || !row) {
    logger.error('Could not record an attachment', { error, userId }, 'MessageAttachments');
    throw Object.assign(new Error('Could not start the upload'), { status: 500 });
  }

  const storage = admin.storage.from(BUCKET);
  const [file, poster] = await Promise.all([
    storage.createSignedUploadUrl(storagePath),
    posterPath ? storage.createSignedUploadUrl(posterPath) : Promise.resolve(null),
  ]);
  if (file.error || !file.data) {
    // Nothing was uploaded: the row would only wait for the sweep.
    await fromTable(admin, TABLE).delete().eq('id', id).eq('uploader_id', userId);
    logger.error('Could not sign an upload', { error: file.error }, 'MessageAttachments');
    throw Object.assign(new Error('Could not start the upload'), { status: 500 });
  }

  return {
    ok: true,
    attachment: toAttachmentDto(row as AttachmentRow),
    upload: { url: file.data.signedUrl },
    poster: poster?.data ? { url: poster.data.signedUrl } : null,
  };
}

export type ClaimResult =
  | { ok: true; rows: AttachmentRow[] }
  | { ok: false; code: 'invalid' | 'not_uploaded' | 'too_many' };

/**
 * The uploads a message is about to carry, checked before the message is
 * written: each must be the sender's own, for this conversation, not yet on a
 * message — and actually in storage. The size recorded is the size STORED,
 * not the size the browser promised, so a quota counts real bytes.
 */
export async function claimableAttachments(
  admin: SupabaseClient,
  userId: string,
  conversationId: string,
  ids: readonly string[]
): Promise<ClaimResult> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) {
    return { ok: true, rows: [] };
  }
  if (unique.length > MESSAGE_ATTACHMENT_POLICY.maxPerMessage) {
    return { ok: false, code: 'too_many' };
  }

  const { data, error } = await fromTable(admin, TABLE)
    .select(COLUMNS)
    .in('id', unique)
    .eq('uploader_id', userId)
    .eq('conversation_id', conversationId)
    .is('message_id', null)
    .is('removed_at', null);
  const rows = (data ?? []) as AttachmentRow[];
  if (error || rows.length !== unique.length) {
    return { ok: false, code: 'invalid' };
  }

  const storage = admin.storage.from(BUCKET);
  const sized = await Promise.all(
    rows.map(async row => {
      const { data: info, error: infoError } = await storage.info(row.storage_path);
      if (infoError || !info) {
        return null;
      }
      const size = Number(info.size ?? info.metadata?.size ?? row.bytes);
      return { ...row, bytes: Number.isFinite(size) && size > 0 ? size : Number(row.bytes) };
    })
  );
  if (sized.some(row => row === null)) {
    return { ok: false, code: 'not_uploaded' };
  }

  // In the order the sender picked them, which is the order of `ids`.
  const byId = new Map((sized as AttachmentRow[]).map(row => [row.id, row]));
  return { ok: true, rows: unique.map(id => byId.get(id)!) };
}

/** Put claimed uploads on the message that was just written. */
export async function attachToMessage(
  admin: SupabaseClient,
  userId: string,
  messageId: string,
  rows: readonly AttachmentRow[]
): Promise<void> {
  const sentAt = new Date().toISOString();
  await Promise.all(
    rows.map(async row => {
      const { error } = await fromTable(admin, TABLE)
        .update({ message_id: messageId, sent_at: sentAt, bytes: row.bytes })
        .eq('id', row.id)
        .eq('uploader_id', userId)
        .is('message_id', null);
      if (error) {
        logger.error(
          'Could not link an attachment to its message',
          { error, attachmentId: row.id, messageId },
          'MessageAttachments'
        );
      }
    })
  );
}

/** The files on a page of messages, grouped by message, in the order sent. */
export async function attachmentsOfMessages(
  admin: SupabaseClient,
  messageIds: readonly string[]
): Promise<Map<string, MessageAttachmentDto[]>> {
  const grouped = new Map<string, MessageAttachmentDto[]>();
  if (messageIds.length === 0) {
    return grouped;
  }
  const { data, error } = await fromTable(admin, TABLE)
    .select(COLUMNS)
    .in('message_id', [...messageIds])
    .is('removed_at', null)
    .order('created_at', { ascending: true })
    .order('id', { ascending: true });
  if (error) {
    // A thread without its pictures is still a thread; a thread that fails to
    // load because the pictures could not be listed is not.
    logger.error('Could not load message attachments', { error }, 'MessageAttachments');
    return grouped;
  }
  for (const row of (data ?? []) as AttachmentRow[]) {
    if (!row.message_id) {
      continue;
    }
    const list = grouped.get(row.message_id) ?? [];
    list.push(toAttachmentDto(row));
    grouped.set(row.message_id, list);
  }
  return grouped;
}

/**
 * A short-lived link to a file, for someone who may see it: a participant of
 * the conversation it belongs to, or — before it is on a message — the person
 * who uploaded it. `null` for everyone else, and for a file that is gone: the
 * route answers both the same way, so it cannot be used to learn what exists.
 */
export async function signedAttachmentUrl(
  admin: SupabaseClient,
  userId: string,
  attachmentId: string,
  options: { poster?: boolean } = {}
): Promise<string | null> {
  const { data } = await fromTable(admin, TABLE)
    .select(COLUMNS)
    .eq('id', attachmentId)
    .is('removed_at', null)
    .maybeSingle();
  const row = data as AttachmentRow | null;
  if (!row) {
    return null;
  }
  const allowed =
    row.message_id === null
      ? row.uploader_id === userId
      : await isActiveParticipant(admin, row.conversation_id, userId);
  if (!allowed) {
    return null;
  }
  const path = options.poster ? row.poster_path : row.storage_path;
  if (!path) {
    return null;
  }
  // A picture, a film and a recording are shown in place. Anything else is
  // DOWNLOADED, never opened: a document served inline from the storage
  // origin would run there.
  const inline = options.poster || row.kind !== 'file';
  const { data: signed, error } = await admin.storage
    .from(BUCKET)
    .createSignedUrl(
      path,
      MESSAGE_ATTACHMENT_URL_TTL_SECONDS,
      inline ? undefined : { download: row.name }
    );
  return error || !signed ? null : signed.signedUrl;
}

/** The files of deleted messages: marked now, removed from storage by the sweep. */
export async function markAttachmentsRemoved(
  admin: SupabaseClient,
  messageIds: readonly string[]
): Promise<void> {
  if (messageIds.length === 0) {
    return;
  }
  const { error } = await fromTable(admin, TABLE)
    .update({ removed_at: new Date().toISOString() })
    .in('message_id', [...messageIds])
    .is('removed_at', null);
  if (error) {
    logger.error(
      'Could not mark attachments of deleted messages',
      { error, messageIds },
      'MessageAttachments'
    );
  }
}

/** How many rows one sweep takes. The job runs daily and catches up. */
const SWEEP_BATCH = 500;

/**
 * Remove from storage what nothing points at any more: uploads that were
 * never sent (older than the policy's hours) and the files of deleted
 * messages. Objects first, rows after — a row that outlives its object is a
 * retry; an object that outlives its row is bytes nobody can find.
 *
 * @returns how many files were removed.
 */
export async function sweepAttachments(
  admin: SupabaseClient,
  now: Date = new Date()
): Promise<number> {
  const abandonedBefore = new Date(
    now.getTime() - MESSAGE_ATTACHMENT_POLICY.orphanHours * 60 * 60 * 1000
  ).toISOString();
  const { data, error } = await fromTable(admin, TABLE)
    .select('id, storage_path, poster_path')
    .or(`removed_at.not.is.null,and(sent_at.is.null,created_at.lt.${abandonedBefore})`)
    .limit(SWEEP_BATCH);
  if (error) {
    throw new Error(`Could not list attachments to sweep: ${error.message}`);
  }
  const rows = (data ?? []) as Array<Pick<AttachmentRow, 'id' | 'storage_path' | 'poster_path'>>;
  if (rows.length === 0) {
    return 0;
  }
  const paths = rows.flatMap(row => [
    row.storage_path,
    ...(row.poster_path ? [row.poster_path] : []),
  ]);
  const { error: removeError } = await admin.storage.from(BUCKET).remove(paths);
  if (removeError) {
    throw new Error(`Could not remove swept objects: ${removeError.message}`);
  }
  const { error: deleteError } = await fromTable(admin, TABLE)
    .delete()
    .in(
      'id',
      rows.map(row => row.id)
    );
  if (deleteError) {
    throw new Error(`Could not delete swept rows: ${deleteError.message}`);
  }
  return rows.length;
}
