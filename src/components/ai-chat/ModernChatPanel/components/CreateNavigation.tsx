import { ChatReplies } from '@bitbaum/chatkit/react';
import Button from '@/components/ui/Button';
import {
  getCreateNavigationOptions,
  getCreateSuggestionHref,
} from '@/config/cat-create-suggestions';

/** Known application destinations are links; conversational replies stay in chatkit. */
export function CreateNavigation({
  content,
  replies = [],
  onQuickReply,
}: {
  content: string;
  replies?: string[];
  onQuickReply?: (text: string) => void;
}) {
  const destinations = getCreateNavigationOptions(content, replies);
  const conversation = replies.filter(reply => !getCreateSuggestionHref(reply));
  return (
    <>
      {destinations.length > 0 && (
        <nav aria-label="Create destinations" className="mt-2 grid gap-2 sm:grid-cols-2">
          {destinations.map(option => (
            <Button key={option.href} href={option.href} variant="outline" className="min-h-11">
              Open {option.name.toLowerCase()} {option.category === 'content' ? 'editor' : 'form'}
            </Button>
          ))}
        </nav>
      )}
      {conversation.length > 0 && (
        <ChatReplies replies={conversation} onPick={text => onQuickReply?.(text)} />
      )}
    </>
  );
}
