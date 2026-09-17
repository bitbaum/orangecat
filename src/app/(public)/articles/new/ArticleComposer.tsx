'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TIMELINE_SURFACE } from '@/config/timeline';
import { ARTICLE_COPY, estimateReadingTime } from '@/config/articles';
import { ROUTES } from '@/config/routes';
import { publishArticle } from '@/services/articles/create';
import { updateArticle } from '@/services/articles/update';
import type { TimelineVisibility } from '@/types/timeline';
import type { ArticleDraft } from '@/services/cat/writing-types';
import { deleteLocalDraft, type LocalArticleDraft } from '@/services/articles/local-drafts';
import { useMarkdownTextarea } from '@/components/articles/useMarkdownTextarea';
import AiWriterPanel from '@/components/articles/AiWriterPanel';
import type { StockImage } from '@/services/images/types';
import { useLocalArticleDrafts } from './useLocalArticleDrafts';
import DraftsPanel from './DraftsPanel';
import ArticlePreview from './ArticlePreview';
import ComposerEditor from './ComposerEditor';
import PublishBar from './PublishBar';
import { formatNumber } from '@/utils/locale';

/** Existing article passed when the composer is opened in edit mode. */
export interface ArticleInitial {
  id: string;
  slug: string;
  title: string;
  excerpt: string;
  coverImage?: string;
  body: string;
  visibility: TimelineVisibility;
}

export default function ArticleComposer({
  user,
  initial,
}: {
  user: { id: string };
  initial?: ArticleInitial;
}) {
  const router = useRouter();
  const isEditing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? '');
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [body, setBody] = useState(initial?.body ?? '');
  const [visibility, setVisibility] = useState<TimelineVisibility>(initial?.visibility ?? 'public');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which target the AI image picker is open for (null = closed).
  const [imagePicker, setImagePicker] = useState<null | 'cover' | 'inline'>(null);

  const drafts = useLocalArticleDrafts(
    isEditing,
    { title, excerpt, coverImage, body, visibility },
    { setTitle, setExcerpt, setCoverImage, setBody, setVisibility }
  );

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const md = useMarkdownTextarea(bodyRef, body, setBody);

  // Grow the body textarea with its content so the page scrolls, never an inner
  // box — long-form writing shouldn't happen inside a fixed scroll trap.
  //
  // Coalesced into an animation frame, and this is not a micro-optimisation.
  // Writing `height = 'auto'` invalidates layout and reading `scrollHeight`
  // immediately forces it to be recomputed — a forced synchronous reflow, twice,
  // on EVERY keystroke, over an element whose height is the whole document by
  // construction (`overflow-hidden` + auto-grow). Cost therefore scales with
  // article length: imperceptible at 200 words, and at ~1,400 words it made the
  // tab unresponsive for tens of seconds at a time while writing.
  //
  // One frame collapses a burst of typing into a single measurement, and
  // skipping an unchanged write avoids invalidating layout for no reason —
  // assigning the same px value still dirties it.
  useEffect(() => {
    const el = bodyRef.current;
    if (!el) {
      return;
    }
    const frame = requestAnimationFrame(() => {
      el.style.height = 'auto';
      const next = `${el.scrollHeight}px`;
      if (el.style.height !== next) {
        el.style.height = next;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [body, tab]);

  const wordCount = body.trim() ? body.trim().split(/\s+/).length : 0;
  const readingTime = wordCount ? estimateReadingTime(body) : 0;
  const canPublish = title.trim().length > 0 && body.trim().length > 0 && !publishing;

  function applyDraft(draft: ArticleDraft) {
    setTitle(draft.title);
    if (draft.excerpt) {
      setExcerpt(draft.excerpt);
    }
    setBody(draft.body);
    setTab('write');
    drafts.setRestored(false);
  }

  function handlePickImage(img: StockImage) {
    if (imagePicker === 'cover') {
      setCoverImage(img.fullUrl);
    } else if (imagePicker === 'inline') {
      md.insertAtCursor(`\n\n![${img.title}](${img.fullUrl})\n\n`);
      setTab('write');
    }
    setImagePicker(null);
  }

  function loadDraft(draft: LocalArticleDraft) {
    drafts.loadDraft(draft);
    setTab('write');
  }

  function handleBodyKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey)) {
      return;
    }
    const k = e.key.toLowerCase();
    if (k === 'b') {
      e.preventDefault();
      md.wrap('**', '**', 'bold');
    } else if (k === 'i') {
      e.preventDefault();
      md.wrap('*', '*', 'italic');
    } else if (k === 'k') {
      e.preventDefault();
      md.insertLink();
    } else if (k === 's') {
      // Flush the draft now instead of letting the browser offer to save the page.
      e.preventDefault();
      drafts.flushDraftNow();
    }
  }

  async function handlePublish() {
    if (!canPublish) {
      return;
    }
    setPublishing(true);
    setError(null);
    const payload = {
      title,
      body,
      excerpt: excerpt || undefined,
      coverImage: coverImage || undefined,
      visibility,
    };

    if (initial) {
      const result = await updateArticle({ id: initial.id, slug: initial.slug }, payload);
      if (!result.success) {
        setError(result.error);
        setPublishing(false);
        return;
      }
      router.push(ROUTES.ARTICLE(initial.slug));
      router.refresh();
      return;
    }

    const result = await publishArticle(user, payload);
    if (!result.success) {
      setError(result.error);
      setPublishing(false);
      return;
    }
    deleteLocalDraft(drafts.draftId);
    router.push(ROUTES.ARTICLE(result.slug));
  }

  return (
    <div className="min-h-screen bg-surface-page pt-20 pb-24 text-fg-primary">
      <div className="mx-auto w-full max-w-[720px] px-5">
        <Link
          href={isEditing ? ROUTES.ARTICLE(initial!.slug) : ROUTES.ARTICLES}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {isEditing ? 'Back to article' : ARTICLE_COPY.reader.back}
        </Link>

        <header className="mb-5">
          <h1 className="text-2xl font-semibold tracking-display text-fg-primary">
            {isEditing ? ARTICLE_COPY.edit.heading : ARTICLE_COPY.new.heading}
          </h1>
          <p className="mt-1.5 text-sm text-fg-secondary">
            {isEditing ? ARTICLE_COPY.edit.subheading : ARTICLE_COPY.new.subheading}
          </p>
        </header>

        {!isEditing && (
          <div className="mb-5">
            <AiWriterPanel title={title} onApplyDraft={applyDraft} disabled={publishing} />
          </div>
        )}

        <DraftsPanel
          restored={drafts.restored}
          otherDrafts={drafts.otherDrafts}
          onDiscard={drafts.discardCurrentDraft}
          onLoad={loadDraft}
          onDelete={drafts.deleteOtherDraft}
        />

        {/* Write / Preview tabs */}
        <div className="mb-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('write')}
            className={cn(TIMELINE_SURFACE.chip, tab === 'write' && TIMELINE_SURFACE.chipActive)}
          >
            <PenLine className="h-4 w-4" /> Write
          </button>
          <button
            type="button"
            onClick={() => setTab('preview')}
            className={cn(TIMELINE_SURFACE.chip, tab === 'preview' && TIMELINE_SURFACE.chipActive)}
          >
            <Eye className="h-4 w-4" /> Preview
          </button>
          {wordCount > 0 && (
            <span className="ml-auto text-xs text-fg-tertiary">
              {formatNumber(wordCount)} {wordCount === 1 ? 'word' : 'words'} · {readingTime} min
              read
            </span>
          )}
        </div>

        {tab === 'write' ? (
          <ComposerEditor
            title={title}
            setTitle={setTitle}
            excerpt={excerpt}
            setExcerpt={setExcerpt}
            coverImage={coverImage}
            setCoverImage={setCoverImage}
            body={body}
            setBody={setBody}
            publishing={publishing}
            userId={user.id}
            md={md}
            bodyRef={bodyRef}
            imagePicker={imagePicker}
            setImagePicker={setImagePicker}
            onPickImage={handlePickImage}
            onBodyKeyDown={handleBodyKeyDown}
          />
        ) : (
          <ArticlePreview title={title} excerpt={excerpt} coverImage={coverImage} body={body} />
        )}

        {error && (
          <p className="mt-4 rounded-md border border-status-negative/25 bg-status-negative/10 px-3 py-2 text-sm text-status-negative">
            {error}
          </p>
        )}

        <PublishBar
          visibility={visibility}
          setVisibility={setVisibility}
          publishing={publishing}
          canPublish={canPublish}
          isEditing={isEditing}
          onPublish={handlePublish}
        />
      </div>
    </div>
  );
}
