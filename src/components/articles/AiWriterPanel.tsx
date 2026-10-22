'use client';

import { useState } from 'react';
import { Loader2, PenLine, Lightbulb, ArrowRight } from 'lucide-react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import { fetchArticleDraft, fetchWritingTopics } from '@/services/articles/ai-client';
import type { ArticleDraft, ProposedTopic } from '@/services/cat/writing-types';

/**
 * One-click AI writing for the article composer. Give it a topic (or leave it
 * blank and it grounds in what you care about): "Write a full draft" fills the
 * whole editor; "Suggest topics" proposes ideas from your own interests and
 * drafts the one you pick. Fails soft — errors and empty results surface inline,
 * never block.
 */
export default function AiWriterPanel({
  title,
  onApplyDraft,
  disabled,
}: {
  title: string;
  onApplyDraft: (draft: ArticleDraft) => void;
  disabled?: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const [busy, setBusy] = useState<null | 'draft' | 'topics' | string>(null);
  const [topics, setTopics] = useState<ProposedTopic[]>([]);
  const [noTopics, setNoTopics] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justApplied, setJustApplied] = useState(false);

  const anyBusy = busy !== null || disabled;
  // The prompt box is the primary steer; fall back to the title field.
  const steer = prompt.trim() || title.trim();

  async function writeDraft(topic?: string) {
    setBusy(topic ?? 'draft');
    setError(null);
    setNoTopics(false);
    setJustApplied(false);
    try {
      const draft = await fetchArticleDraft({ topic: topic || steer || undefined });
      onApplyDraft(draft);
      setTopics([]);
      setJustApplied(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not draft that. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  async function loadTopics() {
    setBusy('topics');
    setError(null);
    setNoTopics(false);
    setJustApplied(false);
    try {
      const found = await fetchWritingTopics({
        kind: 'article',
        count: 5,
        focus: prompt.trim() || undefined,
      });
      setTopics(found);
      setNoTopics(found.length === 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not suggest topics. Please try again.');
    } finally {
      setBusy(null);
    }
  }

  return (
    <div className="space-y-3 border-t border-default p-3">
      <p className="text-sm text-fg-secondary">
        Give Cat a topic, or leave it blank to use your writing context.
      </p>
      <Textarea
        label="Topic (optional)"
        value={prompt}
        onChange={e => {
          setPrompt(e.target.value);
          setJustApplied(false);
        }}
        disabled={anyBusy}
        placeholder="What would you like to write about?"
        rows={2}
        className="text-base"
      />
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button type="button" disabled={anyBusy} onClick={() => writeDraft()} variant="secondary">
          {busy === 'draft' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <PenLine className="mr-2 h-4 w-4" />
          )}
          {steer ? 'Write a full draft' : 'Write me a draft'}
        </Button>
        <Button type="button" disabled={anyBusy} onClick={loadTopics} variant="ghost">
          {busy === 'topics' ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Lightbulb className="mr-2 h-4 w-4" />
          )}
          Suggest topics
        </Button>
      </div>
      {justApplied && (
        <p role="status" className="text-sm text-status-positive">
          Draft added — check the editor below.
        </p>
      )}
      {topics.length > 0 && (
        <ul className="space-y-2">
          {topics.map((topic, index) => (
            <li key={index}>
              <Button
                type="button"
                variant="outline"
                disabled={anyBusy}
                onClick={() => writeDraft(topic.title)}
                className="h-auto w-full justify-between whitespace-normal py-3 text-left"
              >
                <span className="min-w-0 flex-1 break-words">
                  <span className="block font-medium">{topic.title}</span>
                  {topic.angle && (
                    <span className="block text-sm text-fg-secondary">{topic.angle}</span>
                  )}
                </span>
                {busy === topic.title ? (
                  <Loader2 className="ml-2 h-4 w-4 shrink-0 animate-spin" />
                ) : (
                  <ArrowRight className="ml-2 h-4 w-4 shrink-0" />
                )}
              </Button>
            </li>
          ))}
        </ul>
      )}
      {noTopics && (
        <p role="status" className="text-sm text-fg-secondary">
          No suggestions yet. Add a topic above and try again.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-status-negative">
          {error}
        </p>
      )}
    </div>
  );
}
