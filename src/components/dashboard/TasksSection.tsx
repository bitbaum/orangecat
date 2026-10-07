'use client';

import { useState, useEffect } from 'react';
import {
  CheckCircle2,
  Target,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Loader2,
  X,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { useAuth } from '@/hooks/useAuth';
import { useRecommendations } from '@/hooks/useRecommendations';
import { SmartQuestionsPanel } from './SmartQuestionsPanel';
import { TaskCard } from './TaskCard';
import { ROUTES } from '@/config/routes';

interface TasksSectionProps {
  className?: string;
  maxTasks?: number;
  showQuestions?: boolean;
  /**
   * Render nothing unless there is setup left to do: no spinner card while
   * loading, no "all caught up" card, no 100% bar. The dashboard uses this —
   * a finished checklist is not a reason to spend a screen.
   */
  quietWhenDone?: boolean;
}

export default function TasksSection({
  className,
  maxTasks = 4,
  showQuestions = true,
  quietWhenDone = false,
}: TasksSectionProps) {
  const { user, profile } = useAuth();
  // `userToggled` tracks whether the viewer has clicked the expand/collapse
  // button. Default collapsed state derives from setup progress (collapse
  // when 0 critical/high tasks remain) so the 100% chrome doesn't dominate
  // the dashboard slot. Once the viewer clicks, we honor their choice.
  const [userToggled, setUserToggled] = useState(false);
  const [userExpanded, setUserExpanded] = useState(true);
  const [celebrationDismissed, setCelebrationDismissed] = useState(false);

  useEffect(() => {
    if (user?.id) {
      setCelebrationDismissed(
        localStorage.getItem(`oc_celebration_dismissed_${user.id}`) === 'true'
      );
    }
  }, [user?.id]);

  const dismissCelebration = () => {
    if (user?.id) {
      localStorage.setItem(`oc_celebration_dismissed_${user.id}`, 'true');
    }
    setCelebrationDismissed(true);
  };

  const {
    isLoading,
    error,
    profileCompletion,
    taskCompletion,
    tasks,
    questions,
    celebration,
    markTaskCompleted,
    completedTaskIds,
    refresh,
  } = useRecommendations({ limit: maxTasks + 2 });

  if (!user || !profile) {
    return null;
  }

  if (isLoading) {
    if (quietWhenDone) {
      return null;
    }
    return (
      <Card className={className}>
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-fg-tertiary" />
          <span className="ml-2 text-fg-secondary">Loading recommendations...</span>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <AlertCircle className="w-6 h-6 text-fg-secondary" />
            <div>
              <p className="text-sm font-medium text-fg-primary">
                Couldn&apos;t load recommendations
              </p>
              <p className="text-xs text-fg-secondary">{error.message}</p>
            </div>
            <Button size="sm" variant="outline" onClick={() => refresh()}>
              <RefreshCw className="w-3 h-3 mr-1.5" />
              Try again
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (celebration && !celebrationDismissed) {
    return (
      <div className={className}>
        <Card className="border-subtle bg-surface-page">
          <CardContent className="p-6 text-center relative">
            <button
              onClick={dismissCelebration}
              className="absolute right-3 top-3 rounded-md p-1.5 text-fg-tertiary transition-colors hover:bg-surface-raised hover:text-fg-primary"
              aria-label="Dismiss"
            >
              <X className="w-4 h-4" />
            </button>
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-md border border-subtle bg-surface-raised/40">
              <Sparkles className="w-8 h-8 text-status-positive" />
            </div>
            <h3 className="text-lg font-semibold text-fg-primary mb-2">{celebration.title}</h3>
            <p className="text-fg-secondary mb-4">{celebration.description}</p>
            {showQuestions && questions.length > 0 && (
              <SmartQuestionsPanel questions={questions} className="mt-6 text-left" />
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  if (tasks.length === 0) {
    if (quietWhenDone) {
      return null;
    }
    return (
      <div className={className}>
        <Card>
          <CardContent className="flex flex-col items-center gap-3 p-6 text-center">
            <div className="flex h-12 w-12 items-center justify-center rounded-md border border-subtle bg-surface-raised/40">
              <CheckCircle2 className="w-6 h-6 text-status-positive" />
            </div>
            <div>
              <p className="text-sm font-medium text-fg-primary">You&apos;re all caught up</p>
              <p className="text-xs text-fg-secondary">
                Nothing pending. Ask Cat what to do next or explore the platform.
              </p>
            </div>
            <div className="flex gap-2">
              <Link href={ROUTES.DASHBOARD.CAT}>
                <Button size="sm">Ask Cat</Button>
              </Link>
              <Link href={ROUTES.DISCOVER}>
                <Button size="sm" variant="outline">
                  Discover
                </Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  // "Tasks remaining" must measure the same scope as the "% Setup" number, which
  // only counts critical + high priority tasks. Counting all tasks here caused
  // "100% Setup" to appear next to "3 tasks remaining" when the only remaining
  // items were optional/suggested polish.
  const setupTasks = tasks.filter(t => t.priority === 'critical' || t.priority === 'high');
  const setupTasksRemaining = setupTasks.length;

  // When setup is fully done, the dropdown should match the header's
  // "Setup complete" claim. Hide medium/low polish tasks instead of
  // promoting them next to a 100% bar — they get their own surface
  // elsewhere (smart questions panel + entity-create CTAs).
  if (quietWhenDone && setupTasksRemaining === 0) {
    return null;
  }
  const taskPool = setupTasksRemaining === 0 ? setupTasks : tasks;
  const visibleTasks = taskPool.slice(0, maxTasks);
  const hiddenCount = Math.max(0, taskPool.length - maxTasks);
  const isExpanded = userToggled ? userExpanded : setupTasksRemaining > 0;
  const toggleExpanded = () => {
    setUserToggled(true);
    setUserExpanded(!isExpanded);
  };

  return (
    <div className={className}>
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="w-5 h-5 text-fg-secondary" />
                Recommended Next Steps
              </CardTitle>
              <p className="text-sm text-fg-secondary mt-1">
                Complete these to get the most out of OrangeCat
              </p>
            </div>
            <div className="flex items-center gap-3">
              <div className="text-right">
                <div className="text-sm font-medium text-fg-primary">{taskCompletion}% Setup</div>
                <div className="text-xs text-fg-secondary">
                  {setupTasksRemaining === 0
                    ? 'Setup complete'
                    : `${setupTasksRemaining} task${setupTasksRemaining !== 1 ? 's' : ''} remaining`}
                </div>
              </div>
              <button
                onClick={toggleExpanded}
                className="rounded-md p-2 transition-colors hover:bg-surface-raised"
                aria-label={isExpanded ? 'Collapse tasks' : 'Expand tasks'}
              >
                {isExpanded ? (
                  <ChevronUp className="w-4 h-4" />
                ) : (
                  <ChevronDown className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div className="mt-3 h-2 w-full overflow-hidden rounded-sm bg-surface-raised">
            <div
              className="h-2 rounded-sm bg-fg-primary transition-all duration-500"
              style={{ width: `${taskCompletion}%` }}
            />
          </div>
        </CardHeader>

        {isExpanded && (
          <CardContent className="pt-0">
            <div className="space-y-3">
              {visibleTasks.map(task => (
                <TaskCard
                  key={task.id}
                  task={task}
                  onComplete={() => markTaskCompleted(task.id)}
                  isCompleted={completedTaskIds.has(task.id)}
                />
              ))}

              {hiddenCount > 0 && (
                <div className="text-center pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUserToggled(true);
                      setUserExpanded(true);
                    }}
                  >
                    Show {hiddenCount} more task{hiddenCount !== 1 ? 's' : ''}
                  </Button>
                </div>
              )}
            </div>

            {showQuestions && questions.length > 0 && profileCompletion >= 75 && (
              <SmartQuestionsPanel questions={questions} className="mt-6 pt-4 border-t" />
            )}
          </CardContent>
        )}
      </Card>
    </div>
  );
}
