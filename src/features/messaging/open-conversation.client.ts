import { API_ROUTES } from '@/config/api-routes';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/** Shared client contract for the inbox and listing inquiry entrypoints. */
export async function openConversationFor(
  participantIds: string[],
  signal?: AbortSignal
): Promise<string> {
  const response = await fetch(API_ROUTES.MESSAGES.OPEN, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    credentials: 'same-origin',
    body: JSON.stringify({ participantIds }),
    signal,
  });
  const payload = await response.json().catch(() => null);
  const id: unknown = payload?.data?.conversationId ?? payload?.conversationId;
  if (!response.ok || typeof id !== 'string' || !id.trim()) {
    throw new Error(apiErrorMessage(payload, 'Could not open the conversation. Please try again.'));
  }
  return id;
}
