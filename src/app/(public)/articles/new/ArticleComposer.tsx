'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Eye, PenLine } from 'lucide-react';
import { cn } from '@/lib/utils';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { ARTICLE_COPY, estimateReadingTime } from '@/config/articles';
import { ROUTES } from '@/config/routes';
import { publishArticle } from '@/services/articles/create';
import { updateArticle } from '@/services/articles/update';
import type { TimelineVisibility } from '@/types/timeline';
import { type LocalArticleDraft } from '@/services/articles/local-drafts';
import { handleArticleKeyDown } from '@/components/articles/article-keyboard-shortcuts';
import { useMarkdownTextarea } from '@/components/articles/useMarkdownTextarea';
import type { StockImage } from '@/services/images/types';
import { useLocalArticleDrafts } from './useLocalArticleDrafts';
import DraftsPanel from './DraftsPanel';
import ArticlePreview from './ArticlePreview';
import ComposerEditor from './ComposerEditor';
import PublishBar from './PublishBar';
import ImportNotice, { type ArticlePrefill } from './ImportNotice';
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
  prefill,
}: {
  user: { id: string };
  initial?: ArticleInitial;
  prefill?: ArticlePrefill;
}) {
  const router = useRouter();
  const isEditing = !!initial;
  const [title, setTitle] = useState(initial?.title ?? prefill?.title ?? '');
  const [excerpt, setExcerpt] = useState(initial?.excerpt ?? prefill?.excerpt ?? '');
  const [coverImage, setCoverImage] = useState(initial?.coverImage ?? '');
  const [body, setBody] = useState(initial?.body ?? prefill?.body ?? '');
  const [visibility, setVisibility] = useState<TimelineVisibility>(initial?.visibility ?? 'public');
  const [tab, setTab] = useState<'write' | 'preview'>('write');
  const [publishing, setPublishing] = useState(false);
  const [aiBusy, setAiBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Which target the AI image picker is open for (null = closed).
  const [imagePicker, setImagePicker] = useState<null | 'cover' | 'inline'>(null);

  const drafts = useLocalArticleDrafts(
    user.id,
    isEditing,
    { title, excerpt, coverImage, body, visibility },
    { setTitle, setExcerpt, setCoverImage, setBody, setVisibility },
    { restoreLatest: !prefill }
  );

  const [prefillDraftId] = useState(drafts.draftId);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const md = useMarkdownTextarea(bodyRef, body, setBody);

  // Coalesce auto-growth into one frame. A synchronous reset/scrollHeight
  // read on every keystroke froze long articles. The document should scroll,
  // rather than trapping the writer inside a fixed-height textarea.
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
  const canPublish = title.trim().length > 0 && body.trim().length > 0 && !publishing && !aiBusy;

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
    if (drafts.loadDraft(draft)) {
      setTab('write');
      setImagePicker(null);
      return true;
    }
    return false;
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
    drafts.completeDraft();
    router.push(ROUTES.ARTICLE(result.slug));
  }

  return (
    <div className="min-h-screen bg-surface-page pt-8 pb-24 text-fg-primary [&_button]:min-h-11 [&_button]:min-w-11">
      <div className="mx-auto w-full max-w-[720px] px-5">
        <Link
          href={isEditing ? ROUTES.ARTICLE(initial!.slug) : ROUTES.ARTICLES}
          className="mb-6 inline-flex min-h-11 items-center gap-1.5 text-sm text-fg-secondary transition-colors hover:text-fg-primary"
        >
          <ArrowLeft className="h-4 w-4" />
          {isEditing ? 'Back to article' : ARTICLE_COPY.reader.back}
        </Link>

        <header className="mb-5">
          <div className="flex items-start justify-between gap-3">
            <h1 className="text-2xl font-semibold tracking-display text-fg-primary">
              {isEditing ? ARTICLE_COPY.edit.heading : ARTICLE_COPY.new.heading}
            </h1>
            {!isEditing && (
              <DraftsPanel
                onNew={() => {
                  const ok = drafts.startNewDraft();
                  if (ok) {
                    setTab('write');
                    setImagePicker(null);
                  }
                  return ok;
                }}
                hasOlderDrafts={drafts.hasOlderDrafts}
                onRecover={drafts.recoverOlderDrafts}
                restored={drafts.restored}
                otherDrafts={drafts.otherDrafts}
                onDiscard={() => {
                  const ok = drafts.discardCurrentDraft();
                  if (ok) {
                    setTab('write');
                    setImagePicker(null);
                  }
                  return ok;
                }}
                currentTitle={title}
                hasCurrentDraft={!!(title || body || excerpt || coverImage)}
                onLoad={loadDraft}
                onDelete={drafts.deleteOtherDraft}
              />
            )}
          </div>
          <p className="mt-1.5 text-sm text-fg-secondary">
            {isEditing ? ARTICLE_COPY.edit.subheading : ARTICLE_COPY.new.subheading}
          </p>
        </header>

        {prefill && !isEditing && drafts.draftId === prefillDraftId && (
          <ImportNotice host={prefill.host} />
        )}

        {/* Write / Preview tabs */}
        <div className="mb-3 flex items-center gap-2">
          <SegmentedControl<'write' | 'preview'>
            label="Article view"
            value={tab}
            onChange={setTab}
            className="shrink-0"
            items={[
              { value: 'write', label: 'Write', icon: PenLine },
              { value: 'preview', label: 'Preview', icon: Eye },
            ]}
          />
          {wordCount > 0 && (
            <span className="ml-auto text-right text-xs text-fg-tertiary">
              {formatNumber(wordCount)} {wordCount === 1 ? 'word' : 'words'} · {readingTime} min
              read
            </span>
          )}
        </div>

        <div hidden={tab !== 'write'}>
          <ComposerEditor
            draftKey={`${user.id}:${initial?.id ?? drafts.draftId}`}
            onApplied={() => setTab('write')}
            onBusyChange={setAiBusy}
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
            onBodyKeyDown={event => handleArticleKeyDown(event, md, drafts.flushDraftNow)}
          />
        </div>
        {tab === 'preview' && (
          <ArticlePreview title={title} excerpt={excerpt} coverImage={coverImage} body={body} />
        )}

        {error && (
          <p className="mt-4 rounded-md border border-status-negative/25 bg-status-negative/10 px-3 py-2 text-sm text-status-negative">
            {error}
          </p>
        )}

        {!isEditing && (
          <p
            role="status"
            className={cn(
              'mt-4 text-sm',
              drafts.saveStatus === 'error' ? 'text-status-negative' : 'text-fg-secondary'
            )}
          >
            {drafts.saveStatus === 'error'
              ? "Couldn't update drafts on this device. Keep this page open and copy your writing before leaving. Storage may be full; remove an unneeded saved draft and retry."
              : drafts.saveStatus === 'saved'
                ? 'Draft saved on this device.'
                : drafts.saveStatus === 'saving'
                  ? 'Saving draft…'
                  : 'Drafts are saved on this device as you write.'}
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
