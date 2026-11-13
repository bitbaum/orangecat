/**
 * Messaging Library Exports
 *
 * @module messaging/lib
 */

export * from './constants';
// rate-limiter.ts removed 2026-08-25: it was a SECOND rate limiter with its own
// in-memory Map, so messaging counted against a different budget than the rest
// of the app and could never use the shared Redis backend. Named-action limits
// now live in @/lib/rate-limit (rateLimitAction). ADR-0002.
export * from './conversation-helpers';
export * from './offline-queue';
