'use client';

import Button from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TIMELINE_VISIBILITY_OPTIONS } from '@/config/timeline';
import { ARTICLE_COPY } from '@/config/articles';
import type { TimelineVisibility } from '@/types/timeline';

/**
 * Visibility selector + publish/save button row.
 * Extracted from ArticleComposer.tsx (pure move — markup unchanged).
 */
export default function PublishBar({
  visibility,
  setVisibility,
  publishing,
  canPublish,
  isEditing,
  onPublish,
}: {
  visibility: TimelineVisibility;
  setVisibility: (v: TimelineVisibility) => void;
  publishing: boolean;
  canPublish: boolean;
  isEditing: boolean;
  onPublish: () => void;
}) {
  return (
    <div className="mt-6 grid items-end gap-3 border-t border-subtle pt-4 sm:grid-cols-[1fr_auto]">
      <fieldset disabled={publishing} className="min-w-0">
        <legend className="mb-2 text-sm font-medium text-fg-primary">Who can read this?</legend>
        <SegmentedControl
          label="Article visibility"
          value={visibility}
          onChange={setVisibility}
          items={TIMELINE_VISIBILITY_OPTIONS.map(option => ({
            value: option.key,
            label: option.label,
            icon: option.Icon,
          }))}
        />
      </fieldset>
      <Button variant="primary" onClick={onPublish} disabled={!canPublish} isLoading={publishing}>
        {isEditing
          ? publishing
            ? ARTICLE_COPY.edit.saving
            : ARTICLE_COPY.edit.save
          : publishing
            ? ARTICLE_COPY.new.publishing
            : ARTICLE_COPY.new.publish}
      </Button>
    </div>
  );
}
