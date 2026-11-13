/**
 * One frame per group of account settings, all with the same header shape.
 *
 * The Account page was one card titled "Account & Security" holding thirteen
 * sections one after another; a person scrolled thousands of pixels with no
 * way to tell where sign-in ended and their data began. Each group now sits
 * in its own frame, named for what it holds.
 */
import { useId } from 'react';

interface SettingsFrameProps {
  title: string;
  description?: string;
  children: React.ReactNode;
}

export function SettingsFrame({ title, description, children }: SettingsFrameProps) {
  const headingId = useId();
  return (
    <section aria-labelledby={headingId} className="oc-surface oc-surface-padding">
      <header className="mb-6 border-b border-subtle pb-4">
        <h2 id={headingId} className="text-lg font-semibold tracking-tight text-fg-primary">
          {title}
        </h2>
        {description && (
          <p className="mb-0 mt-1 max-w-prose text-sm text-fg-secondary">{description}</p>
        )}
      </header>
      <div className="space-y-10">{children}</div>
    </section>
  );
}
