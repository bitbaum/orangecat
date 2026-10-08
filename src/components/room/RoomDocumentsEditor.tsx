'use client';

import { Plus, Trash2 } from 'lucide-react';
import Button from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import { ROOM_LIMITS, type RoomDocument } from '@/config/project-room';

interface RoomDocumentsEditorProps {
  documents: RoomDocument[];
  onChange: (documents: RoomDocument[]) => void;
}

/** Links to the diligence documents — each open is seen, like the deck. */
export function RoomDocumentsEditor({ documents, onChange }: RoomDocumentsEditorProps) {
  function patch(index: number, change: Partial<RoomDocument>) {
    onChange(documents.map((d, i) => (i === index ? { ...d, ...change } : d)));
  }

  return (
    <div className="mt-8">
      <h3 className="font-heading text-lg font-semibold tracking-display text-fg-primary">
        Documents
      </h3>
      <p className="mt-1 text-sm text-fg-secondary">
        Financials, cap table, terms — a link to each, wherever it lives.
      </p>
      <div className="mt-3 space-y-3">
        {documents.map((doc, index) => (
          <div key={index} className="flex flex-wrap items-end gap-2">
            <div className="min-w-48 flex-1">
              <Input
                label="Title"
                value={doc.title}
                maxLength={ROOM_LIMITS.documentTitle}
                onChange={e => patch(index, { title: e.target.value })}
              />
            </div>
            <div className="min-w-48 flex-[2]">
              <Input
                label="Link"
                type="url"
                placeholder="https://…"
                value={doc.url}
                onChange={e => patch(index, { url: e.target.value })}
              />
            </div>
            <Button
              variant="ghost"
              size="sm"
              aria-label="Remove document"
              onClick={() => onChange(documents.filter((_, i) => i !== index))}
            >
              <Trash2 className="h-4 w-4" aria-hidden />
            </Button>
          </div>
        ))}
        {documents.length < ROOM_LIMITS.documents && (
          <Button
            variant="outline"
            onClick={() => onChange([...documents, { title: '', url: '' }])}
          >
            <Plus className="h-4 w-4" aria-hidden />
            Add a document
          </Button>
        )}
      </div>
    </div>
  );
}
