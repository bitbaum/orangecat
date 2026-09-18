/**
 * ProjectHeader Component
 *
 * Displays project title, creator info, status, and action buttons
 *
 * Created: 2025-01-27
 */

'use client';

import { formatRelativeTime } from '@/utils/dates';
import Link from 'next/link';
import Image from 'next/image';
import { Edit, Share2, MessageCircle } from 'lucide-react';
import Button from '@/components/ui/Button';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { getUniqueCategories } from '@/utils/project';
import type { EntityType } from '@/config/entity-registry';
import { getInitial } from '@/utils/string';
import { useAuth } from '@/hooks/useAuth';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

interface ProjectHeaderProps {
  project: {
    id: string;
    title: string;
    status: string;
    created_at: string;
    user_id: string;
    category?: string | null;
    tags?: string[] | null;
    profiles?: {
      username: string | null;
      name: string | null;
      avatar_url: string | null;
      id?: string;
    };
  };
  isOwner: boolean;
  onShare: () => void;
  /**
   * Injected by ProjectPageClient, which passes the real resolver. The second
   * argument is what makes a project's status read the same here as it does
   * on the dashboard list; without it this header had its own answer.
   */
  getStatusInfo: (status: string, entityType?: EntityType) => { label: string; className: string };
}

export default function ProjectHeader({
  project,
  isOwner,
  onShare,
  getStatusInfo,
}: ProjectHeaderProps) {
  const { user } = useAuth();
  const router = useRouter();
  const statusInfo = getStatusInfo(project.status, 'project');
  const creatorProfileUrl = project.profiles?.username
    ? ROUTES.PROFILE.VIEW(project.profiles.username)
    : project.profiles?.id
      ? ROUTES.PROFILE.VIEW(project.profiles.id)
      : ROUTES.PROFILE.VIEW(project.user_id);

  // Handle contact/message the project creator
  const handleContact = async () => {
    if (!user) {
      toast.info('Please sign in to send a message');
      router.push(`${ROUTES.AUTH_LOGIN}&from=${ROUTES.PROJECTS.VIEW(project.id)}`);
      return;
    }

    try {
      // Create or open conversation with project creator
      const response = await fetch(API_ROUTES.MESSAGES.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          participantIds: [project.user_id],
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to start conversation');
      }

      const { conversationId } = await response.json();
      router.push(ROUTES.MESSAGE_CONVERSATION(conversationId));
    } catch {
      toast.error('Failed to start conversation. Please try again.');
    }
  };

  return (
    <div className="mb-6">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4 mb-4">
        <div className="flex-1 min-w-0">
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-fg-primary mb-3 break-words">
            {project.title}
          </h1>

          {/* Categories - Show prominently for quick project understanding */}
          {(project.category || (project.tags && project.tags.length > 0)) && (
            <div className="flex flex-wrap gap-2 mb-4" role="list">
              {getUniqueCategories(project.category, project.tags, { limit: 5 }).map(
                (category, idx) => (
                  <span
                    key={`${category}-${idx}`}
                    className="px-3 py-1 rounded-full text-xs font-medium bg-surface-raised text-fg-secondary border border-subtle"
                    role="listitem"
                  >
                    {category}
                  </span>
                )
              )}
            </div>
          )}

          {/* Creator Info */}
          {project.profiles ? (
            <div className="flex items-center gap-3 mb-3">
              <div className="flex items-center gap-2">
                <Link
                  href={creatorProfileUrl}
                  className="hover:opacity-80 transition-opacity"
                  aria-label={`View ${project.profiles.name || project.profiles.username || 'creator'}'s profile`}
                >
                  {project.profiles.avatar_url ? (
                    <Image
                      src={project.profiles.avatar_url}
                      alt={project.profiles.name || project.profiles.username || 'Creator'}
                      width={32}
                      height={32}
                      className="rounded-full cursor-pointer"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-raised text-fg-secondary font-semibold text-sm cursor-pointer hover:opacity-80 transition-opacity">
                      {getInitial(project.profiles.name || project.profiles.username, 'A')}
                    </div>
                  )}
                </Link>
                <div>
                  <p className="text-sm text-fg-secondary">Created by</p>
                  <Link
                    href={creatorProfileUrl}
                    className="text-sm font-semibold text-fg-primary hover:underline underline-offset-4"
                  >
                    {project.profiles.name ||
                      project.profiles.username ||
                      `User ${project.profiles.id?.substring(0, 8) || 'Unknown'}`}
                  </Link>
                </div>
              </div>
            </div>
          ) : project.user_id ? (
            // Profile exists but wasn't loaded - show user ID as fallback
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-raised text-fg-secondary font-semibold text-sm">
                ?
              </div>
              <div>
                <p className="text-sm text-fg-secondary">Created by</p>
                <Link
                  href={`/profiles/${project.user_id}`}
                  className="text-sm font-semibold text-fg-primary hover:underline underline-offset-4"
                >
                  User {project.user_id.substring(0, 8)}
                </Link>
              </div>
            </div>
          ) : (
            <div className="flex items-center gap-3 mb-3">
              <div className="w-8 h-8 rounded-full flex items-center justify-center bg-surface-raised text-fg-secondary font-semibold text-sm">
                ?
              </div>
              <div>
                <p className="text-sm text-fg-secondary">Created by</p>
                <span className="text-sm font-semibold text-fg-primary">Anonymous</span>
              </div>
            </div>
          )}

          {/* Status and Date */}
          <div className="flex items-center gap-3 flex-wrap">
            {/* Always show status badge - it's an important trust signal */}
            <span
              className={`px-3 py-1 rounded-full text-sm font-medium ${statusInfo.className}`}
              aria-label={`Project status: ${statusInfo.label}`}
            >
              {statusInfo.label}
            </span>
            <time dateTime={project.created_at} className="text-sm text-fg-secondary">
              Created {formatRelativeTime(project.created_at)}
            </time>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-2 flex-shrink-0" role="group" aria-label="Project actions">
          {/* Edit - only for owners */}
          {isOwner && (
            <Link href={ROUTES.PROJECTS.EDIT(project.id)}>
              <Button variant="outline" size="sm" aria-label="Edit project">
                <Edit className="w-4 h-4 mr-2" aria-hidden="true" />
                Edit
              </Button>
            </Link>
          )}
          {/* Contact - only for non-owners */}
          {!isOwner && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleContact}
              aria-label="Contact project creator"
            >
              <MessageCircle className="w-4 h-4 mr-2" aria-hidden="true" />
              Contact
            </Button>
          )}
          {/* Share - available for everyone */}
          <Button variant="outline" size="sm" onClick={onShare} aria-label="Share project">
            <Share2 className="w-4 h-4 mr-2" aria-hidden="true" />
            Share
          </Button>
        </div>
      </div>
    </div>
  );
}
