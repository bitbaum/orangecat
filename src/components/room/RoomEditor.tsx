'use client';

/**
 * What the room says. Sections start from the outline investors read in
 * (ROOM_OUTLINE); one left empty is simply not shown.
 */

import { useState } from 'react';
import { toast } from 'sonner';
import { ArrowDown, ArrowUp, Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { API_ROUTES } from '@/config/api-routes';
import { ROOM_LIMITS, type RoomContent } from '@/config/project-room';
import { RoomDocumentsEditor } from './RoomDocumentsEditor';
import { RoomMetricsEditor } from './RoomMetricsEditor';

interface RoomEditorProps {
  projectId: string;
  initial: RoomContent;
  saved: boolean;
  buildRecordUrl: string | null;
}

export function RoomEditor({ projectId, initial, saved, buildRecordUrl }: RoomEditorProps) {
  const [content, setContent] = useState<RoomContent>(initial);
  const [dirty, setDirty] = useState(!saved);
  const [busy, setBusy] = useState(false);

  function update(patch: Partial<RoomContent>) {
    setContent(c => ({ ...c, ...patch }));
    setDirty(true);
  }

  function updateSection(index: number, patch: Partial<RoomContent['sections'][number]>) {
    update({ sections: content.sections.map((s, i) => (i === index ? { ...s, ...patch } : s)) });
  }

  function moveSection(index: number, by: -1 | 1) {
    const next = [...content.sections];
    const [section] = next.splice(index, 1);
    next.splice(index + by, 0, section);
    update({ sections: next });
  }

  async function save() {
    setBusy(true);
    try {
      const response = await fetch(API_ROUTES.PROJECTS.ROOM(projectId), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...content,
          headline: content.headline?.trim() || null,
          deck_url: content.deck_url?.trim() || null,
          contact_email: content.contact_email?.trim() || null,
          sections: content.sections.filter(s => s.title.trim()),
          documents: content.documents.filter(d => d.title.trim() && d.url.trim()),
          metrics: content.metrics.filter(m => m.label.trim() && m.value.trim()),
          metrics_as_of: content.metrics_as_of || null,
        }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        toast.error(body?.error?.message ?? 'Could not save the room');
        return;
      }
      setDirty(false);
      toast.success('Room saved');
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="mt-12">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="font-heading text-xl font-semibold tracking-display text-fg-primary">
          What the room says
        </h2>
        <Button variant="accent" onClick={save} isLoading={busy} disabled={!dirty}>
          {dirty ? 'Save' : 'Saved'}
        </Button>
      </div>

      <div className="mt-4 space-y-4 rounded-lg border border-border-subtle bg-surface-base p-4">
        <Input
          label="Headline"
          placeholder="One sentence: what this is and why it matters"
          value={content.headline ?? ''}
          maxLength={ROOM_LIMITS.headline}
          onChange={e => update({ headline: e.target.value })}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Input
            label="Deck link"
            type="url"
            placeholder="https://…"
            value={content.deck_url ?? ''}
            onChange={e => update({ deck_url: e.target.value })}
          />
          <Input
            label="Contact email"
            type="email"
            value={content.contact_email ?? ''}
            onChange={e => update({ contact_email: e.target.value })}
          />
        </div>
        <p className="text-xs text-fg-muted">
          {buildRecordUrl
            ? 'The room links to this project’s build record on Loki — what was built, and when.'
            : 'Link this project in Loki and the room shows its build record too.'}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {content.sections.map((section, index) => (
          <div key={index} className="rounded-lg border border-border-subtle bg-surface-base p-4">
            <div className="flex items-end gap-2">
              <div className="flex-1">
                <Input
                  label={`Section ${index + 1}`}
                  value={section.title}
                  maxLength={ROOM_LIMITS.sectionTitle}
                  onChange={e => updateSection(index, { title: e.target.value })}
                />
              </div>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Move up"
                disabled={index === 0}
                onClick={() => moveSection(index, -1)}
              >
                <ArrowUp className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Move down"
                disabled={index === content.sections.length - 1}
                onClick={() => moveSection(index, 1)}
              >
                <ArrowDown className="h-4 w-4" aria-hidden />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                aria-label="Remove section"
                onClick={() => update({ sections: content.sections.filter((_, i) => i !== index) })}
              >
                <Trash2 className="h-4 w-4" aria-hidden />
              </Button>
            </div>
            <Textarea
              className="mt-3"
              rows={5}
              placeholder="Left empty, this section is not shown. A blank line starts a new paragraph."
              value={section.body}
              maxLength={ROOM_LIMITS.sectionBody}
              onChange={e => updateSection(index, { body: e.target.value })}
            />
          </div>
        ))}
        {content.sections.length < ROOM_LIMITS.sections && (
          <Button
            variant="outline"
            onClick={() => update({ sections: [...content.sections, { title: '', body: '' }] })}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a section
          </Button>
        )}
      </div>

      <RoomMetricsEditor
        metrics={content.metrics}
        asOf={content.metrics_as_of ?? null}
        onChange={(metrics, metrics_as_of) => update({ metrics, metrics_as_of })}
      />

      <RoomDocumentsEditor
        documents={content.documents}
        onChange={documents => update({ documents })}
      />
    </section>
  );
}
