'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/Button';
import { SocialLink } from '@/types/social';
import { type SocialPlatformId } from '@/lib/social-platforms';
import { Plus } from 'lucide-react';
import { SocialLinkCard } from './SocialLinkCard';
import { SocialLinkForm } from './SocialLinkForm';

interface SocialLinksEditorProps {
  links: SocialLink[];
  onChange: (links: SocialLink[]) => void;
  maxLinks?: number;
}

export function SocialLinksEditor({ links, onChange, maxLinks = 15 }: SocialLinksEditorProps) {
  const [isAdding, setIsAdding] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  const canAddMore = links.length < maxLinks;

  const handleAdd = (link: SocialLink) => {
    if (links.length >= maxLinks) {
      return;
    }
    onChange([...links, link]);
    setIsAdding(false);
  };

  const handleUpdate = (index: number, link: SocialLink) => {
    const updated = [...links];
    updated[index] = link;
    onChange(updated);
    setEditingIndex(null);
  };

  const handleDelete = (index: number) => {
    if (confirm('Remove this social link?')) {
      onChange(links.filter((_, i) => i !== index));
    }
  };

  const handleCancel = () => {
    setIsAdding(false);
    setEditingIndex(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-medium text-fg-primary">Social Media & Links</h4>
          <p className="text-xs sm:text-sm text-fg-secondary">
            {links.length} {links.length === 1 ? 'link' : 'links'} added
          </p>
        </div>
        {canAddMore && !isAdding && editingIndex === null && (
          <button
            onClick={() => setIsAdding(true)}
            className="text-xs sm:text-sm font-medium text-fg-primary hover:underline underline-offset-4"
          >
            + Add Link
          </button>
        )}
      </div>

      {isAdding && (
        <SocialLinkForm
          onSubmit={handleAdd}
          onCancel={handleCancel}
          existingPlatforms={links.map(l => l.platform)}
        />
      )}

      <div className="space-y-2">
        {links.map((link, index) => (
          <div key={index}>
            {editingIndex === index ? (
              <SocialLinkForm
                initialLink={link}
                onSubmit={updatedLink => handleUpdate(index, updatedLink)}
                onCancel={handleCancel}
                existingPlatforms={
                  links
                    .map((l, i) => (i !== index ? l.platform : null))
                    .filter(Boolean) as SocialPlatformId[]
                }
              />
            ) : (
              <SocialLinkCard
                link={link}
                onEdit={() => setEditingIndex(index)}
                onDelete={() => handleDelete(index)}
              />
            )}
          </div>
        ))}
      </div>

      {links.length === 0 && !isAdding && (
        <div className="text-center py-8 border-2 border-dashed border-strong rounded-lg">
          <p className="text-sm text-fg-secondary mb-2">No social links yet</p>
          <p className="text-xs sm:text-sm text-fg-tertiary mb-4">
            Add links to build credibility and help supporters find you
          </p>
          {canAddMore && (
            <Button onClick={() => setIsAdding(true)} variant="outline" size="sm">
              <Plus className="w-4 h-4 mr-1" />
              Add Your First Link
            </Button>
          )}
        </div>
      )}

      {links.length > 0 && (
        <p className="text-xs sm:text-sm text-fg-secondary mt-2">
          💡 Links let supporters verify who you are
        </p>
      )}
    </div>
  );
}
