import { APP_NAME } from '@/config/brand';

/**
 * Who shared the room, and — said plainly — that it is not anonymous: the
 * owner sees when this link is opened and what is opened through it. A reader
 * who is measured is owed that sentence.
 */
export function RoomFooter({
  ownerName,
  linkLabel,
  isShared,
}: {
  ownerName: string;
  linkLabel: string;
  isShared: boolean;
}) {
  return (
    <footer className="mt-16 space-y-2 border-t border-border-subtle pt-6 text-xs leading-5 text-fg-muted">
      <p>
        {isShared
          ? `Shared privately by ${ownerName}.`
          : `Shared privately by ${ownerName} with ${linkLabel}. This link is yours — if someone else should see the room, ask ${ownerName} for a link of their own.`}
      </p>
      <p>
        {isShared
          ? `${ownerName} sees how often this room is opened through this link, and which documents are opened.`
          : `${ownerName} sees when this link is opened and which documents in it are opened.`}{' '}
        Numbers marked as generated come from the product’s public repository and records, not from
        anyone typing them. Hosted on {APP_NAME}.
      </p>
    </footer>
  );
}
