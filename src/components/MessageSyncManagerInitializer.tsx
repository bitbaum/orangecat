'use client';

import { useEffect } from 'react';
import { messageSyncManager } from '@/lib/message-sync-manager';
import { useAuth } from '@/hooks/useAuth';

/**
 * A client component that initializes the message queue sync manager.
 * This component renders nothing to the DOM.
 */
export function MessageSyncManagerInitializer() {
  const { user } = useAuth();

  useEffect(() => {
    // Initialize the message sync manager on the client side when the app loads.
    messageSyncManager.init();
  }, []); // The empty dependency array ensures this runs only once on mount.

  // Bind current user to the sync manager and update on changes
  useEffect(() => {
    messageSyncManager.setCurrentUser(user?.id ?? null);
    // Kick a processing attempt when user changes (e.g., login)
    if (user?.id) {
      messageSyncManager.processQueue();
    }
  }, [user?.id]);

  return null;
}
