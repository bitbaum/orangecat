/**
 * A thumb under an answer, sent to the product (the fleet chat-review loop).
 *
 * chatkit draws the thumbs and the reason sheet; this is the one place the
 * app posts what the person said. Best-effort: a verdict that fails to
 * land is logged, never shown — the person already saw "Thanks, noted".
 */

import type { AnswerFeedback } from '@bitbaum/chatkit';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

export async function postChatFeedback(
  conversationId: string,
  feedback: AnswerFeedback
): Promise<void> {
  try {
    const res = await fetch(API_ROUTES.CHAT.FEEDBACK, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversationId, ...feedback }),
    });
    if (!res.ok) {
      logger.warn('Chat feedback not stored', { status: res.status }, 'chat/feedback');
    }
  } catch (err: unknown) {
    logger.warn('Chat feedback not sent', { err }, 'chat/feedback');
  }
}
