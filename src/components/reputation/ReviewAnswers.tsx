import { Check, X } from 'lucide-react';
import { HEADLINE_QUESTION, questionLabel } from '@/config/reputation';

/**
 * A review's yes/no answers, headline question first. Shared by the deals page
 * and the public track record so an answer reads the same everywhere.
 */
export function ReviewAnswers({
  answers,
  body,
}: {
  answers: Record<string, boolean>;
  body: string | null;
}) {
  const ids = Object.keys(answers).sort((a, b) =>
    a === HEADLINE_QUESTION ? -1 : b === HEADLINE_QUESTION ? 1 : 0
  );
  return (
    <div className="space-y-2">
      <ul className="space-y-1">
        {ids.map(id => (
          <li key={id} className="flex items-start gap-2 text-sm text-fg-secondary">
            {answers[id] ? (
              <Check className="mt-0.5 h-4 w-4 shrink-0 text-status-positive" aria-hidden="true" />
            ) : (
              <X className="mt-0.5 h-4 w-4 shrink-0 text-status-negative" aria-hidden="true" />
            )}
            <span>
              {questionLabel(id)}{' '}
              <span className="font-medium text-fg-primary">{answers[id] ? 'Yes' : 'No'}</span>
            </span>
          </li>
        ))}
      </ul>
      {body && <p className="whitespace-pre-line text-sm text-fg-primary">{body}</p>}
    </div>
  );
}
