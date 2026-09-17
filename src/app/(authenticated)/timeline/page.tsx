'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { BookOpen, Plus } from 'lucide-react';
import { useRequireAuth } from '@/hooks/useAuth';
import { useComposer } from '@/contexts/ComposerContext';
import Loading from '@/components/Loading';
import { TIMELINE_COPY } from '@/config/timeline';

const SocialTimeline = dynamic(() => import('@/components/timeline/SocialTimeline'), {
  ssr: false,
  loading: () => (
    <div className="h-[400px] rounded-md border border-subtle bg-surface-page animate-pulse" />
  ),
});

const PostComposerMobile = dynamic(() => import('@/components/timeline/PostComposerMobile'), {
  ssr: false,
  loading: () => (
    <div className="h-[320px] rounded-md border border-subtle bg-surface-page animate-pulse" />
  ),
});

/**
 * My Timeline Page - Personal Timeline
 *
 * Uses the unified SocialTimeline component with personal mode.
 * Identical interface to Community page but shows user's own posts.
 * Supports X-style full-screen composer via global context (instant) or ?compose=true query param (fallback).
 *
 * Built with best practices: DRY, maintainable, modular, high quality code
 */
function TimelineContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, isLoading, isAuthenticated } = useRequireAuth();
  const { isOpen: isGlobalComposerOpen, closeComposer } = useComposer();
  const [showComposer, setShowComposer] = useState(false);

  // Use global composer if available, otherwise fall back to query param
  const _isComposerOpen = isGlobalComposerOpen || showComposer;

  // Detect ?compose=true in URL and open X-style composer (fallback for direct navigation)
  useEffect(() => {
    const composeParam = searchParams?.get('compose');
    if (composeParam === 'true' && !isGlobalComposerOpen) {
      setShowComposer(true);
    } else if (composeParam !== 'true') {
      setShowComposer(false);
    }
  }, [searchParams, isGlobalComposerOpen]);

  // Close composer and remove query param
  const handleCloseComposer = () => {
    setShowComposer(false);
    closeComposer(); // Also close global composer
    const newParams = new URLSearchParams(searchParams?.toString() || '');
    newParams.delete('compose');
    const newUrl = newParams.toString() ? `/timeline?${newParams.toString()}` : '/timeline';
    router.replace(newUrl, { scroll: false });
  };

  // Handle post created - close composer and refresh timeline
  const handlePostCreated = () => {
    handleCloseComposer();
    // Timeline will auto-refresh via SocialTimeline's onPostCreated
  };

  // Show loading while auth is being checked
  if (isLoading) {
    return <Loading fullScreen contextual message="Loading timeline..." />;
  }

  // useRequireAuth will redirect if not authenticated
  if (!isAuthenticated) {
    return <Loading fullScreen contextual message="Redirecting to login..." />;
  }

  return (
    <>
      <SocialTimeline
        title="My Timeline"
        icon={BookOpen}
        mode="timeline"
        showShareButton={true}
        shareButtonText={TIMELINE_COPY.shareUpdateButton}
        shareButtonIcon={Plus}
        defaultSort="recent"
        showSortingControls={false}
        showInlineComposer={!showComposer}
        allowProjectSelection={true}
      />

      {/* X-style full-screen composer (mobile) - Only render if using query param fallback */}
      {user && showComposer && !isGlobalComposerOpen && (
        <PostComposerMobile
          fullScreen={true}
          isOpen={showComposer}
          onClose={handleCloseComposer}
          onSuccess={handlePostCreated}
          autoFocus={true}
          showProjectSelection={true}
          placeholder={TIMELINE_COPY.composePlaceholder}
          buttonText={TIMELINE_COPY.postButton}
        />
      )}
    </>
  );
}

export default function MyTimelinePage() {
  return (
    <Suspense fallback={<Loading fullScreen contextual message="Loading timeline..." />}>
      <TimelineContent />
    </Suspense>
  );
}
