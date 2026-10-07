/**
 * Money out of an event — the words the event_payouts table uses.
 * SSOT for kind/method/status (validated here, not by a database CHECK).
 */

export const EVENT_PAYOUT_KINDS = ['crew', 'refund'] as const;
export type EventPayoutKind = (typeof EVENT_PAYOUT_KINDS)[number];

/** 'lightning': sent through OrangeCat. 'other': paid outside it (Twint, cash), recorded by the organizer. */
export const EVENT_PAYOUT_METHODS = ['lightning', 'other'] as const;
export type EventPayoutMethod = (typeof EVENT_PAYOUT_METHODS)[number];

export const EVENT_PAYOUT_STATUSES = ['sent', 'failed'] as const;
export type EventPayoutStatus = (typeof EVENT_PAYOUT_STATUSES)[number];

export const EVENT_PAYOUT_NOTE_MAX = 200;
