/**
 * The Permissions-Policy header decides whether a feature can even ASK.
 * An empty allowlist (`geolocation=()`) denies it to this origin too, so the
 * browser never prompts and the call fails at once. That shipped twice:
 * microphone (speak-to-report) and geolocation ("Near me" on /events).
 */
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const source = readFileSync(join(process.cwd(), 'next.config.js'), 'utf8');
const policy = source.match(/value:\s*'(camera=[^']*)'/)?.[1] ?? '';

describe('Permissions-Policy', () => {
  it('lets this origin ask for the features the product uses', () => {
    expect(policy).toContain('microphone=(self)');
    expect(policy).toContain('geolocation=(self)');
  });

  it('keeps unused features fully denied', () => {
    expect(policy).toContain('camera=()');
  });
});
