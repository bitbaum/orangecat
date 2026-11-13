/**
 * Task Action Modals
 *
 * Modal UIs for task actions: Complete, Flag Attention, Request.
 * Form state is managed internally; actions are delegated via callbacks.
 *
 * Created: 2026-02-19
 */

'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog';
import Input from '@/components/ui/Input';
import { PeoplePicker } from '@/components/money/PeoplePicker';
import { usePeopleFinder } from '@/hooks/usePeopleFinder';
import type { FoundPerson } from '@/domain/people/rankPeople';

// ==================== Complete Modal ====================

interface CompleteModalProps {
  estimatedMinutes: number | null;
  actionLoading: boolean;
  onClose: () => void;
  onComplete: (notes: string, durationMinutes: number | '') => Promise<boolean>;
}

export function CompleteModal({
  estimatedMinutes,
  actionLoading,
  onClose,
  onComplete,
}: CompleteModalProps) {
  const [notes, setNotes] = useState('');
  const [duration, setDuration] = useState<number | ''>('');

  const handleSubmit = async () => {
    const success = await onComplete(notes, duration);
    if (success) {
      setNotes('');
      setDuration('');
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Complete Task</DialogTitle>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-fg-primary mb-1">
              Duration (minutes)
            </label>
            <input
              type="number"
              value={duration}
              onChange={e => setDuration(e.target.value ? parseInt(e.target.value) : '')}
              placeholder={estimatedMinutes?.toString() || ''}
              className="w-full rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-fg-primary mb-1">
              Notes (optional)
            </label>
            <textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              rows={3}
              placeholder="Notes about the completion..."
              className="w-full rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={actionLoading}>
              Mark as Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Attention Modal ====================

interface AttentionModalProps {
  actionLoading: boolean;
  onClose: () => void;
  onFlag: (message: string) => Promise<boolean>;
}

export function AttentionModal({ actionLoading, onClose, onFlag }: AttentionModalProps) {
  const [message, setMessage] = useState('');

  const handleSubmit = async () => {
    const success = await onFlag(message);
    if (success) {
      setMessage('');
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Flag Task</DialogTitle>
        <div className="space-y-4">
          <p className="text-base text-fg-secondary">
            Flag this task as &quot;needs attention&quot;. All team members will be notified.
          </p>
          <div>
            <label className="block text-sm font-medium text-fg-primary mb-1">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="What is the problem?"
              className="w-full rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button
              onClick={handleSubmit}
              isLoading={actionLoading}
              className="bg-status-warning hover:bg-status-warning/90 text-warning-foreground"
            >
              Flag
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// ==================== Request Modal ====================

interface RequestModalProps {
  actionLoading: boolean;
  onClose: () => void;
  onRequest: (userId: string, message: string) => Promise<boolean>;
}

/**
 * Ask one named person to do the task.
 *
 * It used to offer a single choice, "All Team Members (Broadcast)", which
 * notified every account on the platform. A request now goes to a person
 * picked from your circle or found by name.
 */
export function RequestModal({ actionLoading, onClose, onRequest }: RequestModalProps) {
  const [query, setQuery] = useState('');
  const [person, setPerson] = useState<FoundPerson | null>(null);
  const [message, setMessage] = useState('');
  const { people } = usePeopleFinder(query, person === null);

  const handleSubmit = async () => {
    if (!person) {
      return;
    }
    const success = await onRequest(person.id, message);
    if (success) {
      setPerson(null);
      setQuery('');
      setMessage('');
    }
  };

  return (
    <Dialog open onOpenChange={open => !open && onClose()}>
      <DialogContent className="max-w-md">
        <DialogTitle>Ask someone to do this</DialogTitle>
        <div className="space-y-4">
          {person ? (
            <div className="flex min-h-14 items-center justify-between gap-3 rounded-lg border border-subtle bg-surface-base px-3 py-2">
              <span className="min-w-0">
                <span className="block truncate font-medium text-fg-primary">
                  {person.name ?? `@${person.username}`}
                </span>
                {person.name && (
                  <span className="block truncate text-sm text-fg-secondary">
                    @{person.username}
                  </span>
                )}
              </span>
              <Button variant="ghost" size="sm" onClick={() => setPerson(null)}>
                Change
              </Button>
            </div>
          ) : (
            <div className="space-y-2">
              <Input
                label="Who should do it?"
                value={query}
                onChange={e => setQuery(e.target.value)}
                placeholder="Name or @handle"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
              />
              <PeoplePicker people={people} onPick={(_handle, found) => setPerson(found)} />
            </div>
          )}
          <div>
            <label
              htmlFor="task-request-message"
              className="mb-1 block text-sm font-medium text-fg-primary"
            >
              Message (optional)
            </label>
            <textarea
              id="task-request-message"
              value={message}
              onChange={e => setMessage(e.target.value)}
              rows={3}
              placeholder="Could you take care of this task?"
              className="w-full rounded-lg border border-strong bg-surface-base text-fg-primary px-3 py-2 focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button onClick={handleSubmit} isLoading={actionLoading} disabled={!person}>
              Send request
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
