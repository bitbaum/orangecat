'use client';

import Link from 'next/link';
import { ArrowLeft, Upload, PenLine, Cat, FileText, Sparkles } from 'lucide-react';
import { ROUTES } from '@/config/routes';

interface Props {
  onUpload: () => void;
  onWrite: () => void;
}

export function DocumentChooseMode({ onUpload, onWrite }: Props) {
  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <div className="mb-8">
        <Link
          href={`${ROUTES.DASHBOARD.CAT_SETTINGS}#knows`}
          className="inline-flex items-center text-sm text-fg-secondary hover:text-fg-primary mb-4"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to My Context
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <div className="rounded-md border border-subtle bg-surface-raised p-2">
            <Cat className="h-6 w-6 text-fg-primary" />
          </div>
          <h1 className="text-3xl font-bold text-fg-primary">Create Cat Context</h1>
        </div>
        <p className="text-fg-secondary text-lg">
          Help your Cat understand you better by adding context about your goals, skills, and
          situation.
        </p>
      </div>

      <div className="mb-8 rounded-md border border-subtle bg-surface-raised/30 p-6">
        <div className="flex items-start gap-3">
          <Sparkles className="mt-0.5 h-5 w-5 flex-shrink-0 text-fg-primary" />
          <div>
            <h3 className="font-semibold text-fg-primary">The more context, the better advice</h3>
            <p className="mt-1 text-sm text-fg-secondary">
              Share your goals, skills, financial situation, or business plans. Cat uses this to
              tailor advice to your situation.
            </p>
          </div>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        <button
          onClick={onUpload}
          className="group relative rounded-md border border-subtle bg-surface-page p-8 text-left transition-colors hover:border-strong hover:bg-surface-raised/30"
        >
          <div className="absolute right-4 top-4 rounded-sm border border-subtle bg-surface-raised px-2 py-1 text-xs font-medium text-fg-primary">
            Easiest
          </div>
          <div className="mb-4 w-fit rounded-md bg-surface-raised p-4 transition-colors group-hover:bg-surface-raised/80">
            <Upload className="h-8 w-8 text-fg-primary" />
          </div>
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Upload a file</h3>
          <p className="text-fg-secondary mb-4">
            Drop a .txt or .md file and we&apos;ll extract the content automatically.
          </p>
          <div className="flex flex-wrap gap-2">
            <span className="px-2 py-1 bg-surface-raised rounded-md text-xs font-medium text-fg-secondary">
              .txt
            </span>
            <span className="px-2 py-1 bg-surface-raised rounded-md text-xs font-medium text-fg-secondary">
              .md
            </span>
          </div>
        </button>

        <button
          onClick={onWrite}
          className="group rounded-md border border-subtle bg-surface-page p-8 text-left transition-colors hover:border-strong hover:bg-surface-raised/30"
        >
          <div className="mb-4 w-fit rounded-md bg-surface-raised p-4 transition-colors group-hover:bg-surface-raised/80">
            <PenLine className="h-8 w-8 text-fg-primary" />
          </div>
          <h3 className="text-lg font-semibold text-fg-primary mb-2">Write from scratch</h3>
          <p className="text-fg-secondary mb-4">
            Type or paste your content directly into the form.
          </p>
          <div className="flex flex-wrap gap-2">
            {['Goals', 'Skills', 'Plans'].map(tag => (
              <span
                key={tag}
                className="px-2 py-1 bg-surface-raised rounded-md text-xs font-medium text-fg-secondary"
              >
                {tag}
              </span>
            ))}
          </div>
        </button>
      </div>

      <div className="mt-8 p-4 bg-surface-raised rounded-lg">
        <h4 className="font-medium text-fg-primary mb-3">Ideas for context to add:</h4>
        <div className="grid md:grid-cols-2 gap-3 text-sm text-fg-secondary">
          {[
            'Your 2026 goals and aspirations',
            'Your skills and expertise',
            'Your financial situation and budget',
            "Business ideas you're working on",
          ].map(idea => (
            <div key={idea} className="flex items-start gap-2">
              <FileText className="h-4 w-4 text-fg-tertiary mt-0.5 flex-shrink-0" />
              <span>{idea}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
