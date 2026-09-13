/**
 * Longform prose for the Studio — a chapter, a scene, an essay.
 *
 * Deliberately NOT writing-engine's draftArticle: that one writes a publishable
 * ARTICLE (headline, "## " sections, a closing thought that invites replies),
 * which is the wrong shape for fiction and the reason a novel chapter drafted
 * through it came back reading like a blog post. Revision, by contrast, DOES go
 * through the existing engine (writing-revise), because revising the author's
 * own text in the author's own voice is exactly what that already does.
 *
 * Created: 2026-09-13
 */

import { callPlatformJson, parseJsonLoose } from '@/services/cat/platform-llm';
import { logger } from '@/utils/logger';

/** Long enough for a real chapter, short enough to stay inside the free pool. */
const MAX_TOKENS = 3500;

const SYSTEM = `You write prose for an author working in their own studio.

They give you a brief. You return the piece itself — a chapter, a scene, an
essay, a monologue, whatever the brief describes.

RULES
- Write the thing. No preamble, no notes, no "here is your chapter".
- Match the form the brief asks for. Fiction gets scene and voice, not
  subheadings. An essay gets an argument, not a plot.
- Plain Markdown only: paragraphs, and a "## " heading ONLY if the form
  genuinely takes headings.
- Do not summarise at the end, and do not address the reader unless the brief
  says the piece does.
- Invent nothing about real people or real events.

Output ONLY JSON: {"title":"a short working title","text":"the piece in markdown"}.`;

export interface WritingDraft {
  title: string;
  text: string;
}

export async function draftStudioWriting(brief: string): Promise<WritingDraft | null> {
  const raw = await callPlatformJson(SYSTEM, `BRIEF:\n"""\n${brief.trim()}\n"""\n\nWrite it.`, {
    temperature: 0.8,
    maxTokens: MAX_TOKENS,
    longform: true,
  });

  const parsed = parseJsonLoose<{ title?: unknown; text?: unknown }>(raw);
  const text = typeof parsed?.text === 'string' ? parsed.text.trim() : '';
  if (!text) {
    logger.warn('Studio writing draft came back empty', {}, 'Studio');
    return null;
  }
  const title = typeof parsed?.title === 'string' ? parsed.title.trim() : '';
  return { title: title.slice(0, 120) || 'Untitled', text };
}
