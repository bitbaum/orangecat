'use client';

/**
 * The fields of one slide — only the ones its layout uses. Lists are edited as
 * lines (one point per line, "value | label" per figure), which is quicker to
 * write and harder to break than a row of inputs per item.
 */

import { LAYOUTS, LIMITS, type Binding, type Layout, type Slide } from '@bitbaum/deckkit';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { LAYOUT_LABELS, fromLines, fromPairs, toLines, toPairs } from './deckEdits';
import { LinesField } from './LinesField';

const BIND_LABELS: Record<Binding, string> = {
  facts: 'Key facts of the room',
  pace: 'Weekly shipping pace',
  roadmap: 'The roadmap: now / next / later',
};

const BINDABLE: Partial<Record<Layout, Binding>> = {
  numbers: 'facts',
  chart: 'pace',
  columns: 'roadmap',
};

interface SlideFormProps {
  slide: Slide;
  onChange: (patch: Partial<Slide>) => void;
}

export function SlideForm({ slide, onChange }: SlideFormProps) {
  const has = (...layouts: Layout[]) => layouts.includes(slide.layout);
  const bindable = BINDABLE[slide.layout];
  const bound = !!slide.bind;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-sm text-fg-secondary">
          Layout
          <select
            className="min-h-11 rounded-md border border-border-subtle bg-surface-base px-3 text-base text-fg-primary"
            value={slide.layout}
            onChange={e => onChange({ layout: e.target.value as Layout, bind: undefined })}
          >
            {LAYOUTS.map(l => (
              <option key={l} value={l}>
                {LAYOUT_LABELS[l]}
              </option>
            ))}
          </select>
        </label>
        <Input
          label="Label above the title"
          value={slide.kicker ?? ''}
          maxLength={LIMITS.kicker}
          onChange={e => onChange({ kicker: e.target.value })}
        />
      </div>

      <Textarea
        label="Title — one claim, as a sentence. *word* sets it in the accent colour."
        rows={2}
        value={slide.title}
        maxLength={LIMITS.title}
        onChange={e => onChange({ title: e.target.value })}
      />

      {has('cover', 'statement', 'image', 'closing') && (
        <Textarea
          label="Under the title"
          rows={3}
          value={slide.body ?? ''}
          maxLength={LIMITS.body}
          onChange={e => onChange({ body: e.target.value })}
        />
      )}

      {bindable && (
        <label className="flex items-start gap-2 rounded-md border border-border-subtle bg-surface-raised p-3 text-sm text-fg-secondary">
          <input
            type="checkbox"
            className="mt-1"
            checked={bound}
            onChange={e => onChange({ bind: e.target.checked ? bindable : undefined })}
          />
          <span>
            <span className="font-medium text-fg-primary">Live: {BIND_LABELS[bindable]}</span> —
            read from the room&rsquo;s evidence every time the deck is opened, so the numbers are
            never stale.
          </span>
        </label>
      )}

      {has('points') && (
        <LinesField
          key={`${slide.id}-points`}
          label="Points — one per line. “Lead: rest” sets the lead in bold."
          rows={6}
          initial={toLines(slide.points)}
          onCommit={text => onChange({ points: fromLines(text).slice(0, LIMITS.points) })}
        />
      )}

      {has('numbers') && !bound && (
        <LinesField
          key={`${slide.id}-stats`}
          label="Figures — one per line: value | label"
          initial={toPairs(
            slide.stats,
            s => s.value,
            s => s.label
          )}
          onCommit={text =>
            onChange({ stats: fromPairs(text).map(([value, label]) => ({ value, label })) })
          }
        />
      )}

      {has('chart') && !bound && (
        <LinesField
          key={`${slide.id}-bars`}
          label="Bars — one per line: label | number"
          rows={6}
          initial={toPairs(
            slide.bars,
            b => b.label,
            b => String(b.value)
          )}
          onCommit={text =>
            onChange({
              bars: fromPairs(text)
                .map(([label, v]) => ({ label, value: Number(v.replace(/[^\d.]/g, '')) }))
                .filter(b => Number.isFinite(b.value)),
            })
          }
        />
      )}

      {has('compare', 'columns') && !bound && (
        <ColumnsField
          slide={slide}
          onChange={onChange}
          max={slide.layout === 'compare' ? 2 : LIMITS.columns}
        />
      )}

      {has('image') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Screenshot (https link)"
            type="url"
            value={slide.image ?? ''}
            onChange={e => onChange({ image: e.target.value })}
          />
          <Input
            label="Address shown above it"
            value={slide.imageCaption ?? ''}
            onChange={e => onChange({ imageCaption: e.target.value })}
          />
        </div>
      )}

      {has('closing') && (
        <div className="grid gap-3 sm:grid-cols-2">
          <Input
            label="Button"
            value={slide.action?.label ?? ''}
            onChange={e =>
              onChange({ action: { label: e.target.value, href: slide.action?.href ?? '' } })
            }
          />
          <Input
            label="It opens (https:// or mailto:)"
            value={slide.action?.href ?? ''}
            onChange={e =>
              onChange({ action: { label: slide.action?.label ?? '', href: e.target.value } })
            }
          />
        </div>
      )}

      {!bound && (
        <Input
          label="Source — where the facts on this slide come from"
          value={slide.sources ?? ''}
          maxLength={LIMITS.sources}
          onChange={e => onChange({ sources: e.target.value })}
        />
      )}

      <Textarea
        label="Speaker notes — only you see these, when presenting (S)"
        rows={3}
        value={slide.notes ?? ''}
        maxLength={LIMITS.notes}
        onChange={e => onChange({ notes: e.target.value })}
      />
    </div>
  );
}

function ColumnsField({ slide, onChange, max }: SlideFormProps & { max: number }) {
  const columns = slide.columns ?? [];
  const set = (i: number, heading: string, items: string[]) => {
    const next = [...columns];
    next[i] = { heading, items };
    onChange({ columns: next.filter(c => c.heading.trim() || c.items.length).slice(0, max) });
  };
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {Array.from(
        { length: Math.min(max, columns.length + 1) },
        (_, i) => columns[i] ?? { heading: '', items: [] }
      ).map((column, i) => (
        <div key={i} className="space-y-2 rounded-md border border-border-subtle p-3">
          <Input
            label={`Column ${i + 1}`}
            value={column.heading}
            onChange={e => set(i, e.target.value, column.items)}
          />
          <LinesField
            key={`${slide.id}-col-${i}`}
            label="One item per line"
            rows={4}
            initial={toLines(column.items)}
            onCommit={text => set(i, column.heading, fromLines(text))}
          />
        </div>
      ))}
    </div>
  );
}
