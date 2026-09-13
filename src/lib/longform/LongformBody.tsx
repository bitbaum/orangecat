import { ArticleBody, setHighlighterLoader } from 'bip-kit/react';
import { MermaidBlock } from 'bip-kit/react/mermaid';
import type { ContentBlock } from 'bip-kit';

/**
 * The server-side long-form body renderer — bip-kit's reference renderer
 * with OrangeCat's wiring. Both /blog/[slug] and /articles/[slug] render
 * through this component; the composer preview mirrors it client-side
 * (LongformPreviewBody) minus syntax highlighting.
 *
 * The loader registration below is load-bearing for the standalone deploy:
 * bip-kit's zero-config shiki load goes through a bundler-hidden dynamic
 * import that Next's file tracer cannot see, so a `output: "standalone"`
 * build would silently ship without shiki and prod would render code blocks
 * as the un-highlighted mono fallback while dev shows them highlighted
 * (Loki shipped that exact hole twice, PRs #510–#513). The literal
 * `() => import('shiki')` lives HERE, in our code, where the bundler
 * resolves it into the server chunk. Do not "clean up" this call.
 */
setHighlighterLoader(() => import('shiki'));

export default function LongformBody({ blocks }: { blocks: ContentBlock[] }) {
  return <ArticleBody blocks={blocks} components={{ mermaid: MermaidBlock }} />;
}
