/**
 * FORM HEADER COMPONENT
 *
 * The create/edit page header, drawn by PageHeader (the SSOT for signed-in
 * page chrome) so a create form, a wizard and a list page share one frame:
 * breadcrumb → title → subtitle, with actions (owner, template) on the right.
 * It used to hand-build its own header with a palette-coloured type icon.
 */

import type { ReactNode } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';

interface FormHeaderProps {
  name: string;
  namePlural: string;
  pageDescription: string;
  backUrl: string;
  mode: 'create' | 'edit';
  actions?: ReactNode;
  className?: string;
}

export function formHeaderTitle(mode: 'create' | 'edit', name: string): string {
  return `${mode === 'create' ? 'Create' : 'Edit'} ${name}`;
}

export function FormHeader({
  name,
  namePlural,
  pageDescription,
  backUrl,
  mode,
  actions,
  className = 'mb-6',
}: FormHeaderProps) {
  const title = formHeaderTitle(mode, name);
  return (
    <PageHeader
      className={className}
      title={title}
      subtitle={pageDescription}
      breadcrumbs={[{ label: namePlural, href: backUrl }, { label: title }]}
      actions={actions}
    />
  );
}
