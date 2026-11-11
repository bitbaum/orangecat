import Button from '@/components/ui/Button';
import { getCreateNavigationOptions } from '@/config/cat-create-suggestions';

/**
 * Known application destinations are links. The replies that say something
 * are chatkit's reply buttons (catAnswer splits the two); a reply that only
 * opens a page is drawn here, once, as the link it is.
 */
export function CreateNavigation({
  content,
  replies = [],
}: {
  content: string;
  replies?: readonly string[];
}) {
  const destinations = getCreateNavigationOptions(content, replies);
  if (destinations.length === 0) {
    return null;
  }
  return (
    <nav aria-label="Create destinations" className="mt-2 grid gap-2 sm:grid-cols-2">
      {destinations.map(option => (
        <Button key={option.href} href={option.href} variant="outline" className="min-h-11">
          Open {option.name.toLowerCase()} {option.category === 'content' ? 'editor' : 'form'}
        </Button>
      ))}
    </nav>
  );
}
