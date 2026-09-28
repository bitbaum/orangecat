/** Copy for the "My things" page — one list of everything a person made or joined. */
export const THINGS_PAGE = {
  title: 'My things',
  lede: 'Everything you have made or joined here, in one place.',
  empty: {
    title: 'Nothing here yet',
    body: 'Say what you want to do and your Cat sets it up — or see everything you can do here.',
    mapLink: 'See what you can do',
  },
  joinedLabel: 'Member',
  seeAll: (namePlural: string) => `All ${namePlural.toLowerCase()}`,
} as const;
