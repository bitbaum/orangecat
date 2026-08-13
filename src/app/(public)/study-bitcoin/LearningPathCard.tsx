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

        <div className="flex items-center gap-4 text-sm text-fg-secondary mb-6">
          <div className="flex items-center gap-1">
            <Clock className="w-4 h-4" />
            {path.duration}
          </div>
          <div className="flex items-center gap-1">
            <BookOpen className="w-4 h-4" />
            {path.lessons} lessons
          </div>
        </div>

        {path.status === 'available' ? (
          <Link
            href={path.href}
            className="inline-flex w-full items-center justify-center rounded-lg bg-bitcoinOrange px-4 py-2 font-medium text-white transition-colors hover:bg-bitcoinOrange/90"
          >
            Start Learning
            <ChevronRight className="w-4 h-4 ml-2" />
          </Link>
        ) : (
          <span
            className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-lg bg-surface-raised px-4 py-2 font-medium text-fg-secondary"
            aria-disabled="true"
          >
            Coming soon
          </span>
        )}
      </CardContent>
    </Card>
  );
}
