import { describe, it, expect } from 'vitest';
import { MORNING_SKETCH, renderMusicWav } from '@/domain/creative/music';
import { creativeDraftSchema, musicScoreSchema } from '@/domain/creative/brief';

describe('portable musical drafts', () => {
  it('writes an audible, bounded PCM recording with a matching duration and header', () => {
    const wav = renderMusicWav(MORNING_SKETCH);
    const bytes = new Uint8Array(wav);
    const header = new DataView(wav);
    expect(new TextDecoder().decode(bytes.slice(0, 4))).toBe('RIFF');
    expect(new TextDecoder().decode(bytes.slice(8, 12))).toBe('WAVE');
    expect(header.getUint32(4, true)).toBe(wav.byteLength - 8);
    expect(header.getUint32(40, true)).toBe(wav.byteLength - 44);
    expect(header.getUint16(22, true)).toBe(1);
    expect(header.getUint32(24, true)).toBe(22050);
    const duration = (wav.byteLength - 44) / (22050 * 2);
    expect(duration).toBeGreaterThan(10);
    expect(duration).toBeLessThanOrEqual(33);
    let power = 0;
    let peak = 0;
    for (let i = 44; i < wav.byteLength; i += 2) {
      const v = header.getInt16(i, true) / 32768;
      power += v * v;
      peak = Math.max(peak, Math.abs(v));
    }
    expect(Math.sqrt(power / ((wav.byteLength - 44) / 2))).toBeGreaterThan(0.02);
    expect(peak).toBeLessThan(1);
  });
  it('caps the longest slow composition and rejects unsafe model scores', () => {
    const wav = renderMusicWav({
      ...MORNING_SKETCH,
      bpm: 45,
      chords: Array(8).fill([36, 40, 43, 48]),
    });
    expect((wav.byteLength - 44) / 44100).toBeLessThanOrEqual(33);
    for (const bad of [0, -1, 161, Infinity, NaN])
      expect(musicScoreSchema.safeParse({ ...MORNING_SKETCH, bpm: bad }).success).toBe(false);
    expect(() => renderMusicWav({ ...MORNING_SKETCH, melody: [9000] })).toThrow();
    expect(creativeDraftSchema.safeParse({ title: 'Incomplete', text: '' }).success).toBe(false);
  });
});
