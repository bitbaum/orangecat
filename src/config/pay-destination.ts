/**
 * Copy for "where should money land?" — shared by /receive and entity create.
 * Plain language. The classifier still accepts every rail; the words do not
 * quiz anyone on which rail they pasted.
 */

export const PAY_DESTINATION_COPY = {
  whyToggle: 'Why do I need this?',
  whyBody:
    'OrangeCat does not hold your money. Paste a destination from your own Bitcoin app so people can pay you there.',
  payInto: 'Pay into',
  differentDestination: 'Use a different destination',
  back: 'Back',
  onchainHint: 'Payments here use regular Bitcoin. They work, and they are not instant.',
} as const;
