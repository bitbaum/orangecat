# Offline Support Feature - Implementation Summary

**Date:** 2025-11-16
**Feature Goal:** Allow users to create posts while offline, with automatic synchronization when connectivity is restored.

---

## 1. Core Logic & Data Persistence

### `src/lib/offline-queue.ts`

- **Purpose:** Manages the persistent storage of pending posts using IndexedDB.
- **Key Functionality:**
  - `addToQueue(payload)`: Adds a new post payload to IndexedDB.
  - `getQueue()`: Retrieves all posts from the queue, sorted by creation time.
  - `removeFromQueue(id)`: Removes a post from the queue after successful sync.
  - `incrementAttemptCount(id)`: Tracks sync attempts for each post.
  - `clearQueue()`: Empties the entire queue.
- **Integration:** Dispatches namespaced custom events to notify UI components of changes.
  - `offline-queue:updated` (and legacy `offline-queue-updated` for back-compat)

---

## 2. Offline Posting Integration

### `src/hooks/usePostComposerNew.ts`

- **Purpose:** Modifies the posting flow to handle offline scenarios.
- **Key Changes:**
  - Before attempting to send a post, it checks `navigator.onLine`.
  - If offline, the post payload is added to the `offlineQueueService`.
  - Provides user feedback: "You're offline. Your post has been saved and will be sent later."
  - Resets the composer form after queuing.

---

## 3. Synchronization Manager

### `src/lib/sync-manager.ts`

- **Purpose:** Orchestrates the background synchronization of queued posts.
- **Key Functionality:**
  - `init()`: Initializes the manager, listening for `online` and `visibilitychange` events.
  - `setCurrentUser(userId)`: Limits syncing to the active user's queued posts.
  - `processQueue()`:
    - Executed when the browser comes online, tab becomes visible, or on initial load (delayed).
    - Retrieves posts by user from `offlineQueueService`.
    - Attempts to send each post to `timelineService.createEvent()`.
    - Removes successfully sent posts from the queue.
    - Error classification: drops 4xx failures, retries 429/5xx/network failures.
    - Schedules exponential backoff with jitter if items remain.
    - Emits lifecycle events: `offline-queue:sync-start`, `offline-queue:sync-progress`, `offline-queue:sync-complete`.
- **Resilience:** Backoff + jitter, user scoping, and max attempt limits to prevent stuck posts.

---

## 4. UI & Application Integration

### `src/hooks/useOfflineQueue.ts`

- **Purpose:** A React hook to provide real-time status of the offline queue to UI components.
- **Key Functionality:**
  - Monitors namespaced lifecycle events (`offline-queue:updated`, `offline-queue:sync-*`) and `online`/`offline` browser events.
  - Provides `queueLength`, `isOnline`, `isSyncing`, and progress `{ processed, total }`.
  - Filters queue by current user for accuracy.

### `src/components/ui/OfflineQueueIndicator.tsx`

- **Purpose:** A visual component to inform the user about offline status and pending posts.
- **Key Functionality:**
  - Uses `useOfflineQueue` to get status.
  - Renders a small, fixed-position button in the bottom-left corner.
  - Visible if offline, syncing, or items are queued.
  - Displays icons and text for "Offline Mode", "Syncing A/B", and "X posts pending".
  - Announces updates with `aria-live="polite"`.
  - On click: opens Queue Manager (bottom sheet) to view/remove queued posts (rolling out).

### `src/components/SyncManagerInitializer.tsx`

- **Purpose:** A client-side component to ensure `syncManager.init()` is called once when the application loads.
- **Integration:** Renders `null` and uses `useEffect` to initialize the `syncManager`.

### `src/app/layout.tsx`

- **Integration:**
  - Imports and renders `<SyncManagerInitializer />` to start the sync process.
  - Imports and renders `<OfflineQueueIndicator />` to display the UI status globally.

---

## Next Steps

- **Testing:** Thorough testing of offline/online transitions, post failures, and queue management.
- **UI Enhancement:** Implement a full modal for viewing and managing queued posts.
- **Error Handling:** Refine error messages for failed sync attempts in `syncManager`.

---

**Last Updated:** 2025-11-16
