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

/*
 * No backtracking regular expressions over slide text: it is user input, and
 * a pattern like /[^.]+[.]+(?=\s|$)/ runs in polynomial time on a crafted
 * string (CodeQL js/polynomial-redos). These are plain linear scans instead.
 */

/** Collapse runs of whitespace to single spaces, linearly. */
export function squash(text: string): string {
  return text.split(/\s/).filter(Boolean).join(' ');
}

/** Sentences, each ending at . ! or ? followed by a space or the end. Linear. */
export function sentences(text: string): string[] {
  const clean = squash(text);
  const out: string[] = [];
  let start = 0;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i];
    if ((c === '.' || c === '!' || c === '?') && (i + 1 === clean.length || clean[i + 1] === ' ')) {
      out.push(clean.slice(start, i + 1).trim());
      start = i + 2;
    }
  }
  const tail = clean.slice(start).trim();
  if (tail) {
    out.push(tail);
  }
  return out.filter(Boolean);
}

/** "Lead: the rest" → { lead: 'Lead', rest: 'the rest' }; a line without a short lead is all rest. */
export function leadParts(point: string): { lead?: string; rest: string } {
  const colon = point.indexOf(': ');
  if (colon < 2 || colon > 40) {
    return { rest: point };
  }
  const rest = point.slice(colon + 2).trim();
  return rest ? { lead: point.slice(0, colon), rest } : { rest: point };
}

/** The first sentence of a paragraph, cut at a word boundary to `max` characters. */
export function firstSentence(paragraph: string, max = 180): string {
  const clean = squash(paragraph);
  const sentence = sentences(clean)[0] ?? clean;
  if (sentence.length <= max) {
    return sentence;
  }
  const cut = sentence.slice(0, max);
  let end = cut.lastIndexOf(' ');
  while (end > 0 && ',;:—-'.includes(cut[end - 1]!)) {
    end--;
  }
  return `${cut.slice(0, end)}…`;
}

/** Paragraphs of a body: split on blank lines. */
export function paragraphs(body: string): string[] {
  return body
    .split(/\n\s*\n/)
    .map(p => p.trim())
    .filter(Boolean);
}
