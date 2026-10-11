import { APP_NAME } from '@/config/brand';
import { getHomePulse } from '@/services/home/pulse';

/**
 * "On OrangeCat right now" — three real numbers under the hero.
 *
 * Counted on the server with the same public-only filters /discover uses,
 * so the fold can never claim more than the directory shows, plus how much
 * of the studio behind the product is live, from Loki's fleet map. A number
 * that cannot be fetched is left out; if none can, the panel is not shown.
 * Nothing here is typed into a config.
 */
export default async function HomePulse() {
  const pulse = await getHomePulse();

  const tiles = [
    { value: pulse.projects, label: 'projects raising' },
    { value: pulse.people, label: `people on ${APP_NAME}` },
    { value: pulse.studioLive, label: 'studio products live' },
  ].filter((tile): tile is { value: number; label: string } => (tile.value ?? 0) > 0);

  if (tiles.length === 0) {
    return null;
  }

  return (
    <aside className="oc-public-pulse" aria-label={`On ${APP_NAME} right now`}>
      <div className="oc-public-pulse-head">
        <span>On {APP_NAME} right now</span>
        <span className="oc-public-pulse-live">Live</span>
      </div>
      <dl className="oc-public-pulse-grid">
        {tiles.map(tile => (
          <div key={tile.label}>
            <dd className="oc-public-pulse-value">{tile.value}</dd>
            <dt className="oc-public-pulse-label">{tile.label}</dt>
          </div>
        ))}
      </dl>
    </aside>
  );
}
