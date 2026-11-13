'use client';

import Card from '@/components/ui/Card';
import Button from '@/components/ui/Button';
import NewsletterSignup from '@/components/blog/NewsletterSignup';
import { BlogPost } from '@/lib/blog';
import { useBlogFilters } from './useBlogFilters';
import { BlogFilters } from './BlogFilters';
import { BlogPostCard } from './BlogPostCard';

interface BlogClientWrapperProps {
  posts: BlogPost[];
  featuredPost: BlogPost | null;
  tags: string[];
}

export default function BlogClientWrapper({
  posts,
  featuredPost: _featuredPost,
  tags,
}: BlogClientWrapperProps) {
  const {
    selectedTag,
    setSelectedTag,
    selectedTimeFilter,
    setSelectedTimeFilter,
    timeFilterOptions,
    filteredPosts,
    postsToShow,
    clearFilters,
  } = useBlogFilters(posts);

  return (
    <div className="max-w-6xl mx-auto">
      <BlogFilters
        tags={tags}
        selectedTag={selectedTag}
        setSelectedTag={setSelectedTag}
        selectedTimeFilter={selectedTimeFilter}
        setSelectedTimeFilter={setSelectedTimeFilter}
        timeFilterOptions={timeFilterOptions}
        filteredPosts={filteredPosts}
        clearFilters={clearFilters}
      />

      {postsToShow.length > 0 ? (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
          {postsToShow.map(post => (
            <BlogPostCard key={post.slug} post={post} />
          ))}
        </div>
      ) : (
        <div className="text-center py-16">
          <h3 className="text-lg font-semibold text-fg-primary mb-4">No posts found</h3>
          <p className="text-base text-fg-secondary mb-8">
            {selectedTag || selectedTimeFilter !== 'all'
              ? 'Try adjusting your filters or clear them to see all posts.'
              : 'We have more great content in development. Check back soon for our latest insights and updates.'}
          </p>
          {(selectedTag || selectedTimeFilter !== 'all') && (
            <Button onClick={clearFilters} variant="primary">
              View All Posts
            </Button>
          )}
        </div>
      )}

      <div className="mt-16">
        <Card className="p-8 text-center">
          <h2 className="text-2xl font-semibold mb-4">Stay Updated</h2>
          <p className="text-base text-fg-secondary mb-6">
            Subscribe to our newsletter for the latest updates and insights about Bitcoin funding
          </p>
          <div className="max-w-md mx-auto">
            <NewsletterSignup source="blog" />
          </div>
        </Card>
      </div>
    </div>
  );
}
