'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { ArticleBody } from 'bip-kit/react';
import { MermaidBlock } from 'bip-kit/react/mermaid';
import { parseLongform } from './parse';

/**
 * Client-side live preview for the composer: the SAME parse + reference
 * renderer as the published page, so what the author sees is what readers
 * get. The one honest difference: no shiki here (no highlighter loader is
 * registered in the client bundle), so code blocks preview in the clean
 * mono fallback and gain highlighting on publish — a styling upgrade, never
 * a content difference.
 *
 * ArticleBody is an async server component by design (it pre-awaits the
 * optional peers); with no peers registered it resolves immediately, so on
 * the client we call it as a function and render the resolved tree.
 */
export default function LongformPreviewBody({ body }: { body: string }) {
  const [tree, setTree] = useState<ReactNode>(null);

  useEffect(() => {
    let live = true;
    const { blocks } = parseLongform(body);
    void Promise.resolve(
      ArticleBody({ blocks, components: { mermaid: MermaidBlock }, lightbox: false })
    ).then(node => {
      if (live) {
        setTree(node);
      }
    });
    return () => {
      live = false;
    };
  }, [body]);

  return tree;
}
