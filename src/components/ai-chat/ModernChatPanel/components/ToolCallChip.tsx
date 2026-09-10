/**
 * TOOL CALL CHIP
 *
 * Visible chip showing what tool Cat used to answer — search_platform,
 * prefill_entity_form, etc. Chronology: chip appears as the tool runs,
 * then settles into completed/no_results/failed state. Click to expand
 * any results so the user can navigate straight to the cited entities.
 *
 * Without this, Cat's tool work is silent and looks like magic — users
 * cannot tell what data informed any given answer.
 */

import { useState } from 'react';
import Link from 'next/link';
import { Search, Check, AlertCircle, Loader2, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ToolCallEvent } from '../types';

interface ToolLabel {
  running: string;
  completed: (n: number) => string;
  noResults: string;
  failed: string;
  /** The action now waits on the confirmation card below the thread. */
  pending?: string;
}

// Tool-aware labels. The chip is shared across tools, so a prefill that drafts 6
// fields must NOT read "Found 6 results" (search language) — and a prefill error
// must not say "Search failed".
const TOOL_LABELS: Record<string, ToolLabel> = {
  search_platform: {
    running: 'Searching',
    completed: n => `Found ${n} ${n === 1 ? 'result' : 'results'}`,
    noResults: 'No results',
    failed: 'Search failed',
  },
  prefill_entity_form: {
    running: 'Drafting',
    completed: n => (n > 0 ? `Drafted ${n} field${n === 1 ? '' : 's'}` : 'Draft ready'),
    noResults: 'Nothing to draft',
    failed: "Couldn't draft",
  },
  explore_topic: {
    running: 'Exploring',
    completed: n => `Found ${n} related ${n === 1 ? 'result' : 'results'}`,
    noResults: 'Nothing on this topic yet',
    failed: "Couldn't explore that topic",
  },
  query_my_data: {
    running: 'Reading your data',
    completed: () => 'Read your live data',
    noResults: 'Nothing on file',
    failed: "Couldn't read your data",
  },
};

const DEFAULT_LABEL: ToolLabel = {
  running: 'Working',
  completed: n => `Done (${n})`,
  noResults: 'Nothing found',
  failed: 'Action failed',
  pending: 'Needs your confirmation — see below',
};

interface ToolCallChipProps {
  event: ToolCallEvent;
}

export function ToolCallChip({ event }: ToolCallChipProps) {
  const [expanded, setExpanded] = useState(false);
  const label = TOOL_LABELS[event.name] ?? DEFAULT_LABEL;

  const query = event.status === 'running' ? (event.args?.query as string | undefined) : undefined;

  const completedResults =
    event.status === 'completed' && event.results.length > 0 ? event.results : null;
  const expandable = completedResults !== null;

  let icon: React.ReactNode;
  let badgeClass: string;
  let text: string;

  switch (event.status) {
    case 'running':
      icon = <Loader2 className="h-3 w-3 flex-shrink-0 animate-spin" />;
      badgeClass = 'border-subtle bg-surface-raised text-fg-secondary';
      text = query ? `${label.running} "${query}"…` : `${label.running}…`;
      break;
    case 'completed':
      icon = <Check className="h-3 w-3 flex-shrink-0" />;
      badgeClass = 'border-status-positive/20 bg-status-positive-subtle text-status-positive';
      text = label.completed(event.resultCount);
      break;
    case 'no_results':
      icon = <Search className="h-3 w-3 flex-shrink-0" />;
      badgeClass = 'border-subtle bg-surface-raised text-fg-secondary';
      text = query ? `No results for "${query}"` : label.noResults;
      break;
    case 'failed':
      icon = <AlertCircle className="h-3 w-3 flex-shrink-0" />;
      badgeClass = 'border-status-negative/20 bg-status-negative/10 text-status-negative';
      text = label.failed;
      break;
    case 'pending_confirmation':
      // Seen live 2026-09-10: this state was sent as 'failed', so the chat
      // read "Action failed" above a card that was waiting for one tap.
      icon = <Clock className="h-3 w-3 flex-shrink-0" />;
      badgeClass = 'border-status-warning/20 bg-status-warning/10 text-status-warning';
      text = label.pending ?? DEFAULT_LABEL.pending!;
      break;
  }

  return (
    <div className="space-y-1">
      <button
        type="button"
        onClick={() => expandable && setExpanded(v => !v)}
        disabled={!expandable}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-sm border px-2 py-1 text-xs',
          badgeClass,
          expandable ? 'cursor-pointer hover:opacity-80' : 'cursor-default'
        )}
      >
        {icon}
        <span>{text}</span>
        {expandable && (
          <span aria-hidden>
            {expanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </span>
        )}
      </button>

      {expanded && completedResults && (
        <ul className="ml-2 space-y-1 border-l border-subtle pl-3 text-xs">
          {completedResults.map(r => (
            <li key={r.url}>
              <Link href={r.url} className="text-fg-primary underline-offset-2 hover:underline">
                {r.title}
              </Link>
              <span className="ml-2 text-fg-tertiary">· {r.type}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
