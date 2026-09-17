'use client';

import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { Globe, Lock } from 'lucide-react';
import Button from '@/components/ui/Button';
import { usePostComposer } from '@/hooks/usePostComposerNew';
import { useContentEditableEditor } from '@/hooks/useContentEditableEditor';
import AvatarLink from '@/components/ui/AvatarLink';
import { cn } from '@/lib/utils';
import {
  TIMELINE_CONTENT_LIMITS,
  TIMELINE_COPY,
  TIMELINE_SURFACE,
  TIMELINE_VISIBILITY_OPTIONS,
  TIMELINE_AVATAR_SIZE,
} from '@/config/timeline';
import {
  TextFormatToolbar,
  ProjectSelectionPanel,
  ProjectToggleButton,
  ComposerMessages,
  CharacterCounter,
  OfflineIndicator,
  ContextIndicator,
} from './ComposerShared';
import PostAiButton from './PostAiButton';
import ReplyAiButton from './ReplyAiButton';
import PostAiEditMenu from './PostAiEditMenu';
import {
  ComposerImageAttachment,
  ComposerImageChip,
  useComposerImage,
} from './ComposerImageAttachment';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { useContentEditableMentions } from '@/components/mentions/useContentEditableMentions';

export interface TimelineComposerProps {
  targetOwnerId?: string;
  targetOwnerType?: 'profile' | 'project';
  targetOwnerName?: string;
  allowProjectSelection?: boolean;
  onPostCreated?: (event?: import('@/types/timeline').TimelineDisplayEvent) => void;
  onOptimisticUpdate?: (event: import('@/types/timeline').TimelineDisplayEvent) => void;
  onCancel?: () => void;
  placeholder?: string;
  buttonText?: string;
  showBanner?: boolean;
  parentEventId?: string;
  /** In reply mode: the post being answered, so AI can draft a grounded reply. */
  parentPostText?: string;
  parentAuthorName?: string;
  simpleMode?: boolean;
}

const TimelineComposer = React.memo(function TimelineComposer({
  targetOwnerId,
  targetOwnerType = 'profile',
  targetOwnerName,
  allowProjectSelection = false,
  onPostCreated,
  onOptimisticUpdate,
  onCancel,
  placeholder,
  buttonText = TIMELINE_COPY.postButton,
  showBanner = true,
  parentEventId,
  parentPostText,
  parentAuthorName,
  simpleMode = true,
}: TimelineComposerProps) {
  const { user, profile } = useAuth();
  const [showProjects, setShowProjects] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    setIsOnline(navigator.onLine);
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const postComposer = usePostComposer({
    subjectType: targetOwnerType,
    subjectId: targetOwnerId,
    allowProjectSelection,
    onSuccess: created => {
      // Hand the created post on. A caller that only needs "something was
      // posted" ignores it; the thread view needs the row itself, to know
      // whether it tagged the Cat and what the Cat's answer will hang from.
      onPostCreated?.(created);
      setShowProjects(false);
    },
    onOptimisticUpdate,
    parentEventId,
  });

  const postingToOwnTimeline = useMemo(
    () => !targetOwnerId || targetOwnerId === user?.id,
    [targetOwnerId, user?.id]
  );

  const targetName = useMemo(
    () => targetOwnerName || (postingToOwnTimeline ? 'your timeline' : 'this timeline'),
    [targetOwnerName, postingToOwnTimeline]
  );

  const defaultPlaceholder = postingToOwnTimeline
    ? TIMELINE_COPY.composePlaceholder
    : `Write on ${targetName}...`;

  const composerImage = useComposerImage({ userId: user?.id, setImage: postComposer.setImage });

  const { editorRef, handleInput, handlePaste, handleKeyDown, handleFormat } =
    useContentEditableEditor({
      content: postComposer.content,
      onContentChange: postComposer.setContent,
      onPasteFiles: composerImage.handlePasteFiles,
      onSubmit: () => {
        if (!postComposer.isPosting && postComposer.content.trim()) {
          postComposer.handlePost();
        }
      },
      onCancel,
      maxHeight: 480,
      disabled: postComposer.isPosting,
    });

  const { editorProps, menuProps } = useContentEditableMentions({
    editorRef,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    disabled: postComposer.isPosting,
    idPrefix: 'post-mention',
  });

  const handleToggleProject = useCallback(
    (id: string) => {
      postComposer.toggleProjectSelection(id);
    },
    [postComposer]
  );

  const handleCloseProjects = useCallback(() => {
    setShowProjects(false);
  }, []);

  const handleOpenProjects = useCallback(() => {
    setShowProjects(true);
  }, []);

  const isButtonDisabled = useMemo(
    () =>
      !postComposer.content.trim() ||
      postComposer.isPosting ||
      postComposer.content.length > TIMELINE_CONTENT_LIMITS.post,
    [postComposer.content, postComposer.isPosting]
  );

  /**
   * The composer's tools appear when you start composing.
   *
   * At rest it used to show six controls around an empty box — an AI drafter,
   * an image picker, a formatting toolbar, a project selector and three
   * visibility chips — which is more chrome than content and buries the first
   * post further down the feed. Every one of them is for a post you have not
   * written yet.
   *
   * Expanded means: focused, or there is something to act on (text, an image,
   * an open panel). It deliberately does NOT collapse the moment focus leaves
   * the editor — `onBlur` is checked against `relatedTarget` so moving focus
   * from the editor to a toolbar button keeps the toolbar mounted. Without
   * that check the button unmounts between mousedown and click and the press
   * silently does nothing, which is the standard way this pattern breaks.
   *
   * The submit button stays visible at all times, disabled until there is
   * something to post, so the primary action is never hidden behind a focus.
   */
  const [focused, setFocused] = useState(false);
  const toolsExpanded =
    focused ||
    Boolean(postComposer.content.trim()) ||
    Boolean(postComposer.image) ||
    showProjects ||
    composerImage.showPicker;

  return (
    <div
      className={cn('mx-auto max-w-2xl transition-colors', TIMELINE_SURFACE.composer)}
      onFocus={() => setFocused(true)}
      onBlur={event => {
        if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
          setFocused(false);
        }
      }}
    >
      <div className="flex gap-3">
        <div className="pt-0.5 sm:pt-1 flex-shrink-0">
          <AvatarLink
            username={profile?.username || null}
            userId={user?.id || null}
            avatarUrl={profile?.avatar_url || null}
            name={profile?.name || profile?.username || 'User'}
            /*
              The avatar sets the feed's text column, so this number must be
              the SAME one the posts below use — it was 44 here and 40 there,
              which started the composer's text 4px right of every post body.
              Shared constant now, so they cannot drift apart again.
            */
            size={TIMELINE_AVATAR_SIZE}
            className="flex-shrink-0"
            isCurrentUser={true}
          />
        </div>

        <div className="flex-1 min-w-0">
          {!postingToOwnTimeline && showBanner && <ContextIndicator targetName={targetName} />}

          <div className="relative">
            <MentionSuggestions {...menuProps} />
            <div
              ref={editorRef}
              contentEditable
              onPaste={handlePaste}
              {...editorProps}
              data-placeholder={placeholder || defaultPlaceholder}
              aria-label="Compose new post"
              className={cn(
                'w-full leading-6',
                simpleMode ? 'min-h-[3.25rem] text-base' : 'min-h-[6rem] text-base',
                'border-none bg-transparent p-0 focus:outline-none',
                'leading-relaxed break-words',
                'max-h-[60vh] overflow-y-auto',
                'empty:before:content-[attr(data-placeholder)]',
                'empty:before:text-fg-tertiary dark:empty:before:text-fg-secondary',
                'empty:before:pointer-events-none',
                postComposer.isPosting && 'opacity-50 cursor-not-allowed'
              )}
              suppressContentEditableWarning
            />
          </div>

          {showProjects && allowProjectSelection && (
            <ProjectSelectionPanel
              projects={postComposer.userProjects}
              selectedProjects={postComposer.selectedProjects}
              onToggle={handleToggleProject}
              onClose={handleCloseProjects}
              isPosting={postComposer.isPosting}
            />
          )}

          <ComposerImageAttachment
            image={postComposer.image}
            isPasting={composerImage.isPasting}
            showPicker={composerImage.showPicker}
            content={postComposer.content}
            disabled={postComposer.isPosting}
            onPick={composerImage.handlePick}
            onRemove={() => postComposer.setImage(null)}
            onClosePicker={composerImage.closePicker}
          />

          <ComposerMessages error={postComposer.error} success={postComposer.postSuccess} />

          <div className="mt-4 flex items-center justify-between border-t border-subtle pt-3">
            <div className="flex flex-wrap items-center gap-2">
              {toolsExpanded && !parentEventId && (
                <PostAiButton onDraft={postComposer.setContent} disabled={postComposer.isPosting} />
              )}
              {toolsExpanded && parentEventId && parentPostText && (
                <ReplyAiButton
                  parentText={parentPostText}
                  parentAuthor={parentAuthorName}
                  onDraft={postComposer.setContent}
                  disabled={postComposer.isPosting}
                />
              )}
              {toolsExpanded && postComposer.content.trim() && (
                <PostAiEditMenu
                  text={postComposer.content}
                  onRevised={postComposer.setContent}
                  disabled={postComposer.isPosting}
                />
              )}
              {toolsExpanded && (
                <ComposerImageChip
                  active={composerImage.showPicker || Boolean(postComposer.image)}
                  disabled={postComposer.isPosting}
                  onToggle={composerImage.togglePicker}
                />
              )}
              {toolsExpanded && !simpleMode && <TextFormatToolbar onFormat={handleFormat} />}

              {toolsExpanded &&
                !simpleMode &&
                allowProjectSelection &&
                postComposer.userProjects.length > 0 && (
                  <ProjectToggleButton
                    showProjects={showProjects}
                    selectedCount={postComposer.selectedProjects.length}
                    onToggle={showProjects ? handleCloseProjects : handleOpenProjects}
                  />
                )}

              {toolsExpanded &&
                (simpleMode ? (
                  <div className="flex items-center gap-2">
                    {TIMELINE_VISIBILITY_OPTIONS.map(preset => {
                      const Icon = preset.Icon;
                      const isActive = postComposer.visibility === preset.key;
                      return (
                        <button
                          key={preset.key}
                          type="button"
                          onClick={() => postComposer.setVisibility(preset.key)}
                          disabled={postComposer.isPosting}
                          className={cn(
                            TIMELINE_SURFACE.chip,
                            isActive && TIMELINE_SURFACE.chipActive
                          )}
                          title={preset.description}
                        >
                          <span className="inline-flex items-center gap-1">
                            <Icon className="w-4 h-4" />
                            {preset.label}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() =>
                      postComposer.setVisibility(
                        postComposer.visibility === 'public' ? 'private' : 'public'
                      )
                    }
                    disabled={postComposer.isPosting}
                    className={TIMELINE_SURFACE.iconButton}
                    title={
                      postComposer.visibility === 'public'
                        ? 'Public - Everyone can see'
                        : 'Private - Only you can see'
                    }
                    aria-label={`Post visibility: ${postComposer.visibility}`}
                  >
                    {postComposer.visibility === 'public' ? (
                      <Globe className="w-4 h-4" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                  </button>
                ))}
            </div>

            <div className="flex items-center gap-3">
              <OfflineIndicator isOnline={isOnline} />
              {!simpleMode && (
                <CharacterCounter
                  count={postComposer.content.length}
                  max={TIMELINE_CONTENT_LIMITS.post}
                />
              )}

              <Button
                onClick={postComposer.handlePost}
                disabled={isButtonDisabled}
                className={TIMELINE_SURFACE.buttonPrimary}
                size="sm"
              >
                {postComposer.isPosting ? TIMELINE_COPY.postingButton : buttonText}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
});

TimelineComposer.displayName = 'TimelineComposer';

export default TimelineComposer;
