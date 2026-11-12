'use client';

import Link from 'next/link';
import { BookOpen, ChevronRight, Clock } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import type { LearningPath } from './config';
import { BADGE_COLORS } from '@/config/badge-colors';

interface LearningPathCardProps {
  path: LearningPath;
}

const levelColors: Record<string, string> = {
  Beginner: BADGE_COLORS.success,
  Intermediate: BADGE_COLORS.warning,
  Advanced: BADGE_COLORS.error,
};

export function LearningPathCard({ path }: LearningPathCardProps) {
  const Icon = path.icon;

  return (
    <Card className="group oc-card-link duration-200 relative overflow-hidden">
      <div className="absolute top-0 left-0 right-0 h-px bg-border-strong" />

      <CardContent className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className={`w-12 h-12 ${path.bgColor} rounded-lg flex items-center justify-center`}>
            <Icon className={`w-6 h-6 ${path.color}`} />
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className={`px-2 py-1 text-xs font-medium rounded-full ${levelColors[path.level]}`}
            >
              {path.level}
            </span>
            {path.status === 'coming-soon' && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-surface-raised text-fg-secondary">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        <h3 className="text-lg font-semibold text-fg-primary mb-2 group-hover:underline underline-offset-4">
          {path.title}
        </h3>
        <p className="text-fg-secondary mb-4 leading-relaxed">{path.description}</p>

        {/* Duration/lesson counts only exist for courses that actually exist —
            coming-soon paths carry neither, so we render nothing for them. */}
        {(path.duration || path.lessons) && (
          <div className="flex items-center gap-4 text-sm text-fg-secondary mb-6">
            {path.duration && (
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4" />
                {path.duration}
              </div>
            )}
            {path.lessons && (
              <div className="flex items-center gap-1">
                <BookOpen className="w-4 h-4" />
                {path.lessons} lessons
              </div>
            )}
          </div>
        )}

        <Link
          href={path.status === 'available' ? path.href : '#'}
          className={`inline-flex items-center justify-center w-full px-4 py-2 rounded-lg font-medium transition-colors ${
            path.status === 'available'
              ? 'bg-fg-primary text-fg-inverted hover:bg-muted-strong'
              : 'bg-surface-raised text-fg-secondary cursor-not-allowed'
          }`}
          {...(path.status === 'coming-soon' ? { 'aria-disabled': true } : {})}
        >
          {path.status === 'available' ? 'Start Learning' : 'Learn More'}
          {path.status === 'available' && <ChevronRight className="w-4 h-4 ml-2" />}
        </Link>
      </CardContent>
    </Card>
  );
}
