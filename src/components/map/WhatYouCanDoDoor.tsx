'use client';

import { DashboardIntent } from '@/components/dashboard/DashboardIntent';
import { TheDoor } from '@/components/map/TheDoor';
import { useAuth } from '@/hooks/useAuth';

/**
 * The door on "What you can do", for whoever is reading.
 *
 * Signed in, it is the app's own door (DashboardIntent: chatkit's composer,
 * so the microphone and the Cat's keyboard come with it) — the page sits in
 * the app shell then (getShellSurface). Signed out, it stays TheDoor: a plain
 * GET form that works without JavaScript and carries the sentence through
 * sign-in. Dictation needs an account (the transcriber is behind sign-in), so
 * the signed-out door has none to offer yet.
 *
 * No flash between the two: AppShell renders nothing until auth has hydrated.
 */
export function WhatYouCanDoDoor({ examples }: { examples: readonly string[] }) {
  const { user } = useAuth();
  return user ? (
    <div className="max-w-2xl">
      <DashboardIntent examples={examples} />
    </div>
  ) : (
    <TheDoor className="max-w-2xl" examples={examples} />
  );
}
