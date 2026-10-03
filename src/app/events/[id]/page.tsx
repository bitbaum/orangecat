import { Metadata } from 'next';
import { generateEntityMetadata } from '@/lib/seo/metadata';
import PublicEntityDetailPage, {
  fetchEntityForMetadata,
} from '@/components/public/PublicEntityDetailPage';
import {
  eventDetailConfig,
  eventPlaceLine,
  EVENT_METADATA_SELECT,
} from '@/components/public/detail-configs/event';
import { format } from 'date-fns';

interface PageProps {
  params: Promise<{ id: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { id } = await params;
  const event = await fetchEntityForMetadata(
    'event',
    id,
    EVENT_METADATA_SELECT,
    eventDetailConfig.visibilityFilter
  );
  if (!event) {
    return {
      title: 'Event Not Found',
      description: 'The event you are looking for does not exist.',
    };
  }
  const dateStr = event.start_date
    ? ` on ${format(new Date(event.start_date as string), 'MMM d, yyyy')}`
    : '';
  const place = eventPlaceLine(event);
  const locationStr = place ? ` in ${place}` : '';
  const genres = Array.isArray(event.music_genres) ? (event.music_genres as string[]) : [];
  const soundStr = genres.length > 0 ? ` — ${genres.slice(0, 3).join(', ')}` : '';
  const description =
    event.description || `${event.title}${dateStr}${locationStr}${soundStr} — on OrangeCat.`;
  return generateEntityMetadata({ type: 'event', id, title: event.title, description });
}

export default async function PublicEventPage({ params }: PageProps) {
  const { id } = await params;
  return <PublicEntityDetailPage id={id} config={eventDetailConfig} />;
}
