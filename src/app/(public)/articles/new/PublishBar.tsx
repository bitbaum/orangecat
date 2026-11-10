'use client';

import Button from '@/components/ui/Button';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { TIMELINE_VISIBILITY_OPTIONS } from '@/config/timeline';
import { ARTICLE_COPY } from '@/config/articles';
import type { TimelineVisibility } from '@/types/timeline';
import ProjectWallsField from './ProjectWallsField';
import type { ProjectWalls } from './useProjectWalls';

/**
 * Where the article goes and the button that sends it there: who can read it,
 * which of the writer's projects it also goes on (new articles only), publish.
 */
export default function PublishBar({
  visibility,
  setVisibility,
  publishing,
  canPublish,
  isEditing,
  onPublish,
  projectWalls,
}: {
  visibility: TimelineVisibility;
  setVisibility: (v: TimelineVisibility) => void;
  publishing: boolean;
  canPublish: boolean;
  isEditing: boolean;
  onPublish: () => void;
  /** Absent when editing: an edit keeps the walls it was published on. */
  projectWalls?: ProjectWalls;
}) {
  return (
    <div className="mt-6 grid items-end gap-3 border-t border-subtle pt-4 sm:grid-cols-[1fr_auto]">
      <div className="flex min-w-0 flex-col gap-2">
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
        {projectWalls && <ProjectWallsField walls={projectWalls} disabled={publishing} />}
      </div>
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
