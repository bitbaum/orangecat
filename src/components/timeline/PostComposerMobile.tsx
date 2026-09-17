'use client';

import React, { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/hooks/useAuth';
import BottomSheet from '@/components/ui/BottomSheet';
import AvatarLink from '@/components/ui/AvatarLink';
import { Globe, ChevronDown, ImageIcon } from 'lucide-react';
import { usePostComposer, type PostComposerOptions } from '@/hooks/usePostComposerNew';
import { useContentEditableEditor } from '@/hooks/useContentEditableEditor';
import { cn } from '@/lib/utils';
import { sanitizeHtml } from '@/lib/validation';
import { TextFormatToolbar, ComposerMessages, CharacterCounter } from './ComposerShared';
import { PostComposerFullScreenHeader } from './PostComposerFullScreenHeader';
import { PostComposerInlineControls } from './PostComposerInlineControls';
import MentionSuggestions from '@/components/mentions/MentionSuggestions';
import { useContentEditableMentions } from '@/components/mentions/useContentEditableMentions';
import {
  getTimelineVisibilityOption,
  TIMELINE_CONTENT_LIMITS,
  TIMELINE_COPY,
  TIMELINE_SURFACE,
} from '@/config/timeline';

const LazyProjectSelectionModal = dynamic(() => import('./ProjectSelectionModal'), {
  ssr: false,
  loading: () => null,
});

export interface PostComposerMobileProps extends PostComposerOptions {
  placeholder?: string;
  buttonText?: string;
  showVisibilityToggle?: boolean;
  showProjectSelection?: boolean;
  autoFocus?: boolean;
  onCancel?: () => void;
  compact?: boolean;
  fullScreen?: boolean;
  isOpen?: boolean;
  onClose?: () => void;
}

const PostComposerMobile: React.FC<PostComposerMobileProps> = ({
  placeholder = TIMELINE_COPY.composePlaceholder,
  buttonText = TIMELINE_COPY.postButton,
  showVisibilityToggle = true,
  showProjectSelection = false,
  autoFocus = false,
  onCancel,
  compact = false,
  fullScreen = false,
  isOpen,
  onClose,
  ...composerOptions
}) => {
  const { user, profile } = useAuth();
  const composer = usePostComposer({
    ...composerOptions,
    allowProjectSelection: showProjectSelection,
    onSuccess: () => {
      composerOptions.onSuccess?.();
      if (fullScreen && onClose) {
        onClose();
      }
    },
  });

  const [isOptionsSheetOpen, setIsOptionsSheetOpen] = useState(false);

  const { editorRef, handleInput, handlePaste, handleKeyDown, handleFormat } =
    useContentEditableEditor({
      content: composer.content,
      onContentChange: composer.setContent,
      onSubmit: composer.handlePost,
      onCancel: onCancel || (fullScreen ? onClose : undefined),
      maxHeight: fullScreen ? 480 : 320,
      disabled: composer.isPosting,
      sanitizer: sanitizeHtml,
    });

  const { editorProps, menuProps } = useContentEditableMentions({
    editorRef,
    onInput: handleInput,
    onKeyDown: handleKeyDown,
    disabled: composer.isPosting,
    idPrefix: 'mobile-mention',
  });

  useEffect(() => {
    if ((autoFocus || fullScreen || isOpen) && editorRef.current && !compact) {
      setTimeout(() => editorRef.current?.focus(), 100);
    }
  }, [autoFocus, compact, fullScreen, isOpen, editorRef]);

  const renderComposerContent = () => (
    <>
      {fullScreen && (
        <PostComposerFullScreenHeader
          buttonText={buttonText}
          isPosting={composer.isPosting}
          canPost={composer.canPost}
          onClose={onClose}
          onCancel={onCancel}
          onPost={composer.handlePost}
        />
      )}

      <div className={cn('flex gap-3', fullScreen ? 'px-4 pt-4' : '')}>
        <div className={cn('flex-shrink-0', fullScreen ? 'pt-1' : '')}>
          {fullScreen ? (
            <AvatarLink
              username={profile?.username || null}
              userId={user?.id || null}
              avatarUrl={profile?.avatar_url || null}
              name={profile?.name || profile?.username || 'User'}
              size={44}
            />
          ) : (
            !compact && (
              <AvatarLink
                username={profile?.username || null}
                userId={user?.id || null}
                avatarUrl={profile?.avatar_url || null}
                name={profile?.name || profile?.username || 'User'}
                size={40}
              />
            )
          )}
        </div>

        <div className="flex-1 min-w-0">
          {fullScreen && showProjectSelection && (
            <button
              onClick={() => setIsOptionsSheetOpen(true)}
              className={cn(TIMELINE_SURFACE.chip, 'mb-3 min-h-8')}
            >
              {composer.selectedProjects.length > 0
                ? `${composer.selectedProjects.length} project${composer.selectedProjects.length > 1 ? 's' : ''}`
                : TIMELINE_COPY.crossPostLabel}
              <ChevronDown className="w-4 h-4" />
            </button>
          )}

          {!compact && !fullScreen && (
            <div className="flex items-center gap-3 mb-4">
              <div className="flex-1 min-w-0">
                {/* Profile only — never the OAuth name, and never the email.
                    This rendered the email local-part as a display name, which
                    on the mobile composer put an address the user never chose
                    to show at the top of every post they were about to write. */}
                <div className="text-sm font-medium text-fg-primary">
                  {profile?.name || profile?.username || 'You'}
                </div>
                {showVisibilityToggle && (
                  <button
                    onClick={() => setIsOptionsSheetOpen(true)}
                    className={cn(TIMELINE_SURFACE.chip, 'mt-1 min-h-9')}
                    aria-expanded={isOptionsSheetOpen}
                    aria-controls="post-options-sheet"
                  >
                    <Globe className="w-3 h-3" />
                    {getTimelineVisibilityOption(composer.visibility).compactLabel}
                    <ChevronDown className="w-3 h-3 transition-transform" />
                  </button>
                )}
              </div>
            </div>
          )}

          <div className="relative">
            <MentionSuggestions {...menuProps} />
            <div
              ref={editorRef}
              contentEditable
              onPaste={handlePaste}
              {...editorProps}
              data-placeholder={fullScreen ? TIMELINE_COPY.composePlaceholder : placeholder}
              className={cn(
                'w-full border-0 bg-transparent',
                'focus:outline-none focus:ring-0',
                'leading-relaxed break-words',
                'max-h-[60vh] overflow-y-auto',
                'empty:before:content-[attr(data-placeholder)]',
                'empty:before:text-fg-secondary dark:empty:before:text-fg-secondary',
                'empty:before:pointer-events-none',
                fullScreen
                  ? 'text-xl min-h-[120px]'
                  : compact
                    ? 'text-sm min-h-10'
                    : 'text-base min-h-[60px]',
                composer.isPosting && 'opacity-50 cursor-not-allowed'
              )}
              suppressContentEditableWarning
              aria-label="Write your post"
              aria-describedby="character-count"
            />
            <CharacterCounter
              count={composer.characterCount}
              max={composerOptions.maxLength || TIMELINE_CONTENT_LIMITS.post}
              className="mt-4"
            />
          </div>
        </div>
      </div>

      {isOptionsSheetOpen && showProjectSelection && (
        <LazyProjectSelectionModal
          isOpen={isOptionsSheetOpen}
          onClose={() => setIsOptionsSheetOpen(false)}
          projects={composer.userProjects}
          selectedProjects={composer.selectedProjects}
          onToggleProject={composer.toggleProjectSelection}
          loading={composer.loadingProjects}
        />
      )}

      <ComposerMessages
        error={composer.error}
        success={composer.postSuccess}
        onClearError={composer.clearError}
        onRetry={composer.retry}
        retryCount={composer.retryCount}
      />

      {fullScreen && (
        <div className="flex items-center gap-4 px-4 pt-4 border-t border-default mt-4">
          <button
            className="flex min-h-11 min-w-11 cursor-not-allowed items-center justify-center rounded-md p-2 text-fg-tertiary transition-colors"
            aria-label={TIMELINE_COPY.addImageUnavailable}
            title={TIMELINE_COPY.addImageUnavailable}
            disabled
          >
            <ImageIcon className="w-5 h-5" />
          </button>
          <TextFormatToolbar onFormat={handleFormat} variant="default" size="md" />
        </div>
      )}

      {!fullScreen && (
        <PostComposerInlineControls
          buttonText={buttonText}
          isPosting={composer.isPosting}
          canPost={composer.canPost}
          compact={compact}
          loadingProjects={composer.loadingProjects}
          selectedProjectCount={composer.selectedProjects.length}
          showOptionsButton={showProjectSelection || showVisibilityToggle}
          onPost={composer.handlePost}
          onCancel={onCancel}
          onShowOptions={() => setIsOptionsSheetOpen(true)}
        />
      )}
    </>
  );

  if (fullScreen) {
    return (
      <BottomSheet
        isOpen={isOpen !== undefined ? isOpen : true}
        onClose={onClose || onCancel || (() => {})}
        maxHeight="100dvh"
        showCloseButton={false}
        closeOnOverlayClick={true}
      >
        {renderComposerContent()}
      </BottomSheet>
    );
  }

  return (
    <div className={cn('border-b border-subtle bg-surface-page p-4', compact && 'p-3')}>
      {renderComposerContent()}
    </div>
  );
};

export default PostComposerMobile;
