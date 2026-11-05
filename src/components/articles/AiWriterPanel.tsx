'use client';

import { useState } from 'react';
import Button from '@/components/ui/Button';
import Textarea from '@/components/ui/Textarea';
import type { ArticleAi } from './useArticleAi';

/** Draft and topic choices use the same request owner as in-editor changes. */
export default function AiWriterPanel({
  title,
  ai,
  disabled,
}: {
  title: string;
  ai: ArticleAi;
  disabled?: boolean;
}) {
  const [prompt, setPrompt] = useState('');
  const blocked = !!ai.busy || disabled;
  return (
    <div className="space-y-3">
      <Textarea
        label="What would you like to write about?"
        value={prompt}
        onChange={e => setPrompt(e.target.value)}
        disabled={blocked}
        placeholder="Describe your topic, angle or audience"
        rows={2}
      />
      <div className="grid grid-cols-2 gap-2">
        <Button
          type="button"
          disabled={blocked}
          onClick={() => ai.writeDraft(prompt || title)}
          variant="secondary"
        >
          Draft article
        </Button>
        <Button
          type="button"
          disabled={blocked}
          onClick={() => ai.suggestTopics(prompt.trim() || undefined)}
          variant="outline"
        >
          Suggest topics
        </Button>
      </div>
      {ai.topics.length > 0 && (
        <ul className="space-y-2">
          {ai.topics.map((topic, index) => (
            <li key={index}>
              <Button
                type="button"
                variant="outline"
                disabled={blocked}
                onClick={() => ai.writeDraft(topic.title)}
                className="h-auto min-h-11 w-full whitespace-normal py-3 text-left"
              >
                <span className="min-w-0 break-words">
                  <span className="block font-medium">{topic.title}</span>
                  {topic.angle && (
                    <span className="block text-sm text-fg-secondary">{topic.angle}</span>
                  )}
                </span>
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
