// src/lib/offline-queue.ts
// Post-specific offline queue service (refactored to use generic base)

import { queueUpdated } from '@/lib/offline-queue-events';
import {
  addToQueueStore,
  getQueueStore,
  removeFromQueueStore,
  incrementAttemptCount as baseIncrementAttemptCount,
  clearQueueStore,
  getQueueByUser as baseGetQueueByUser,
  registerQueueStore,
  type QueuedItem,
} from './offline-queue-base';

const STORE_NAME = 'offlinePostQueue';

// QueuedPost is a type alias for backward compatibility
type QueuedPost = QueuedItem<unknown>;

// Register the post queue store
registerQueueStore(STORE_NAME, () => {
  queueUpdated();
});

/**
 * Adds a post to the offline queue.
 * @param payload - The data required to make the post API call.
 */
export async function addToQueue(payload: unknown, userId: string): Promise<void> {
  await addToQueueStore(STORE_NAME, payload, userId);
}

/**
 * Retrieves all posts from the offline queue, sorted by creation time.
 */
export async function getQueue(): Promise<QueuedPost[]> {
  return getQueueStore<unknown>(STORE_NAME);
}

/**
 * Removes a post from the queue by its ID.
 * @param id - The ID of the post to remove.
 */
export async function removeFromQueue(id: string): Promise<void> {
  return removeFromQueueStore(STORE_NAME, id);
}

/**
 * Updates the attempt count for a queued post.
 * @param id - The ID of the post to update.
 */
export async function incrementAttemptCount(id: string): Promise<void> {
  return baseIncrementAttemptCount(STORE_NAME, id);
}

/**
 * Clears the entire offline post queue.
 */
export async function clearQueue(): Promise<void> {
  return clearQueueStore(STORE_NAME);
}

/**
 * Retrieves all posts for a specific user.
 */
export async function getQueueByUser(userId: string): Promise<QueuedPost[]> {
  return baseGetQueueByUser<unknown>(STORE_NAME, userId);
}

export const offlineQueueService = {
  addToQueue,
  getQueue,
  getQueueByUser,
  removeFromQueue,
  incrementAttemptCount,
  clearQueue,
};
