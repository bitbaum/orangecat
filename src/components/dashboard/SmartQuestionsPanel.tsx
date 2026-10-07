/**
 * SMART QUESTIONS PANEL
 *
 * Contextual questions for engaged users to encourage platform usage.
 * Questions are dynamically generated based on user state.
 *
 * KEY PRINCIPLES:
 * - One-click actions where possible
 * - Context-aware (knows user's entities)
 * - Progressive engagement
 * - Low friction UX
 *
 * Created: 2026-01-07
 * Last Modified: 2026-01-07
 */

'use client';

import { useState } from 'react';
import { ArrowRight, Lightbulb, X } from 'lucide-react';
import Button from '@/components/ui/Button';
import type { SmartQuestion } from '@/services/recommendations/types';

interface SmartQuestionsPanelProps {
  questions: SmartQuestion[];
  className?: string;
  /** Maximum questions to show */
  maxQuestions?: number;
  /** Title for the section */
  title?: string;
}

export function SmartQuestionsPanel({
  questions,
  className = '',
  maxQuestions = 3,
  title = 'What would you like to do next?',
}: SmartQuestionsPanelProps) {
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());

  // Filter out dismissed questions
  const visibleQuestions = questions.filter(q => !dismissedIds.has(q.id)).slice(0, maxQuestions);

  const dismissQuestion = (id: string) => {
    setDismissedIds(prev => {
      const newSet = new Set(prev);
      newSet.add(id);
      return newSet;
    });
  };

  if (visibleQuestions.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      <div className="flex items-center gap-2 mb-4">
        <Lightbulb className="w-5 h-5 text-status-warning" />
        <h3 className="text-sm font-semibold text-fg-primary">{title}</h3>
      </div>

      <div className="space-y-2">
        {visibleQuestions.map(question => (
          <QuestionCard
            key={question.id}
            question={question}
            onDismiss={() => dismissQuestion(question.id)}
          />
        ))}
      </div>
    </div>
  );
}

/**
 * Individual question card
 */
function QuestionCard({ question, onDismiss }: { question: SmartQuestion; onDismiss: () => void }) {
  return (
    <div className="oc-list-row group flex items-center justify-between gap-3 oc-card-link">
      <p className="text-sm text-fg-primary flex-1">{question.question}</p>

      <div className="flex items-center gap-2 flex-shrink-0">
        <Button href={question.action.href} size="sm" variant="outline" className="bg-surface-base">
          {question.action.label}
          <ArrowRight className="w-3 h-3 ml-1" />
        </Button>

        <button
          onClick={onDismiss}
          className="p-1 text-fg-tertiary hover:text-fg-primary rounded min-h-11 min-w-11 flex items-center justify-center"
          aria-label="Dismiss question"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

export default SmartQuestionsPanel;
