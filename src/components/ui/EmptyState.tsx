import React from 'react';
import { type LucideIcon, Inbox } from 'lucide-react';

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  action?: React.ReactNode;
  className?: string;
}

export default function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: EmptyStateProps) {
  return (
    <div
      className={`flex flex-col items-center justify-center py-12 text-center ${className ?? ''}`}
    >
      <div className="oc-icon-tile mb-4 h-12 w-12">
        <Icon className="w-6 h-6 text-muted-dim" />
      </div>
      <h2 className="text-lg font-semibold text-fg-primary mb-2">{title}</h2>
      {description && <p className="text-fg-secondary mb-6 max-w-md">{description}</p>}
      {action}
    </div>
  );
}
