import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { formatRelativeTime } from '@/utils/dates';
import { PillarMark } from './PillarMark';
import { LAYER_LABELS, type FleetTile } from './studio-fleet';

/**
 * The fleet as tiles: a mark (the product's own for the three pillars, a
 * monogram for the rest), a name, one line on what it is, and whether it is
 * live. Each tile is one link — to the project's page here when it has one,
 * else to its live site.
 */
export function StudioFleetGrid({ tiles }: { tiles: FleetTile[] }) {
  if (tiles.length === 0) {
    return null;
  }
  return (
    <ul className="oc-studio-grid" role="list">
      {tiles.map(tile => (
        <li key={tile.slug} className="min-w-0">
          <FleetTileCard tile={tile} />
        </li>
      ))}
    </ul>
  );
}

function FleetTileCard({ tile }: { tile: FleetTile }) {
  const body = (
    <>
      <div className="flex items-start gap-3">
        <span className="oc-studio-mark" aria-hidden="true">
          {tile.pillar ? (
            <PillarMark pillar={tile.pillar} size={26} />
          ) : (
            <span className="oc-studio-monogram">{tile.name.charAt(0).toUpperCase()}</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-fg-primary">{tile.name}</h3>
            {tile.external && tile.href && (
              <ArrowUpRight
                className="h-3.5 w-3.5 shrink-0 text-fg-tertiary"
                aria-hidden="true"
              />
            )}
          </div>
          <p className="oc-studio-layer">
            <span
              className={tile.live ? 'oc-studio-dot oc-studio-dot-live' : 'oc-studio-dot'}
              aria-hidden="true"
            />
            {tile.live ? 'Live' : tile.status}
            <span aria-hidden="true"> · </span>
            {LAYER_LABELS[tile.layer] ?? tile.layer}
          </p>
        </div>
      </div>
      {tile.what && <p className="oc-studio-what">{tile.what}</p>}
      {tile.lastMovedOn && (
        <p className="oc-studio-moved">Moved {formatRelativeTime(tile.lastMovedOn)}</p>
      )}
    </>
  );

  if (!tile.href) {
    return <div className="oc-studio-tile">{body}</div>;
  }
  if (tile.external) {
    return (
      <a
        href={tile.href}
        target="_blank"
        rel="noopener noreferrer"
        className="oc-studio-tile oc-card-link"
        aria-label={`${tile.name} — opens its site`}
      >
        {body}
      </a>
    );
  }
  return (
    <Link href={tile.href} className="oc-studio-tile oc-card-link">
      {body}
    </Link>
  );
}
