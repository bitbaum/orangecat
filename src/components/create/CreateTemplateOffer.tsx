'use client';

import { useState } from 'react';
import { LayoutTemplate } from 'lucide-react';
import Button from '@/components/ui/Button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { WizardTemplatePicker } from './templates/WizardTemplatePicker';
import type { EntityTemplate } from './types';

interface CreateTemplateOfferProps<T extends Record<string, unknown>> {
  templates: EntityTemplate<T>[];
  selectedTemplateId?: string | null;
  onSelectTemplate: (template: EntityTemplate<T>) => void;
}

/**
 * "Start from a template": a closed-until-wanted offer beside the form.
 * Picking a template fills the fields not yet typed into and closes the sheet.
 */
export function CreateTemplateOffer<T extends Record<string, unknown>>({
  templates,
  selectedTemplateId,
  onSelectTemplate,
}: CreateTemplateOfferProps<T>) {
  const [open, setOpen] = useState(false);

  if (templates.length === 0) {
    return null;
  }

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="min-h-11"
        onClick={() => setOpen(true)}
      >
        <LayoutTemplate className="mr-2 h-4 w-4" aria-hidden />
        Start from a template
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Start from a template</DialogTitle>
            <DialogDescription>
              It fills in the fields you have not typed in yet. You can change everything after.
            </DialogDescription>
          </DialogHeader>
          <WizardTemplatePicker
            templates={templates}
            selectedTemplateId={selectedTemplateId}
            onSelectTemplate={template => {
              onSelectTemplate(template);
              setOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>
    </>
  );
}
