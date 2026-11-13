'use client';

import Link from 'next/link';
import { ChevronRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/Card';
import type { LearningPath } from './config';
import { BADGE_COLORS } from '@/config/badge-colors';
import { cn } from '@/lib/utils';

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
  // A coming-soon path has nowhere to go, so it gets no link and no hover
  // that promises one; its badge says what it is.
  const available = path.status === 'available';

  return (
    <Card
      className={cn('group duration-200 relative overflow-hidden', available && 'oc-card-link')}
    >
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
            {!available && (
              <span className="px-2 py-1 text-xs font-medium rounded-full bg-surface-raised text-fg-secondary">
                Coming Soon
              </span>
            )}
          </div>
        </div>

        <h3
          className={cn(
            'text-lg font-semibold text-fg-primary mb-2',
            available && 'group-hover:underline underline-offset-4'
          )}
        >
          {path.title}
        </h3>
        <p className={cn('text-fg-secondary leading-relaxed', available ? 'mb-4' : 'mb-0')}>
          {path.description}
        </p>

        {path.status === 'available' && (
          <Link
            href={path.href}
            className="inline-flex min-h-11 items-center justify-center w-full px-4 py-2 rounded-lg font-medium transition-colors bg-bitcoinOrange hover:bg-bitcoinOrange/90 text-on-accent"
          >
            Start Learning
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        )}
      </CardContent>
    </Card>
  );
}
