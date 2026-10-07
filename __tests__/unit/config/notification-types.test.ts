/**
 * The database's notifications_type_check and the app's list are one list.
 * When they drifted, booking requests and deal-review reminders were rejected
 * at insert and nobody was told.
 */
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { IN_APP_NOTIFICATION_TYPES } from '@/config/notification-types';

const dir = join(process.cwd(), 'supabase/migrations');
const newest = readdirSync(dir)
  .filter(f => f.endsWith('.sql'))
  .sort()
  .map(f => readFileSync(join(dir, f), 'utf8'))
  .filter(sql => /ADD CONSTRAINT notifications_type_check/.test(sql))
  .at(-1)!;

describe('notification types', () => {
  it('the newest CHECK accepts exactly the types the app dispatches', () => {
    const list = newest.slice(newest.indexOf('ADD CONSTRAINT notifications_type_check'));
    const inCheck = [...list.matchAll(/'([a-z_]+)'/g)].map(m => m[1]);
    expect([...inCheck].sort()).toEqual([...IN_APP_NOTIFICATION_TYPES].sort());
  });
});
