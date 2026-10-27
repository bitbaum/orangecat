/**
 * Under a turn that failed: what went wrong in the server's words, and the
 * links that FIX it. The Cat being unavailable is never a dead end — a free
 * key, credits, the local setup — deep-linked, not narrated. Retry is
 * chatkit's, on the failed turn itself; it is not offered twice.
 */

import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { CatStatusButton } from '@/components/ai-chat/CatStatusNote';
import type { CatTurnFailure } from '../hooks/useCatTransport';

/** Codes where adding a key or topping up credits genuinely fixes it. */
const FIXABLE_CODES = new Set([
  'DAILY_LIMIT',
  'AI_RATE_LIMITED',
  'ALL_PROVIDERS_DOWN',
  'NO_API_KEY',
  'STREAM_ERROR',
  'INSUFFICIENT_CREDITS',
]);

export function TurnFailure({ failure }: { failure: CatTurnFailure }) {
  const { message, code } = failure;
  const isLocalSetup = code === 'LOCAL_UNREACHABLE';
  // Errors from before codes existed still name the key in their words.
  const legacyKeyHint =
    message.includes('API key') ||
    message.includes('openrouter') ||
    message.includes('not configured');
  const showFix = !isLocalSetup && ((code ? FIXABLE_CODES.has(code) : false) || legacyKeyHint);

  return (
    <div className="mt-2 space-y-2" role="status">
      <p className="mb-0 text-sm text-status-negative">{message}</p>
      <div className="flex flex-wrap items-center gap-2">
        {isLocalSetup && (
          <Button href={ROUTES.SETTINGS_AI} variant="outline" size="sm" className="min-h-11">
            Local model setup
          </Button>
        )}
        {showFix && (
          <>
            <Button href={ROUTES.SETTINGS_AI} variant="primary" size="sm" className="min-h-11">
              Add a free key
            </Button>
            <Button href={ROUTES.SETTINGS_AI} variant="outline" size="sm" className="min-h-11">
              Top up Cat Credits
            </Button>
          </>
        )}
        <CatStatusButton />
      </div>
    </div>
  );
}
