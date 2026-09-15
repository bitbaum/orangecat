import { describe, it, expect } from 'vitest';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { apiErrorMessage } from '@/lib/api/errorMessage';

/**
 * One function turns an unknown thrown value into something a person can read.
 *
 * There were three. The other two did not understand this app's error envelope
 * — `{ error: { code, message } }` — so the auth and settings screens were the
 * two places still able to show a generic string where the API had sent a real
 * reason. Worse, `getErrorMessage` never returned an empty string, so the
 * `getErrorMessage(e) || 'Failed to update email.'` pattern in settings could
 * never reach its own fallback: the specific message was dead code.
 */
describe('apiErrorMessage is the only one', () => {
  it('reads the envelope the other two missed', () => {
    expect(apiErrorMessage({ error: { code: 'X', message: 'Email already in use' } }, 'fb')).toBe(
      'Email already in use'
    );
  });

  it('still handles the plain shapes', () => {
    expect(apiErrorMessage(new Error('boom'), 'fb')).toBe('boom');
    expect(apiErrorMessage('boom', 'fb')).toBe('boom');
    expect(apiErrorMessage({ message: 'boom' }, 'fb')).toBe('boom');
  });

  it('falls back rather than showing the caller a serialized object', () => {
    // getReadableError JSON.stringify'd this into the toast.
    expect(apiErrorMessage({ status: 500, detail: { nested: true } }, 'Could not save')).toBe(
      'Could not save'
    );
    expect(apiErrorMessage(null, 'Could not save')).toBe('Could not save');
    expect(apiErrorMessage({ message: '   ' }, 'Could not save')).toBe('Could not save');
  });

  it('is the only such helper left in src/', () => {
    const files: string[] = [];
    const walk = (dir: string) => {
      for (const name of readdirSync(dir)) {
        const path = join(dir, name);
        if (statSync(path).isDirectory()) {
          walk(path);
        } else if (/\.tsx?$/.test(name)) {
          files.push(path);
        }
      }
    };
    walk('src');
    const rivals = files.filter(path =>
      /export function (getErrorMessage|getReadableError|toErrorMessage|errorToString)\b/.test(
        readFileSync(path, 'utf8')
      )
    );
    expect(rivals, `Use apiErrorMessage(value, fallback) instead:\n${rivals.join('\n')}`).toEqual(
      []
    );
  });
});
