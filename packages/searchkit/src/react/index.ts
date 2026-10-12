/**
 * The React half: search as you type, and the marked text that says why a
 * result is there. Optional — the core has no React in it.
 */
import { createElement, Fragment, useEffect, useRef, useState, type ReactNode } from 'react';
import { highlightQuery, highlightRanges, type HighlightPart } from '../highlight.ts';
import type { Range } from '../engine.ts';

export interface SearchAsYouTypeOptions {
  /**
   * Pause after the last keystroke. 100 ms: under Nielsen's 0.1 s a response
   * still feels instant, and a burst of typing costs one request, not five.
   */
  debounceMs?: number;
  /** Below this many characters, do not search. Default 1. */
  minLength?: number;
  /** Search at all (e.g. only while a dialog is open). Default true. */
  enabled?: boolean;
}

export interface SearchAsYouTypeState<R> {
  results: R | null;
  /** A search for the current text is in flight. */
  loading: boolean;
  error: unknown;
}

/**
 * Run `search` for the latest text only. Each keystroke aborts the request
 * before it (the signal is passed in), and a response that arrives after a
 * newer one was asked for is dropped — so a slow "ca" can never overwrite a
 * fast "cato".
 */
export function useSearchAsYouType<R>(
  text: string,
  search: (text: string, signal: AbortSignal) => Promise<R>,
  options: SearchAsYouTypeOptions = {}
): SearchAsYouTypeState<R> {
  const { debounceMs = 100, minLength = 1, enabled = true } = options;
  const [state, setState] = useState<SearchAsYouTypeState<R>>({
    results: null,
    loading: false,
    error: null,
  });
  const searchRef = useRef(search);
  searchRef.current = search;

  useEffect(() => {
    const trimmed = text.trim();
    if (!enabled || trimmed.length < minLength) {
      setState({ results: null, loading: false, error: null });
      return;
    }
    const controller = new AbortController();
    setState(s => ({ ...s, loading: true }));
    const timer = setTimeout(() => {
      searchRef
        .current(trimmed, controller.signal)
        .then(results => {
          if (!controller.signal.aborted) {
            setState({ results, loading: false, error: null });
          }
        })
        .catch((error: unknown) => {
          if (!controller.signal.aborted) {
            setState({ results: null, loading: false, error });
          }
        });
    }, debounceMs);
    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [text, enabled, minLength, debounceMs]);

  return state;
}

export interface HighlightProps {
  text: string;
  /** Mark these ranges (from a hit) … */
  ranges?: readonly Range[];
  /** … or the words that start with what was typed. */
  query?: string;
  /** Class for each <mark>; unstyled by default so it takes your tokens. */
  markClassName?: string;
}

/** Text with the matched parts in <mark>. Never renders the text as HTML. */
export function Highlight({ text, ranges, query = '', markClassName }: HighlightProps): ReactNode {
  const parts: HighlightPart[] = ranges
    ? highlightRanges(text, ranges)
    : highlightQuery(text, query);
  return createElement(
    Fragment,
    null,
    ...parts.map((part, i) =>
      part.match
        ? createElement('mark', { key: i, className: markClassName }, part.text)
        : part.text
    )
  );
}
