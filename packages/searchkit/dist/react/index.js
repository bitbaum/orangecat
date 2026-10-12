/**
 * The React half: search as you type, and the marked text that says why a
 * result is there. Optional — the core has no React in it.
 */
import { createElement, Fragment, useEffect, useRef, useState } from 'react';
import { highlightQuery, highlightRanges } from "../highlight.js";
/**
 * Run `search` for the latest text only. Each keystroke aborts the request
 * before it (the signal is passed in), and a response that arrives after a
 * newer one was asked for is dropped — so a slow "ca" can never overwrite a
 * fast "cato".
 */
export function useSearchAsYouType(text, search, options = {}) {
    const { debounceMs = 100, minLength = 1, enabled = true } = options;
    const [state, setState] = useState({
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
                .catch((error) => {
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
/** Text with the matched parts in <mark>. Never renders the text as HTML. */
export function Highlight({ text, ranges, query = '', markClassName }) {
    const parts = ranges
        ? highlightRanges(text, ranges)
        : highlightQuery(text, query);
    return createElement(Fragment, null, ...parts.map((part, i) => part.match
        ? createElement('mark', { key: i, className: markClassName }, part.text)
        : part.text));
}
