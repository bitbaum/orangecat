'use client';

import React from 'react';
import SocialTimeline from '@/components/timeline/SocialTimeline';
import { Globe } from 'lucide-react';

/**
 * Community Timeline Page - Public posts from all users and projects
 *
 * Uses the unified SocialTimeline component with community mode.
 * Identical interface to My Journey page but shows posts from all users.
 *
 * Built with best practices: DRY, maintainable, modular, high quality code
 */
export default function CommunityPage() {
  return (
    <SocialTimeline
      title="Community"
      icon={Globe}
      mode="community"
      showShareButton={false}
      defaultSort="trending"
      showSortingControls={true}
      showInlineComposer={true}
      allowProjectSelection={true}
    />
  );
}
