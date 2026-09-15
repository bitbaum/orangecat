/**
 * Completion History
 *
 * Displays the list of task completions with completer info,
 * timestamps, durations, and notes.
 *
 * Created: 2026-02-19
 */

import { CheckCircle, History } from 'lucide-react';
import type { TaskCompletion } from '@/lib/schemas/tasks';
import { APP_LOCALE } from '@/utils/locale';

export interface CompletionWithUser extends TaskCompletion {
  completer?: {
    id: string;
    username: string;
    display_name: string | null;
    avatar_url: string | null;
  };
}

interface CompletionHistoryProps {
  completions: CompletionWithUser[];
}

export default function CompletionHistory({ completions }: CompletionHistoryProps) {
  return (
    <div className="bg-surface-base rounded-lg border border-default p-6">
      <h2 className="text-lg font-semibold text-fg-primary mb-4 flex items-center gap-2">
        <History className="h-5 w-5" />
        Completions ({completions.length})
      </h2>
      {completions.length === 0 ? (
        <p className="text-fg-secondary text-center py-4">No completions yet</p>
      ) : (
        <div className="space-y-3">
          {completions.map(completion => (
            <div
              key={completion.id}
              className="flex items-start gap-3 p-3 bg-surface-raised/50 rounded-lg"
            >
              <div className="h-8 w-8 rounded-full bg-status-positive-subtle flex items-center justify-center flex-shrink-0">
                <CheckCircle className="h-4 w-4 text-status-positive" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-sm">
                  <span className="font-medium text-fg-primary">
                    {completion.completer?.display_name ||
                      completion.completer?.username ||
                      'Unknown'}
                  </span>
                  <span className="text-fg-secondary">
                    {new Date(completion.completed_at).toLocaleDateString(APP_LOCALE, {
                      day: '2-digit',
                      month: '2-digit',
                      year: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </span>
                  {completion.duration_minutes && (
                    <span className="text-fg-secondary">• {completion.duration_minutes} min.</span>
                  )}
                </div>
                {completion.notes && (
                  <p className="text-sm text-fg-secondary mt-1">{completion.notes}</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
