import { describe, expect, it } from 'vitest';
import { outcomeLine } from '@/services/companions/outcomes';
import type { ActionResult } from '@/services/cat/action-types';

/** The line a thread keeps after a "Do it?" card ran. */
const base: ActionResult = { success: true, actionId: 'create_event', status: 'completed' };

describe('outcomeLine', () => {
  it('is the handler’s own sentence, with the page when there is one', () => {
    expect(
      outcomeLine(
        { ...base, data: { displayMessage: 'Dentist is on the map.', url: '/events/dentist' } },
        'Create event “Dentist”'
      )
    ).toBe('Dentist is on the map. [Open](/events/dentist)');
  });

  it('falls back to the card’s description when the handler said nothing', () => {
    expect(outcomeLine({ ...base, data: {} }, 'Create event “Dentist”')).toBe(
      'Create event “Dentist”'
    );
    expect(outcomeLine({ ...base, data: { url: '/x' } }, 'Create event “Dentist”')).toBe(
      'Create event “Dentist” [Open](/x)'
    );
  });

  it('is the reason when it failed, never a success wording', () => {
    expect(
      outcomeLine(
        { ...base, success: false, status: 'failed', error: 'Loki did not answer: not linked.' },
        'Ask Loki: “x”'
      )
    ).toBe('Loki did not answer: not linked.');
    expect(outcomeLine({ ...base, success: false, status: 'failed' }, 'Ask Loki: “x”')).toBe(
      'Ask Loki: “x”: that did not go through.'
    );
  });
});
