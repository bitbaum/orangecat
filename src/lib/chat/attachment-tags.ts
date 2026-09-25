/**
 * The tags a Cat chat message carries for what was attached — ONE definition,
 * read by the composer (writes them), the thread (turns them into chips), the
 * server (stores photos, names conversations) and the prompt (the model reads
 * them as-is).
 *
 *   <attached_file name="notes.md">…file text…</attached_file>
 *   <my_item type="product" id="…" title="…"/>
 *   <attached_image name="IMG_2231.jpg" ref="<user-id>/cat/<uuid>.webp"/>
 *
 * `ref` is the private storage path of a photo, added by the SERVER once it has
 * stored the pixels; the composer writes the tag without it. Before `ref`
 * existed the tag leaked verbatim into conversation titles, because only the
 * browser knew how to strip it.
 */

const attr = (v: string): string => v.replace(/"/g, "'").replace(/[<>]/g, '');

const FILE_BLOCK = /<attached_file name="([^"]*)">[\s\S]*?<\/attached_file>/g;
const IMAGE_TAG = /<attached_image name="([^"]*)"(?: ref="([^"]*)")?\/>/g;
const REF_TAG = /<my_item type="([^"]*)" id="[^"]*" title="([^"]*)"\/>/g;

export function imageTag(name: string, ref?: string): string {
  return ref
    ? `<attached_image name="${attr(name)}" ref="${attr(ref)}"/>`
    : `<attached_image name="${attr(name)}"/>`;
}

export function refTag(ref: { type: string; id: string; title: string }): string {
  return `<my_item type="${attr(ref.type)}" id="${attr(ref.id)}" title="${attr(ref.title)}"/>`;
}

export function fileBlockOpen(name: string): string {
  return `<attached_file name="${attr(name)}">\n`;
}

export interface ParsedUserMessage {
  text: string;
  files: Array<{ name: string }>;
  images: Array<{ name: string; ref: string | null }>;
  refs: Array<{ type: string; title: string }>;
}

/** The typed text, plus what was attached — for chips, titles and lookups. */
export function parseUserMessage(content: string): ParsedUserMessage {
  const files = [...content.matchAll(FILE_BLOCK)].map(m => ({ name: m[1] }));
  const images = [...content.matchAll(IMAGE_TAG)].map(m => ({ name: m[1], ref: m[2] ?? null }));
  const refs = [...content.matchAll(REF_TAG)].map(m => ({ type: m[1], title: m[2] }));
  const text = content.replace(FILE_BLOCK, '').replace(IMAGE_TAG, '').replace(REF_TAG, '').trim();
  return { text, files, images, refs };
}

/**
 * A human label for a message: its text, or — when it was only attachments —
 * what was attached. Used for conversation titles.
 */
export function messageLabel(content: string): string {
  const { text, files, images, refs } = parseUserMessage(content);
  if (text) {
    return text;
  }
  const names = [...images.map(i => i.name), ...files.map(f => f.name), ...refs.map(r => r.title)];
  return names.join(', ');
}

/**
 * A stored title made readable. Titles saved before they were labelled hold
 * the raw message cut at 60 chars — often mid-tag (`<attached_image name="x"/…`)
 * — so complete tags are replaced by their label and a cut-off one is dropped.
 */
export function readableTitle(title: string): string {
  return messageLabel(title)
    .replace(/<(attached_image|attached_file|my_item)\b[^>]*$/, '')
    .trim();
}

/**
 * The same message with each photo's storage path written into its tag, in
 * order. Tags beyond the refs given are left as they were.
 */
export function withImageRefs(content: string, refs: string[]): string {
  let i = 0;
  return content.replace(IMAGE_TAG, (whole, name: string) => {
    const ref = refs[i++];
    return ref ? imageTag(name, ref) : whole;
  });
}

/** Storage paths of every photo in these messages, newest message last. */
export function imageRefsIn(contents: string[]): string[] {
  return contents.flatMap(c =>
    parseUserMessage(c)
      .images.map(i => i.ref)
      .filter((r): r is string => Boolean(r))
  );
}
