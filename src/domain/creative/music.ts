import { musicScoreSchema, type MusicScore } from './brief';

/** A bounded original score becomes a portable mono PCM WAV. No remote audio or autoplay. */
export function renderMusicWav(input: MusicScore): ArrayBuffer {
  const score = musicScoreSchema.parse(input);
  const rate = 22050;
  const beat = 60 / score.bpm;
  const bar = beat * 4;
  const seconds = Math.min(32, score.chords.length * bar) + 1;
  const samples = new Float32Array(Math.ceil(seconds * rate));
  function note(midi: number, start: number, duration: number, volume: number, bright = false) {
    const hz = 440 * 2 ** ((midi - 69) / 12);
    const first = Math.floor(start * rate);
    const count = Math.floor(duration * rate);
    for (let i = 0; i < count && first + i < samples.length; i++) {
      const t = i / rate;
      const envelope = Math.min(1, t / 0.035) * Math.min(1, (duration - t) / 0.3);
      const wave =
        Math.sin(2 * Math.PI * hz * t) + (bright ? 0.18 * Math.sin(4 * Math.PI * hz * t) : 0);
      samples[first + i] += wave * envelope * volume;
    }
  }
  for (let c = 0; c < score.chords.length && c * bar < 32; c++) {
    score.chords[c].forEach((n, j) => note(n, c * bar + j * 0.025, bar * 0.95, 0.055));
    note(score.chords[c][0] - 12, c * bar, bar * 0.8, 0.07);
  }
  const step = score.texture === 'pulse' ? beat / 2 : beat;
  for (let i = 0; i * step < seconds - 1; i++) {
    const midi = score.melody[i % score.melody.length];
    if (midi !== null) {
      note(midi, i * step, step * 0.85, 0.1, score.texture === 'bright');
    }
  }
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const out = new DataView(buffer);
  const word = (offset: number, text: string) =>
    [...text].forEach((c, i) => out.setUint8(offset + i, c.charCodeAt(0)));
  word(0, 'RIFF');
  out.setUint32(4, buffer.byteLength - 8, true);
  word(8, 'WAVE');
  word(12, 'fmt ');
  out.setUint32(16, 16, true);
  out.setUint16(20, 1, true);
  out.setUint16(22, 1, true);
  out.setUint32(24, rate, true);
  out.setUint32(28, rate * 2, true);
  out.setUint16(32, 2, true);
  out.setUint16(34, 16, true);
  word(36, 'data');
  out.setUint32(40, samples.length * 2, true);
  samples.forEach((v, i) => out.setInt16(44 + i * 2, Math.round(Math.tanh(v) * 28000), true));
  return buffer;
}

/** Auditionable seed: the same scene can become a new interpretation. */
export const MORNING_SKETCH: MusicScore = {
  bpm: 76,
  chords: [
    [57, 60, 64],
    [53, 57, 60],
    [48, 52, 55],
    [55, 59, 62],
  ],
  melody: [69, null, 72, 71, 67, null, 64, 67, 69, 72, null, 76, 74, 71, 67, null],
  texture: 'soft',
};
