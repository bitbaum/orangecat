/** Small, pure text helpers shared by the generator and the renderer. */

/** "Kein *Prototyp* mehr" → [{text:'Kein '}, {text:'Prototyp', accent:true}, {text:' mehr'}]. */
export function accentParts(title: string): { text: string; accent: boolean }[] {
  const parts: { text: string; accent: boolean }[] = [];
  const re = /\*([^*]+)\*/g;
  let last = 0;
  for (let m = re.exec(title); m; m = re.exec(title)) {
    if (m.index > last) {
      parts.push({ text: title.slice(last, m.index), accent: false });
    }
    parts.push({ text: m[1]!, accent: true });
    last = m.index + m[0].length;
  }
  if (last < title.length) {
    parts.push({ text: title.slice(last), accent: false });
  }
  return parts.length ? parts : [{ text: title, accent: false }];
}

/** "Lead: the rest" → { lead: 'Lead', rest: 'the rest' }; a line without a short lead is all rest. */
export function leadParts(point: string): { lead?: string; rest: string } {
  const m = point.match(/^([^:]{2,40}):\s+(.+)$/);
  return m ? { lead: m[1]!, rest: m[2]! } : { rest: point };
}

/** The first sentence of a paragraph, cut at a word boundary to `max` characters. */
export function firstSentence(paragraph: string, max = 180): string {
  const clean = paragraph.replace(/\s+/g, ' ').trim();
  const sentence = clean.match(/^.+?[.!?](?=\s|$)/)?.[0] ?? clean;
  if (sentence.length <= max) {
    return sentence;
  }
  const cut = sentence.slice(0, max);
  return `${cut.slice(0, cut.lastIndexOf(' ')).replace(/[,;:—-]+$/, '')}…`;
}

/** Paragraphs of a body: split on blank lines. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}
