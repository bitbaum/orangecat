// src/lib/message-sync-manager.ts
// Manages synchronization of queued messages when connection is restored

import { logger } from '@/utils/logger';
import { messageQueueService, type QueuedMessage } from './message-queue';
import { API_ROUTES } from '@/config/api-routes';
import {
  messageQueueUpdated,
  messageSyncStart,
  messageSyncProgress,
  messageSyncComplete,
} from './message-queue-events';
import { apiErrorMessage } from '@/lib/api/errorMessage';

const MAX_SYNC_ATTEMPTS = 5;

let isSyncing = false;
let currentUserId: string | null = null;
let scheduledRetry: ReturnType<typeof setTimeout> | null = null;

/**
 * Sets the current user ID for filtering queued messages.
 */
function setMessageSyncUser(id: string | null): void {
  currentUserId = id;
}

/**
 * Classifies errors as permanent (should be removed) or transient (should retry).
 */
function classifyError(err: unknown): 'permanent' | 'transient' {
  const e = err as { response?: { status?: number }; status?: number };
  const status = e?.response?.status ?? e?.status;
  if (typeof status === 'number') {
    // 4xx errors (except 429) are permanent - don't retry
    if ([400, 401, 403, 404].includes(status)) {
      return 'permanent';
    }
    // 429 and 5xx are transient - retry
    if (status === 429 || status >= 500) {
      return 'transient';
    }
  }
  // Network or unknown errors treated as transient
  return 'transient';
}

/**
 * Sends a single queued message to the server.
 */
async function sendQueuedMessage(message: QueuedMessage): Promise<boolean> {
  const { conversationId, content, messageType = 'text', metadata } = message.payload;

  try {
    const response = await fetch(API_ROUTES.MESSAGES.CONVERSATION(conversationId), {
      method: 'POST',
      credentials: 'include',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content,
        messageType,
        metadata,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw Object.assign(new Error(apiErrorMessage(errorData, 'Failed to send message')), {
        status: response.status,
        response: { status: response.status },
      });
    }

    return true;
  } catch (err) {
    logger.error(`Failed to send queued message ${message.id}`, err, 'MessageSyncManager');
    throw err;
  }
}

/**
 * Processes the offline message queue, sending each message to the server.
 */
async function processMessageQueue(): Promise<void> {
  if (isSyncing) {
    logger.info('Message sync already in progress.', 'MessageSyncManager');
    return;
  }

  if (!navigator.onLine) {
    logger.info('Cannot sync messages, currently offline.', 'MessageSyncManager');
    return;
  }

  if (!currentUserId) {
    logger.info(
      'No user bound to message sync manager. Skipping processing.',
      'MessageSyncManager'
    );
    return;
  }

  isSyncing = true;
  logger.info('Starting message queue sync.', 'MessageSyncManager');

  try {
    const queue = await messageQueueService.getMessageQueueByUser(currentUserId);
    if (queue.length === 0) {
      logger.info('Message queue is empty.', 'MessageSyncManager');
      return;
    }

    logger.info(`Processing ${queue.length} messages from the queue.`, 'MessageSyncManager');
    messageSyncStart(queue.length);

    let processed = 0;
    for (const message of queue) {
      if (message.attempts >= MAX_SYNC_ATTEMPTS) {
        logger.warn(
          `Message ${message.id} has exceeded max sync attempts. Removing from queue.`,
          'MessageSyncManager'
        );
        await messageQueueService.removeMessageFromQueue(message.id);
        processed += 1;
        messageSyncProgress(processed, queue.length);
        continue;
      }

      try {
        const success = await sendQueuedMessage(message);
        if (success) {
          logger.info(
            `Successfully synced message ${message.id}. Removing from queue.`,
            'MessageSyncManager'
          );
          await messageQueueService.removeMessageFromQueue(message.id);
        }
      } catch (err) {
        const type = classifyError(err);
        if (type === 'permanent') {
          logger.warn(
            `Permanent error for message ${message.id}. Removing from queue.`,
            'MessageSyncManager'
          );
          await messageQueueService.removeMessageFromQueue(message.id);
        } else {
          logger.info(
            `Transient error for message ${message.id}. Will retry.`,
            'MessageSyncManager'
          );
          await messageQueueService.incrementMessageAttemptCount(message.id);
        }
      }

      processed += 1;
      messageSyncProgress(processed, queue.length);
    }

    logger.info('Message queue sync finished.', 'MessageSyncManager');
  } catch (err) {
    logger.error('An error occurred during message queue processing.', err, 'MessageSyncManager');
  } finally {
    isSyncing = false;
    messageQueueUpdated();
    messageSyncComplete();

    // If items remain, schedule a retry with exponential backoff
    if (navigator.onLine && currentUserId) {
      messageQueueService
        .getMessageQueueByUser(currentUserId)
        .then(remain => {
          if (remain.length > 0) {
            const maxAttempts = remain.reduce((m, msg) => Math.max(m, msg.attempts || 0), 0);
            const base = 2000 * Math.pow(2, Math.min(maxAttempts, 5));
            const jitter = Math.floor(Math.random() * 1000);
            const delay = Math.min(60000, base + jitter);
            if (scheduledRetry) {
              clearTimeout(scheduledRetry);
            }
            scheduledRetry = setTimeout(processMessageQueue, delay);
            logger.info(`Scheduled next message sync attempt in ${delay}ms.`, 'MessageSyncManager');
          }
        })
        .catch(() => {
          // Silent fail for retry scheduling
        });
    }
  }
}

/**
 * Initializes the message sync manager.
 * Listens for online events to trigger queue sync.
 */
function initMessageSync(): void {
  // Listen for the browser coming online
  window.addEventListener('online', processMessageQueue);

  // When tab becomes visible again, try syncing
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') {
      processMessageQueue();
    }
  });

  // Attempt to process the queue on initial load
  setTimeout(processMessageQueue, 5000);

  logger.info('Message Sync Manager initialized.', 'MessageSyncManager');
}

export const messageSyncManager = {
  init: initMessageSync,
  processQueue: processMessageQueue,
  setCurrentUser: setMessageSyncUser,
};
