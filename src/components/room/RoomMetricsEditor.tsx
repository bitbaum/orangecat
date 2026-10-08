'use client';

import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ROOM_LIMITS, type RoomMetric } from '@/config/project-room';

interface RoomMetricsEditorProps {
  metrics: RoomMetric[];
  asOf: string | null;
  onChange: (metrics: RoomMetric[], asOf: string | null) => void;
}

/** The numbers, each with how a reader checks it, and the day they were counted. */
export function RoomMetricsEditor({ metrics, asOf, onChange }: RoomMetricsEditorProps) {
  function patch(index: number, change: Partial<RoomMetric>) {
    onChange(
      metrics.map((m, i) => (i === index ? { ...m, ...change } : m)),
      asOf
    );
  }

  return (
    <div className="mt-8">
      <h3 className="font-heading text-lg font-semibold tracking-display text-fg-primary">
        The numbers
      </h3>
      <p className="mt-1 text-sm text-fg-secondary">
        Each with how to check it — a figure without that is an assertion. Dated, so a reader can
        tell a current number from an old one.
      </p>
      <div className="mt-3 space-y-3">
        {metrics.map((metric, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-40 flex-1">
              <Input
                label="What"
                placeholder="Merged pull requests"
                value={metric.label}
                maxLength={ROOM_LIMITS.metricText}
                onChange={e => patch(index, { label: e.target.value })}
              />
            </div>
            <div className="min-w-28 flex-1">
              <Input
                label="Value"
                placeholder="156"
                value={metric.value}
                maxLength={ROOM_LIMITS.metricText}
                onChange={e => patch(index, { value: e.target.value })}
              />
            </div>
            <div className="min-w-40 flex-[2]">
              <Input
                label="How to check it"
                placeholder="github.com/…/pulls"
                value={metric.verify}
                maxLength={ROOM_LIMITS.metricText}
                onChange={e => patch(index, { verify: e.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove number"
              onClick={() =>
                onChange(
                  metrics.filter((_, i) => i !== index),
                  asOf
                )
              }
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
        <div className="flex flex-wrap items-end gap-3">
          {metrics.length < ROOM_LIMITS.metrics && (
            <Button
              variant="outline"
              onClick={() => onChange([...metrics, { label: '', value: '', verify: '' }], asOf)}
            >
              <Plus className="h-4 w-4" aria-hidden />
              Add a number
            </Button>
          )}
          {metrics.length > 0 && (
            <div className="w-44">
              <Input
                label="Counted on"
                type="date"
                value={asOf ?? ''}
                onChange={e => onChange(metrics, e.target.value || null)}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
