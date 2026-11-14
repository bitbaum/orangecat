/** Every word the calendar shows, in one place. */
export const CALENDAR_COPY = {
  title: 'Calendar',
  modes: { month: 'Month', week: 'Week', list: 'List' },
  modesLabel: 'Show the calendar as',
  previous: 'Previous',
  next: 'Next',
  today: 'Today',
  add: 'Add',
  addOn: (day: string) => `Add on ${day}`,
  speak: 'Say what to add',
  listening: 'Listening… tap when you are done',
  transcribing: 'Writing it down…',
  added: (what: string) => `Added: ${what}`,
  undo: 'Undo',
  notHeard: 'That was not clear enough to add. Type it instead?',
  micBlocked: 'The microphone is blocked. Allow it for this site, or type it instead.',
  notAdded: 'That could not be added. Try again.',
  notRemoved: 'That could not be removed. Try again.',
  failed: 'Your calendar could not be loaded. Try again in a moment.',
  nothingThatDay: 'Nothing planned.',
  allDay: 'All day',
  more: (n: number) => `+${n} more`,
  remove: 'Remove from calendar',
  close: 'Close',
  openTasks: 'Open your to-do list',
  source: {
    calendar: null,
    task: 'Task due',
    reminder: 'Reminder',
    google: 'From your Google calendar',
  } as Record<string, string | null>,
  madeBy: (who: string) =>
    who === 'me'
      ? 'Added by you'
      : who === 'cat'
        ? 'Added by your Cat'
        : 'Added by one of your bots',
  emptyList: 'Nothing in the next 30 days. Tap the microphone and say what is coming up.',
  quick: {
    label: 'Add to your calendar',
    placeholder: 'Dentist Monday 9am at Chur',
    when: 'Day',
    time: 'Time',
    allDay: 'All day',
    length: 'How long',
    add: 'Add to calendar',
    adding: 'Adding…',
    otherDate: 'Another date…',
  },
  hint: 'Or tell your Cat: "put dentist on Monday at 9 in my calendar".',
} as const;
