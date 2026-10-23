import type { LucideIcon } from 'lucide-react';

interface QuickStatCardProps {
  icon: LucideIcon;
  label: string;
  value: number;
}

export default function QuickStatCard({ icon: Icon, label, value }: QuickStatCardProps) {
  return (
    <div className="rounded-lg border border-default bg-surface-base p-3">
      <div className="flex items-center gap-2 mb-1">
        <Icon className="h-4 w-4 shrink-0 text-fg-tertiary" aria-hidden="true" />
        <span className="text-sm font-medium text-fg-secondary">{label}</span>
      </div>
      <div className="text-2xl font-bold text-fg-primary">{value}</div>
    </div>
  );
}
