import { markFor } from '@/config/marks';
import { cn } from '@/lib/utils';
import { Mark } from './Mark';

export interface ProjectMarkProps {
  /** Fleet slug — the same key as loki.orangecat.ch/api/fleet/map uses. */
  slug: string;
  /** Used for the monogram when the project has no mark yet. */
  name: string;
  size?: number;
  className?: string;
  animated?: boolean;
}

/** The monogram's type size, from the box it stands in for. */
function monogramSize(size: number): string {
  if (size >= 40) {
    return 'text-3xl';
  }
  if (size >= 32) {
    return 'text-2xl';
  }
  if (size >= 24) {
    return 'text-lg';
  }
  return 'text-sm';
}

/**
 * A project's face: its mark from the registry when it has one, its initial
 * when it does not. Giving a project a mark is one command —
 * `pnpm run brand:import <slug> logo.svg` — and every tile, banner and pillar
 * that shows that project picks it up.
 */
export function ProjectMark({ slug, name, size = 24, className, animated }: ProjectMarkProps) {
  const mark = markFor(slug);
  if (mark) {
    return <Mark mark={mark} size={size} className={className} animated={animated} />;
  }
  return (
    <span className={cn('oc-mark-monogram', monogramSize(size), className)} aria-hidden>
      {name.charAt(0).toUpperCase()}
    </span>
  );
}
