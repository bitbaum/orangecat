'use client';

/**
 * Say what you want to make, and land in it.
 *
 * The create menu asks a question most people can't answer yet: is the bike in
 * your garage a product, or an asset? Is the lesson you'd give a service, or an
 * event? You have to know OrangeCat's vocabulary before you can start. Speaking
 * skips that — you say "sell my old road bike for 200 francs" and the form that
 * opens is already the right one, already filled in.
 *
 * Nothing new happens downstream: the transcript is routed to an entity type,
 * then handed to the create path as `?description=`, which the existing AI
 * prefill bar picks up exactly as it does for the onboarding flow.
 *
 * When the routing is uncertain it says so and leaves the menu alone. Dropping
 * someone into the wrong form to avoid admitting uncertainty costs them more
 * than the question does.
 */

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Mic, Square, Loader2, AlertCircle } from 'lucide-react';
import { API_ROUTES } from '@/config/api-routes';
import { ENTITY_REGISTRY, type EntityType } from '@/config/entity-registry';
import { useDictation } from '@/hooks/useDictation';
import { dictationErrorMessage } from '@/config/dictation-copy';
import { unwrapApiResponse } from '@/lib/api/client-response';
import { logger } from '@/utils/logger';
import { cn } from '@/lib/utils';
import { FEATURES } from '@/config/features';

interface VoiceCreateProps {
  /** Called once we're navigating away, so a containing sheet can close. */
  onNavigate?: () => void;
  className?: string;
}

export function VoiceCreate({ onNavigate, className }: VoiceCreateProps) {
  const router = useRouter();
  const [routing, setRouting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  /** Kept on an uncertain result so their words aren't lost when they pick manually. */
  const [transcript, setTranscript] = useState<string | null>(null);

  const handleTranscript = useCallback(
    async (text: string) => {
      setMessage(null);
      setTranscript(null);
      setRouting(true);
      try {
        const res = await fetch(API_ROUTES.VOICE.INTENT, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ transcript: text }),
        });
        const data = await unwrapApiResponse<{
          intent: { entityType: EntityType; description: string } | null;
        }>(res, 'Could not work out what you meant.');

        const intent = data?.intent ?? null;
        if (!intent || !ENTITY_REGISTRY[intent.entityType]) {
          // Heard, but not understood. Show what we heard so the words aren't
          // wasted — they can pick a type below and the text is already there.
          setTranscript(text);
          setMessage('Not sure what to make of that — pick one below and it will be filled in.');
          return;
        }

        const path = ENTITY_REGISTRY[intent.entityType].createPath;
        onNavigate?.();
        // autofill=1: they spoke, so run the fill on arrival rather than parking
        // their own words next to a button.
        router.push(`${path}?description=${encodeURIComponent(intent.description)}&autofill=1`);
      } catch (error) {
        logger.warn('[VoiceCreate] routing failed', { error });
        setTranscript(text);
        setMessage('Could not work that out just now — pick one below instead.');
      } finally {
        setRouting(false);
      }
    },
    [router, onNavigate]
  );

  const { supported, isRecording, isTranscribing, toggle } = useDictation({
    endpoint: API_ROUTES.CAT.TRANSCRIBE,
    onTranscript: handleTranscript,
    onError: (error, { detail }) => setMessage(dictationErrorMessage(error, detail)),
  });

  // One flag governs every voice surface, so they can never disagree about
  // whether the product has voice. No mic on this device is the same outcome:
  // the entity menu below is the whole UI, unchanged.
  if (!FEATURES.voiceInput || !supported) {
    return null;
  }

  const busy = isTranscribing || routing;
  const label = isRecording
    ? 'Listening — tap to finish'
    : busy
      ? 'Working out what you meant…'
      : 'Say what you want to make';
  const sublabel = '“Sell my bike for 200 francs”';

  return (
    <div className={cn('space-y-2', className)}>
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-label={label}
        aria-pressed={isRecording}
        className={cn(
          'group flex w-full touch-manipulation items-center gap-3 rounded-md px-3 py-2.5 text-left transition-colors',
          isRecording ? 'bg-status-negative-subtle' : 'hover:bg-surface-raised',
          busy && 'opacity-70'
        )}
      >
        <span className="oc-icon-tile h-9 w-9">
          {busy ? (
            <Loader2 className="h-4 w-4 animate-spin text-fg-secondary" />
          ) : isRecording ? (
            <Square className="h-3.5 w-3.5 fill-current text-status-negative" />
          ) : (
            <Mic className="h-4 w-4 text-accent-primary" />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="block font-medium text-fg-primary">{label}</span>
          <span className="block truncate text-xs text-fg-secondary">
            {isRecording || busy ? 'Speak naturally — we work out the rest' : sublabel}
          </span>
        </span>
      </button>

      {message && (
        <p className="flex items-start gap-2 px-1 text-xs text-fg-secondary">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-status-warning" />
          <span>
            {message}
            {transcript && (
              <span className="mt-1 block italic text-fg-tertiary">“{transcript}”</span>
            )}
          </span>
        </p>
      )}
    </div>
  );
}

export default VoiceCreate;
