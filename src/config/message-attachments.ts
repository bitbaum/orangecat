/**
 * What may be sent with a direct message, and what it may cost.
 *
 * ONE policy, checked in the same words in three places: the browser (before
 * an upload starts — the Messenger, `@bitbaum/chatkit/messenger`), this app's
 * routes (before a storage URL is issued), and the storage bucket itself
 * (`message-attachments`: its size limit and type list are set by migration
 * 20261112235900 from the same numbers). Change a ceiling here and the bucket
 * with it, or the three disagree.
 *
 * The rules are `@bitbaum/threadkit`'s (`checkAttachment`), re-exported by
 * chatkit until npm serves threadkit 0.1.2.
 *
 * Why these numbers. Storage is Cloudflare R2 behind storage-api
 * (docs/operations/STORAGE_R2_BACKEND.md): stored bytes are what is billed,
 * and every upload and download passes through the box. So:
 *   - a photo is shrunk in the browser to 2048px / 1.5 MB before it leaves
 *     the phone (a 12-megapixel original is several megabytes nobody reads at
 *     that size); the 10 MB image ceiling is for what cannot be shrunk;
 *   - a video is capped at 50 MB and is never transcoded here — the box has
 *     no business re-encoding film;
 *   - one person may keep 1 GB stored at a time; deleting a message frees its
 *     files' room;
 *   - an upload that never became a message is swept after a day.
 */
import { DEFAULT_ATTACHMENT_POLICY, type AttachmentPolicy } from '@bitbaum/chatkit';

export const MESSAGE_ATTACHMENT_POLICY: AttachmentPolicy = DEFAULT_ATTACHMENT_POLICY;

/** How photos are shrunk before upload (the Messenger's `composer.attach`). */
export const MESSAGE_IMAGE_MAX_EDGE = 2048;
export const MESSAGE_IMAGE_MAX_BYTES = 1_500_000;

/**
 * How long a link to a file works. Long enough to watch a video through,
 * short enough that a copied link is not a standing grant. The redirect that
 * issues it is cached by the browser for a little less, so scrolling a thread
 * does not fetch the same picture twice.
 */
export const MESSAGE_ATTACHMENT_URL_TTL_SECONDS = 60 * 60;
