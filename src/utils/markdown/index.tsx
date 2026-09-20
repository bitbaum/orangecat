/**
 * Markdown rendering. Two halves, one entry point:
 *   ./inline  — what happens inside a line (bold, code spans, links, mentions)
 *   ./blocks  — what happens between lines (headings, quotes, fences, lists)
 *
 * Importers keep using `@/utils/markdown`; nothing below it is a public path.
 */
export { renderMarkdownToReact, renderInlineTokens } from './inline';
export { renderChatMarkdown } from './blocks';
