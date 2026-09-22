import { APP_NAME, SITE_URL } from '@/config/brand';

/**
 * The schema.org description of a project, for search engines and anything
 * else that reads a page without rendering it.
 *
 * Extracted from page.tsx because that file reached its size limit, and this
 * is the part of it that is not the page: it renders nothing, decides nothing,
 * and is a pure function of the row. Splitting it leaves the page reading as a
 * sequence of decisions — who is looking, what may they see, what is next to
 * this — instead of a sequence of decisions with forty lines of vocabulary in
 * the middle.
 */
export interface ProjectStructuredDataInput {
  id: string;
  title: string;
  description: string | null;
  goalAmount: number | null;
  currency: string | null;
  bitcoinAddress: string | null;
  settledRaised: number | null;
  creatorName: string;
  creatorUsername: string | null;
}

export function buildProjectStructuredData(input: ProjectStructuredDataInput) {
  const currency = input.currency || 'BTC';
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: input.title,
    description: input.description || `Support ${input.title} on ${APP_NAME}`,
    url: `${SITE_URL}/projects/${input.id}`,
    creator: {
      '@type': 'Person',
      name: input.creatorName,
      ...(input.creatorUsername && { url: `${SITE_URL}/profiles/${input.creatorUsername}` }),
    },
    ...(input.goalAmount && {
      funding: {
        '@type': 'MonetaryGrant',
        amount: {
          '@type': 'MonetaryAmount',
          value: input.goalAmount,
          currency,
        },
        ...(input.settledRaised !== null &&
          input.settledRaised > 0 && {
            amountRaised: {
              '@type': 'MonetaryAmount',
              value: input.settledRaised,
              currency,
            },
          }),
      },
    }),
    ...(input.bitcoinAddress && {
      paymentAccepted: 'Bitcoin',
      bitcoinAddress: input.bitcoinAddress,
    }),
  };
}
