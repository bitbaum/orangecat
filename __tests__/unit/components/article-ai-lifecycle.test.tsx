// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { StrictMode, useState } from 'react';
import { useArticleAi } from '@/components/articles/useArticleAi';
import {
  fetchArticleDraft,
  fetchWritingTopics,
  reviseArticleText,
  suggestArticleTitles,
} from '@/services/articles/ai-client';
vi.mock('@/services/articles/ai-client', () => ({
  fetchArticleDraft: vi.fn(),
  fetchWritingTopics: vi.fn(),
  reviseArticleText: vi.fn(),
  suggestArticleTitles: vi.fn(),
  generateArticleExcerpt: vi.fn(),
}));
const md = { getSelection: () => ({ start: 0, end: 4, text: 'Body' }) } as never;
function useWriter() {
  const [title, setTitle] = useState('Original title');
  const [body, setBody] = useState('Body text');
  const [excerpt, setExcerpt] = useState('Original summary');
  const ai = useArticleAi({ title, body, excerpt, md, setTitle, setBody, setExcerpt });
  return { ai, title, body, excerpt, setTitle, setBody };
}
function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>(r => {
    resolve = r;
  });
  return { promise, resolve };
}
const draft = { title: 'Generated title', body: 'Generated body', excerpt: 'Generated summary' };
afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});
it('applies a complete draft and restores the previous writing with Undo', async () => {
  vi.mocked(fetchArticleDraft).mockResolvedValue(draft);
  const { result } = renderHook(useWriter);
  await act(async () => result.current.ai.writeDraft('A topic'));
  expect(result.current).toMatchObject(draft);
  expect(result.current.ai.canUndo).toBe(true);
  act(() => result.current.ai.undoChange());
  expect(result.current).toMatchObject({
    title: 'Original title',
    body: 'Body text',
    excerpt: 'Original summary',
  });
});
it('can generate after Strict Mode replays the editor lifecycle', async () => {
  vi.mocked(fetchArticleDraft).mockResolvedValue(draft);
  const { result } = renderHook(useWriter, { wrapper: StrictMode });
  await act(async () => result.current.ai.writeDraft('A topic'));
  expect(result.current).toMatchObject(draft);
  expect(result.current.ai.busy).toBeNull();
  expect(result.current.ai.canUndo).toBe(true);
});
it('does not apply an answer over text edited while a request is running', async () => {
  const response = deferred<typeof draft>();
  vi.mocked(fetchArticleDraft).mockReturnValue(response.promise);
  const { result } = renderHook(useWriter);
  act(() => result.current.ai.writeDraft('A topic'));
  act(() => result.current.setBody('My newer words'));
  await act(async () => response.resolve(draft));
  expect(result.current.body).toBe('My newer words');
  expect(result.current.title).toBe('Original title');
  expect(result.current.ai.error).toMatch(/Your edits were kept/);
  expect(result.current.ai.canUndo).toBe(false);
});
it('invalidates a response even if the author changes text and then restores it', async () => {
  const response = deferred<typeof draft>();
  vi.mocked(fetchArticleDraft).mockReturnValue(response.promise);
  const { result } = renderHook(useWriter);
  act(() => result.current.ai.writeDraft('Topic'));
  act(() => result.current.setBody('Different'));
  act(() => result.current.setBody('Body text'));
  await act(async () => response.resolve(draft));
  expect(result.current.body).toBe('Body text');
  expect(result.current.ai.error).toMatch(/Your edits were kept/);
});
it('serializes generation and edits through the same request owner', async () => {
  const response = deferred<typeof draft>();
  vi.mocked(fetchArticleDraft).mockReturnValue(response.promise);
  const { result } = renderHook(useWriter);
  act(() => {
    result.current.ai.writeDraft('Topic');
    result.current.ai.transform('improve');
    result.current.ai.suggestTopics();
  });
  expect(fetchArticleDraft).toHaveBeenCalledTimes(1);
  expect(reviseArticleText).not.toHaveBeenCalled();
  expect(fetchWritingTopics).not.toHaveBeenCalled();
  await act(async () => response.resolve(draft));
});
it('aborts disposed draft requests and cannot write into a replacement draft', async () => {
  const response = deferred<typeof draft>();
  vi.mocked(fetchArticleDraft).mockReturnValue(response.promise);
  const first = renderHook(useWriter);
  act(() => first.result.current.ai.writeDraft('Topic'));
  const signal = vi.mocked(fetchArticleDraft).mock.calls[0][1]!;
  first.unmount();
  const replacement = renderHook(useWriter);
  expect(signal.aborted).toBe(true);
  await act(async () => response.resolve(draft));
  expect(replacement.result.current.body).toBe('Body text');
  expect(replacement.result.current.ai.canUndo).toBe(false);
});
it('cancelled answers cannot clear or overwrite a later request', async () => {
  const old = deferred<typeof draft>(),
    next = deferred<typeof draft>();
  vi.mocked(fetchArticleDraft).mockReturnValueOnce(old.promise).mockReturnValueOnce(next.promise);
  const { result } = renderHook(useWriter);
  act(() => result.current.ai.writeDraft('Old'));
  act(() => result.current.ai.cancel());
  act(() => result.current.ai.writeDraft('New'));
  await act(async () => old.resolve(draft));
  expect(result.current.ai.busy).toBe('draft');
  expect(result.current.body).toBe('Body text');
  await act(async () => next.resolve({ ...draft, body: 'New answer' }));
  expect(result.current.body).toBe('New answer');
});
it('does not undo manual edits made after an AI result', async () => {
  vi.mocked(fetchArticleDraft).mockResolvedValue(draft);
  const { result } = renderHook(useWriter);
  await act(async () => result.current.ai.writeDraft());
  act(() => result.current.setBody('My edits after generation'));
  act(() => result.current.ai.undoChange());
  expect(result.current.body).toBe('My edits after generation');
  expect(result.current.ai.canUndo).toBe(false);
});
it('does not apply stale title suggestions over a manually changed title', async () => {
  vi.mocked(suggestArticleTitles).mockResolvedValue(['Suggested title']);
  const { result } = renderHook(useWriter);
  await act(async () => result.current.ai.suggestTitles());
  act(() => result.current.setTitle('My new title'));
  act(() => result.current.ai.applyTitle('Suggested title'));
  expect(result.current.title).toBe('My new title');
  expect(result.current.ai.error).toMatch(/Your edits were kept/);
});
