import path from 'path';
import { readCollection, readEntry, type CollectionEntry } from 'bip-kit/node';
import type { ContentBlock, TocEntry } from 'bip-kit';

/**
 * The studio blog: `content/blog/*.md`, read by bip-kit's collection reader
 * (frontmatter, the same markdown normalization as community articles, typed
 * blocks). A malformed `date:` fails the build and names the file; a post
 * with `published: false` is left out.
 */
export interface BlogPost {
  slug: string;
  title: string;
  excerpt: string;
  /** YYYY-MM-DD */
  date: string;
  readTime: string;
  tags: string[];
  featured: boolean;
  author: string;
}

export interface BlogPostWithBody extends BlogPost {
  blocks: ContentBlock[];
  toc: TocEntry[];
}

const BLOG_POSTS_PATH = path.join(process.cwd(), 'content/blog');

function toPost(entry: CollectionEntry): BlogPost {
  const readTime = entry.meta.readTime;
  return {
    slug: entry.slug,
    title: entry.title,
    excerpt: entry.summary,
    date: entry.date,
    readTime:
      typeof readTime === 'string' && readTime ? readTime : `${entry.readingMinutes} min read`,
    tags: entry.tags,
    featured: entry.meta.featured === 'true',
    author: entry.author ?? 'OrangeCat Team',
  };
}

/** Published posts, newest first. */
export function getPublishedPosts(): BlogPost[] {
  return readCollection(BLOG_POSTS_PATH).map(toPost);
}

export function getBlogPostSlugs(): string[] {
  return getPublishedPosts().map(post => post.slug);
}

/** One published post with its parsed body, or null for an unknown slug. */
export function getBlogPost(slug: string): BlogPostWithBody | null {
  const entry = readEntry(BLOG_POSTS_PATH, slug);
  return entry ? { ...toPost(entry), blocks: entry.blocks, toc: entry.toc } : null;
}

export function getFeaturedPost(): BlogPost | null {
  return getPublishedPosts().find(post => post.featured) ?? null;
}

export function getAllTags(): string[] {
  return Array.from(new Set(getPublishedPosts().flatMap(post => post.tags))).sort();
}
