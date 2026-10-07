// src/lib/offline-queue-base.ts
// Generic offline queue service - reusable for posts, messages, and other operations

import { logger } from '@/utils/logger';

const DB_NAME = 'OrangeCatDB';
const DB_VERSION = 2; // Incremented to support new message queue store

// Known store names - must be registered here for upgrade handler
const KNOWN_STORES = ['offlinePostQueue', 'offlineMessageQueue'];

export interface QueuedItem<T = unknown> {
  id: string;
  payload: T;
  createdAt: number;
  attempts: number;
  userId: string;
  storeName: string; // Track which store this belongs to
}

interface QueueStoreConfig {
  storeName: string;
  onUpdated?: () => void;
}

let db: IDBDatabase | null = null;
const storeConfigs = new Map<string, QueueStoreConfig>();

/**
 * Opens and initializes the IndexedDB database.
 * Handles multiple object stores for different queue types.
 */
function getDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (db) {
      return resolve(db);
    }

    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = () => {
      logger.error('Failed to open IndexedDB', request.error, 'OfflineQueueBase');
      reject(new Error('Failed to open IndexedDB'));
    };

    request.onsuccess = () => {
      db = request.result;
      resolve(db);
    };

    request.onupgradeneeded = event => {
      const tempDb = (event.target as IDBOpenDBRequest).result;

      // Create all known stores during upgrade
      KNOWN_STORES.forEach(storeName => {
        if (!tempDb.objectStoreNames.contains(storeName)) {
          tempDb.createObjectStore(storeName, { keyPath: 'id' });
        }
      });

      // Also create stores for any registered configs (for future extensibility)
      storeConfigs.forEach(config => {
        if (!tempDb.objectStoreNames.contains(config.storeName)) {
          tempDb.createObjectStore(config.storeName, { keyPath: 'id' });
        }
      });
    };
  });
}

/**
 * Registers a queue store configuration.
 * Must be called before using the queue for a specific type.
 */
export function registerQueueStore(storeName: string, onUpdated?: () => void): void {
  storeConfigs.set(storeName, { storeName, onUpdated });
}

/**
 * Generic function to add an item to a queue store.
 */
export async function addToQueueStore<T>(
  storeName: string,
  payload: T,
  userId: string
): Promise<string> {
  const db = await getDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  const item: QueuedItem<T> = {
    id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    payload,
    createdAt: Date.now(),
    attempts: 0,
    userId,
    storeName,
  };

  return new Promise((resolve, reject) => {
    const request = store.add(item);
    request.onsuccess = () => {
      logger.info(`Item added to ${storeName}`, item.id, 'OfflineQueueBase');
      const config = storeConfigs.get(storeName);
      config?.onUpdated?.();
      resolve(item.id);
    };
    request.onerror = () => {
      logger.error(`Failed to add item to ${storeName}`, request.error, 'OfflineQueueBase');
      reject(request.error);
    };
  });
}

/**
 * Generic function to retrieve all items from a queue store.
 */
export async function getQueueStore<T>(storeName: string): Promise<QueuedItem<T>[]> {
  const db = await getDB();
  const transaction = db.transaction(storeName, 'readonly');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.getAll();
    request.onsuccess = () => {
      // Sort by oldest first to process in order
      const sorted = request.result.sort((a, b) => a.createdAt - b.createdAt);
      resolve(sorted);
    };
    request.onerror = () => {
      logger.error(`Failed to get queue from ${storeName}`, request.error, 'OfflineQueueBase');
      reject(request.error);
    };
  });
}

/**
 * Generic function to remove an item from a queue store.
 */
export async function removeFromQueueStore(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.delete(id);
    request.onsuccess = () => {
      logger.info(`Item removed from ${storeName}`, id, 'OfflineQueueBase');
      const config = storeConfigs.get(storeName);
      config?.onUpdated?.();
      resolve();
    };
    request.onerror = () => {
      logger.error(`Failed to remove item from ${storeName}`, request.error, 'OfflineQueueBase');
      reject(request.error);
    };
  });
}

/**
 * Generic function to increment attempt count for a queued item.
 */
export async function incrementAttemptCount(storeName: string, id: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.get(id);
    request.onsuccess = () => {
      const item = request.result;
      if (item) {
        item.attempts += 1;
        const updateRequest = store.put(item);
        updateRequest.onsuccess = () => {
          const config = storeConfigs.get(storeName);
          config?.onUpdated?.();
          resolve();
        };
        updateRequest.onerror = () => {
          logger.error(
            `Failed to update attempt count in ${storeName}`,
            updateRequest.error,
            'OfflineQueueBase'
          );
          reject(updateRequest.error);
        };
      } else {
        resolve();
      }
    };
    request.onerror = () => {
      logger.error(`Failed to get item from ${storeName}`, request.error, 'OfflineQueueBase');
      reject(request.error);
    };
  });
}

/**
 * Generic function to clear a queue store.
 */
export async function clearQueueStore(storeName: string): Promise<void> {
  const db = await getDB();
  const transaction = db.transaction(storeName, 'readwrite');
  const store = transaction.objectStore(storeName);

  return new Promise((resolve, reject) => {
    const request = store.clear();
    request.onsuccess = () => {
      logger.info(`${storeName} cleared`, 'OfflineQueueBase');
      const config = storeConfigs.get(storeName);
      config?.onUpdated?.();
      resolve();
    };
    request.onerror = () => {
      logger.error(`Failed to clear ${storeName}`, request.error, 'OfflineQueueBase');
      reject(request.error);
    };
  });
}

/**
 * Generic function to get items by user from a queue store.
 */
export async function getQueueByUser<T>(
  storeName: string,
  userId: string
): Promise<QueuedItem<T>[]> {
  const all = await getQueueStore<T>(storeName);
  return all.filter(item => item.userId === userId);
}
