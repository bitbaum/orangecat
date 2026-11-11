import type { MarkDefinition } from '@/config/marks/types';
import { cn } from '@/lib/utils';

export interface MarkProps {
  mark: MarkDefinition;
  size?: number;
  className?: string;
  /**
   * Let the mark move the way its file says (`motion`): draw in, spin,
   * turn its rings, or stay still. Only heroes and showcases ask; chrome-sized marks never do,
   * since a 22px glyph that moves reads as noise.
   */
  animated?: boolean;
}

/**
 * Draws any mark from the registry (src/config/marks/) in the current text
 * colour. It knows nothing about which mark it is drawing — that is what lets
 * a mark be replaced by replacing its file.
 */
export function Mark({ mark, size = 24, className, animated = false }: MarkProps) {
  const motion = animated ? mark.motion : 'none';
  return (
    <svg
      width={size}
      height={size}
      viewBox={mark.viewBox.join(' ')}
      fill="none"
      className={cn('oc-mark', motion !== 'none' && `oc-mark-${motion}`, className)}
      aria-hidden
    >
      {mark.shapes.map((shape, i) =>
        shape.paint === 'stroke' ? (
          <path
            key={i}
            d={shape.d}
            data-paint="stroke"
            pathLength={1}
            fill="none"
            stroke="currentColor"
            strokeWidth={shape.strokeWidth ?? mark.strokeWidth}
            strokeLinecap={shape.linecap}
            strokeLinejoin={shape.linejoin}
            opacity={shape.opacity}
          />
        ) : (
          <path
            key={i}
            d={shape.d}
            data-paint="fill"
            data-turn={shape.turnAbout ? '' : undefined}
            style={
              shape.turnAbout
                ? {
                    transformBox: 'view-box',
                    transformOrigin: `${shape.turnAbout[0]}px ${shape.turnAbout[1]}px`,
                  }
                : undefined
            }
            fill="currentColor"
            fillRule={shape.fillRule}
            opacity={shape.opacity}
          />
        )
      )}
    </svg>
  );
}
