/**
 * The words of "Connect calendars", and where each provider keeps its link.
 * The steps are the providers' own, read from their help pages on
 * 2026-11-14 (support.google.com/calendar/answer/37648 and /37100,
 * support.apple.com/guide/icloud/share-a-calendar-mm6b1a9479/icloud,
 * support.microsoft.com "Introduction to publishing Internet calendars").
 */

export type ProviderId = 'google' | 'apple' | 'outlook' | 'other';

export const PROVIDERS: ReadonlyArray<{
  id: ProviderId;
  name: string;
  steps: string;
  open?: { label: string; href: string };
}> = [
  {
    id: 'google',
    name: 'Google',
    steps:
      'In Google Calendar on a computer: Settings → under "Settings for my calendars" click the calendar → Integrate calendar → copy "Secret address in iCal format".',
    open: {
      label: 'Open Google Calendar settings',
      href: 'https://calendar.google.com/calendar/r/settings',
    },
  },
  {
    id: 'apple',
    name: 'Apple',
    steps:
      'On icloud.com/calendar: hover the calendar in the sidebar → the Calendar Information button → turn on Public Calendar → Copy.',
    open: { label: 'Open iCloud Calendar', href: 'https://www.icloud.com/calendar/' },
  },
  {
    id: 'outlook',
    name: 'Outlook',
    steps:
      'In Outlook on the web: Settings → Calendar → Shared calendars → under "Publish a calendar" pick the calendar and Publish, then copy the link that ends in .ics.',
    open: {
      label: 'Open Outlook calendar settings',
      href: 'https://outlook.live.com/calendar/0/options/calendar/SharedCalendars',
    },
  },
  {
    id: 'other',
    name: 'Other',
    steps:
      'Most calendars (Proton, Fastmail, Nextcloud…) offer an iCal or .ics link for a calendar. Copy it from that calendar’s sharing settings.',
  },
];

export const CONNECT_COPY = {
  open: 'Connect calendars',
  title: 'Connect calendars',
  close: 'Close',
  outTitle: 'Your OrangeCat calendar on your phone',
  outBody:
    'One private link your phone’s calendar subscribes to. Your entries then show in Apple Calendar, Google Calendar or Outlook, and new ones follow.',
  outOn: 'Turn on',
  apple: 'Add to Apple Calendar',
  google: 'Add to Google Calendar',
  googleHint: 'Copies the link and opens Google’s “From URL” page: paste it there.',
  copy: 'Copy link',
  copied: 'Link copied.',
  renew: 'Make a new link',
  renewHint: 'The old link stops working.',
  off: 'Turn off',
  outPrivate: 'Anyone with this link can see your entries. Keep it to yourself.',
  inTitle: 'Your other calendars, here',
  inBody:
    'Paste a calendar’s private iCal link and its events show in your calendar here, repeating ones included. Read-only: nothing is changed there.',
  paste: 'Paste the iCal link',
  name: 'Name (optional)',
  link: 'Show it here',
  linking: 'Reading it…',
  linked: (name: string, n: number) =>
    `${name} is linked: ${n} ${n === 1 ? 'event' : 'events'} in the next month.`,
  remove: (name: string) => `Remove ${name}`,
  failed: 'That did not work. Try again.',
  notRead: 'Could not be read last time:',
} as const;

/** Google Calendar's own "Add a calendar from a URL" page (support.google.com/calendar/answer/37100). */
export const GOOGLE_ADD_BY_URL = 'https://calendar.google.com/calendar/r/settings/addbyurl';
