/**
 * What a client may send to POST /api/messages/[conversationId].
 *
 * Kept beside the messaging rules rather than in the route: the route is the
 * HTTP layer and stays thin (scripts/check-file-sizes.js), and "a message is
 * words, or files, or both" is a rule, not plumbing.
 */

import { z } from 'zod';
import { MESSAGE_ATTACHMENT_POLICY } from '@/config/message-attachments';
import { MESSAGE_TYPES, VALIDATION } from './constants';

export const sendMessageSchema = z
  .object({
    // Words, or files, or a payment request, or several: a photo needs no caption.
    content: z.string().max(VALIDATION.MESSAGE_MAX_LENGTH),
    /** Uploads to put on the message (POST /api/messages/attachments made them). */
    attachmentIds: z
      .array(z.string().guid())
      .max(MESSAGE_ATTACHMENT_POLICY.maxPerMessage)
      .optional(),
    messageType: z
      .enum([MESSAGE_TYPES.TEXT, MESSAGE_TYPES.IMAGE, MESSAGE_TYPES.FILE, MESSAGE_TYPES.SYSTEM])
      .default(MESSAGE_TYPES.TEXT),
    metadata: z.record(z.string(), z.unknown()).optional(),
    /** Echoed back on the stored row so the client retires its optimistic bubble
     *  rather than rendering a duplicate. */
    clientId: z.string().min(1).max(128).optional(),
    senderActorId: z.string().guid().optional(),
    /** The message this one answers. The server re-reads it; one that is not
     *  in this conversation is ignored, never an error. */
    replyToId: z.string().guid().optional(),
    /** The sender's own payment request (POST /api/payment-requests made it),
     *  shown in the conversation as a card. */
    paymentRequestId: z.string().guid().optional(),
  })
  .refine(
    body =>
      body.content.trim().length >= VALIDATION.MESSAGE_MIN_LENGTH ||
      (body.attachmentIds?.length ?? 0) > 0 ||
      Boolean(body.paymentRequestId),
    { message: 'A message needs words or a file', path: ['content'] }
  );

export type SendMessageBody = z.infer<typeof sendMessageSchema>;
