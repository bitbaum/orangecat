/**
 * PHOTOS IN THE CAT CHAT — the wire shape and where they join the prompt.
 *
 * The picker used to accept text files only, so a photo was not even visible
 * in the file dialog. A photo now travels beside the message (not inside its
 * 10k-char text) as a downscaled data URL, and is attached to the CURRENT user
 * turn only at the moment a model is called. Everything before that — token
 * budgets, the Groq pre-flight, tool routing, grounding, persistence — keeps
 * working on plain text, because none of it can reason about pixels.
 *
 * The thread keeps a <attached_image name="…"/> tag in the saved message, so
 * a reload shows what was sent; the pixels themselves are not stored.
 */

import { z } from 'zod';
import type { ContentPart } from '@bitbaum/ai-kit';

/** Photos per message. A handful is a question; more is an album. */
export const CHAT_IMAGE_MAX_COUNT = 3;

/** Long edge the client scales to before sending — readable, and small. */
export const CHAT_IMAGE_MAX_EDGE_PX = 1568;

/** Cap on one data URL (~2 MB of image). The client stays far under it. */
export const CHAT_IMAGE_MAX_DATA_URL_CHARS = 2_800_000;

const DATA_URL = /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;

export const chatImageSchema = z.object({
  name: z.string().min(1).max(200),
  dataUrl: z.string().max(CHAT_IMAGE_MAX_DATA_URL_CHARS).regex(DATA_URL, 'not an image data URL'),
});

export type ChatImage = z.infer<typeof chatImageSchema>;

type WireMessage = { role: string; content?: unknown };

/**
 * The same messages, with the photos attached to the last user turn as
 * OpenAI-style image parts. Unchanged when there are no photos.
 */
export function withImages<T extends WireMessage>(
  messages: T[],
  images: ChatImage[] | undefined
): Array<T | (Omit<T, 'content'> & { content: ContentPart[] })> {
  if (!images || images.length === 0) {
    return messages;
  }
  const at = messages.map(m => m.role).lastIndexOf('user');
  if (at < 0) {
    return messages;
  }
  const turn = messages[at];
  const parts: ContentPart[] = [
    { type: 'text', text: typeof turn.content === 'string' ? turn.content : '' },
    ...images.map(img => ({ type: 'image_url' as const, image_url: { url: img.dataUrl } })),
  ];
  return messages.map((m, i) => (i === at ? { ...m, content: parts } : m));
}
