import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { VoiceCreate } from '@/components/create/VoiceCreate';
import { CreateOptionList } from '@/components/create/CreateOptionList';
import { CREATE_PAGE } from '@/config/create-options';
import { ROUTES } from '@/config/routes';

export function CreateChooser() {
  return (
    <div className="mx-auto max-w-xl px-4 py-8 sm:py-10">
      <h1 className="font-heading text-3xl font-bold tracking-tight text-fg-primary">
        {CREATE_PAGE.title}
      </h1>
      <p className="mt-1 text-base text-fg-secondary">{CREATE_PAGE.lede}</p>

      <VoiceCreate className="mt-5" />
      <CreateOptionList
        className="mt-6"
        extra={
          <Link
            href={ROUTES.STUDIO}
            className="flex min-h-11 items-center justify-between gap-3 rounded-lg border border-default bg-surface-base px-4 py-3 hover:bg-surface-raised"
          >
            <span>
              <span className="block font-medium text-fg-primary">
                Make something in the Studio
              </span>
              <span className="block text-sm text-fg-secondary">
                Start with a feeling. Explore music, writing or artistic direction.
              </span>
            </span>
            <ArrowRight className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden />
          </Link>
        }
      />
    </div>
  );
}
