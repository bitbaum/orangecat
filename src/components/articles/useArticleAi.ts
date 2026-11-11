'use client';

import { useId, useLayoutEffect, useRef, useState } from 'react';
import { WritingSession } from '@bitbaum/writingkit';
import {
  fetchArticleDraft,
  fetchWritingTopics,
  generateArticleExcerpt,
  reviseArticleText,
  suggestArticleTitles,
} from '@/services/articles/ai-client';
import type { ProposedTopic, ReviseAction, TonePreset } from '@/services/cat/writing-types';
import type { MarkdownActions, EditorSelection } from './useMarkdownTextarea';

type Fields = { title: string; body: string; excerpt: string };
export type AiBusy = ReviseAction | 'title' | 'excerpt' | 'draft' | 'topics';
interface Params extends Fields {
  md: MarkdownActions;
  setTitle: (value: string) => void;
  setBody: (value: string) => void;
  setExcerpt: (value: string) => void;
  onApplied?: () => void;
  onBusyChange?: (busy: boolean) => void;
}
const same = (a: Fields, b: Fields) =>
  a.title === b.title && a.body === b.body && a.excerpt === b.excerpt;
const CHANGED =
  'Your writing changed while Cat was working. Your edits were kept. Ask again with the current draft.';

/** One request owner per mounted draft. A changed revision can never receive an old answer. */
export function useArticleAi(params: Params) {
  const { title, body, excerpt, md, setTitle, setBody, setExcerpt, onApplied, onBusyChange } =
    params;
  const [busy, setBusy] = useState<AiBusy | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [topics, setTopics] = useState<ProposedTopic[]>([]);
  const [titleSuggestions, setTitleSuggestions] = useState<string[] | null>(null);
  const [undo, setUndo] = useState<{ before: Fields; after: Fields } | null>(null);
  const current = useRef({ title, body, excerpt });
  const revision = useRef(0);
  const ownerId = useId();
  const session = useRef<WritingSession | null>(null);
  const uiRequest = useRef(0);
  const selection = useRef<EditorSelection | null>(null);
  const titlesRevision = useRef(-1);
  useLayoutEffect(() => {
    const owner = new WritingSession({ documentId: ownerId, revision: revision.current });
    session.current = owner;
    return () => {
      owner.dispose();
      if (session.current === owner) {
        session.current = null;
      }
      onBusyChange?.(false);
    };
  }, [ownerId, onBusyChange]);
  useLayoutEffect(() => {
    const next = { title, body, excerpt };
    if (!same(current.current, next)) {
      revision.current++;
    }
    current.current = next;
    session.current?.update({ documentId: ownerId, revision: revision.current });
  }, [ownerId, title, body, excerpt]);

  function apply(patch: Partial<Fields>) {
    const before = current.current;
    const after = { ...before, ...patch };
    setUndo({ before, after });
    setTitle(after.title);
    setBody(after.body);
    setExcerpt(after.excerpt);
    setTopics([]);
    setTitleSuggestions(null);
    onApplied?.();
  }

  async function request<T>(
    kind: AiBusy,
    work: (signal: AbortSignal) => Promise<T>,
    accept: (result: T) => void
  ) {
    const owner = session.current;
    if (!owner || owner.busy) {
      return;
    }
    const id = ++uiRequest.current;
    setError(null);
    setBusy(kind);
    onBusyChange?.(true);
    const outcome = await owner.run(
      ({ signal }) => work(signal),
      value => {
        accept(value);
      }
    );
    // The package owns data safety. This token scopes UI notices to the
    // latest button action, including cancellation followed by another action.
    if (session.current !== owner || id !== uiRequest.current) {
      return;
    }
    if (outcome.status === 'stale') {
      setError(CHANGED);
    } else if (outcome.status === 'failed') {
      setError(
        outcome.error instanceof Error
          ? outcome.error.message
          : 'Cat could not finish. Your writing is unchanged.'
      );
    }
    setBusy(null);
    onBusyChange?.(false);
  }
  function cancel() {
    uiRequest.current++;
    session.current?.cancel();
    setBusy(null);
    setError(null);
    onBusyChange?.(false);
  }

  function transform(action: Exclude<ReviseAction, 'continue' | 'outline'>, tone?: TonePreset) {
    const sel = selection.current;
    const selected = !!sel?.text.trim();
    const text = selected ? sel!.text : body;
    if (!text.trim()) {
      setError('Write or select some text first.');
      return;
    }
    void request(
      action,
      signal => reviseArticleText({ action, text, tone, title }, signal),
      result =>
        apply({
          body: selected ? body.slice(0, sel!.start) + result + body.slice(sel!.end) : result,
        })
    );
  }
  function continueWriting() {
    if (!body.trim()) {
      setError('Write a little first, then let Cat continue.');
      return;
    }
    const at = selection.current?.end ?? body.length;
    void request(
      'continue',
      signal => reviseArticleText({ action: 'continue', text: body.slice(-6000), title }, signal),
      result => apply({ body: body.slice(0, at) + '\n\n' + result + body.slice(at) })
    );
  }
  function outline() {
    const topic = title.trim() || selection.current?.text.trim() || body.trim().slice(0, 200);
    if (!topic) {
      setError('Add a title or topic first.');
      return;
    }
    const at = selection.current?.end ?? body.length;
    void request(
      'outline',
      signal => reviseArticleText({ action: 'outline', topic, title }, signal),
      result =>
        apply({ body: body ? body.slice(0, at) + '\n\n' + result + body.slice(at) : result })
    );
  }
  function suggestTitles() {
    if (!body.trim()) {
      setError('Write the article first, then ask for a title.');
      return;
    }
    void request(
      'title',
      signal => suggestArticleTitles(body, signal),
      list => {
        titlesRevision.current = revision.current;
        setTitleSuggestions(list);
        if (!list.length) {
          setError('Cat returned no titles. Try again.');
        }
      }
    );
  }
  function applyTitle(value: string) {
    if (titlesRevision.current !== revision.current) {
      setTitleSuggestions(null);
      setError(CHANGED);
      return;
    }
    apply({ title: value });
  }
  function makeExcerpt() {
    if (!body.trim()) {
      setError('Write the article first, then ask for a summary.');
      return;
    }
    void request(
      'excerpt',
      signal => generateArticleExcerpt(body, title, signal),
      result => apply({ excerpt: result })
    );
  }
  function writeDraft(topic?: string) {
    void request(
      'draft',
      signal => fetchArticleDraft({ topic: topic?.trim() || title.trim() || undefined }, signal),
      draft => apply({ title: draft.title, body: draft.body, excerpt: draft.excerpt ?? '' })
    );
  }
  function suggestTopics(focus?: string) {
    void request(
      'topics',
      signal => fetchWritingTopics({ kind: 'article', count: 5, focus }, signal),
      found => {
        setTopics(found);
        if (!found.length) {
          setError('Cat returned no topics. Try a more specific topic.');
        }
      }
    );
  }
  const canUndo = !!undo && same({ title, body, excerpt }, undo.after) && !busy;
  function undoChange() {
    if (!canUndo || !undo) {
      return;
    }
    setTitle(undo.before.title);
    setBody(undo.before.body);
    setExcerpt(undo.before.excerpt);
    setUndo(null);
  }
  return {
    busy,
    error,
    topics,
    titleSuggestions,
    canUndo,
    undoChange,
    cancel,
    writeDraft,
    suggestTopics,
    captureSelection: () => {
      selection.current = md.getSelection();
    },
    transform,
    continueWriting,
    outline,
    suggestTitles,
    applyTitle,
    makeExcerpt,
    dismissTitles: () => setTitleSuggestions(null),
  };
}
export type ArticleAi = ReturnType<typeof useArticleAi>;
