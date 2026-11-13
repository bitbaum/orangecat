/**
 * GET /api/messages/attachments/[id] — a file on a message, for someone who
 * may see it.
 *
 * Messages carry THIS address, never a storage link: it checks that the
 * reader is in the conversation and redirects to a signed link that expires.
 * `?poster=1` is a video's still. Someone who may not see the file and a file
 * that does not exist get the same 404, so the route says nothing about what
 * exists.
 *
 * The redirect is cached privately for a little less than the link lives, so
 * scrolling a thread asks once per picture, and the picture's bytes are then
 * cached under that link.
 */

import { NextResponse } from 'next/server';
import { MESSAGE_ATTACHMENT_URL_TTL_SECONDS } from '@/config/message-attachments';
import { signedAttachmentUrl } from '@/features/messaging/server/attachments';
import { withAuth, type AuthenticatedRequest } from '@/lib/api/withAuth';
import { apiNotFound, handleApiError } from '@/lib/api/standardResponse';
import { getValidationError, validateUUID } from '@/lib/api/validation';
import { createAdminClient } from '@/lib/supabase/admin';
import { logger } from '@/utils/logger';

/** The link outlives the cached redirect by this much, so a cached redirect
 *  never points at a link that has just expired. */
const CACHE_MARGIN_SECONDS = 5 * 60;

export const GET = withAuth(
  async (req: AuthenticatedRequest, { params }: { params: Promise<{ id: string }> }) => {
    const { id } = await params;
    const invalid = getValidationError(validateUUID(id, 'attachment ID'));
    if (invalid) {
      return invalid;
    }
    try {
      const poster = new URL(req.url).searchParams.get('poster') === '1';
      const url = await signedAttachmentUrl(createAdminClient(), req.user.id, id, { poster });
      if (!url) {
        return apiNotFound('File not found');
      }
      return new NextResponse(null, {
        status: 302,
        headers: {
          Location: url,
          'Cache-Control': `private, max-age=${MESSAGE_ATTACHMENT_URL_TTL_SECONDS - CACHE_MARGIN_SECONDS}`,
        },
      });
    } catch (error) {
      logger.error('Attachment read failed', { error, attachmentId: id }, 'Messages');
      return handleApiError(error);
    }
  }
);
