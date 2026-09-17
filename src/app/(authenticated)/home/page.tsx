'use client';

import React from 'react';
import SocialTimeline from '@/components/timeline/SocialTimeline';
import { Home } from 'lucide-react';

/**
 * Home — the personalized "Following" feed.
 *
 * Posts from the people and projects you follow (plus your own), newest first —
 * distinct from /timeline (your own journey) and /community (everyone). Uses the
 * unified SocialTimeline in `following` mode (get_following_feed RPC).
 */
export default function HomePage() {
  return (
    <SocialTimeline
      title="Home"
      icon={Home}
      mode="following"
      showShareButton={false}
      defaultSort="recent"
      showSortingControls={false}
      showInlineComposer={true}
      allowProjectSelection={true}
    />
  );
}
