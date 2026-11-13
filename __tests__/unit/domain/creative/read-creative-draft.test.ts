/**
 * The Studio read a model's JSON with a strict schema, and on production every
 * form but music failed with "could not finish": the prompt shows a `score`
 * example, so a poem came back with `"score": null` and the whole draft was
 * thrown away. These pin the reading the Studio actually means.
 */
import { readCreativeDraft } from '@/domain/creative/brief';

const score = {
  bpm: 72,
  chords: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  melody: [69, null, 72, 71, 67, null, 64, 67],
  texture: 'soft',
};

describe('readCreativeDraft', () => {
  it('keeps a poem that arrives with "score": null', () => {
    expect(readCreativeDraft({ title: 'Rain', text: 'Hot asphalt.', score: null }, 'poem')).toEqual(
      {
        title: 'Rain',
        text: 'Hot asphalt.',
      }
    );
  });

  it('drops a score from anything but music', () => {
    expect(
      readCreativeDraft({ title: 'Rain', text: 'Lines', score }, 'haiku')?.score
    ).toBeUndefined();
  });

  it('joins a work given as lines', () => {
    expect(readCreativeDraft({ title: 'Rain', text: ['one', 'two', 'three'] }, 'haiku')?.text).toBe(
      'one\ntwo\nthree'
    );
  });

  it('finds the work under its form’s name, and titles it from its first line', () => {
    expect(readCreativeDraft({ lyrics: 'First line\nSecond' }, 'lyrics')).toEqual({
      title: 'First line',
      text: 'First line\nSecond',
    });
  });

  it('still needs a score for music', () => {
    expect(readCreativeDraft({ title: 'Sketch', text: 'A melody' }, 'music')).toBeNull();
    expect(
      readCreativeDraft({ title: 'Sketch', text: 'A melody', score }, 'music')?.score?.bpm
    ).toBe(72);
  });

  it('refuses what is not a draft', () => {
    expect(readCreativeDraft(null, 'poem')).toBeNull();
    expect(readCreativeDraft(['x'], 'poem')).toBeNull();
    expect(readCreativeDraft({ title: 'Empty' }, 'poem')).toBeNull();
  });
});
