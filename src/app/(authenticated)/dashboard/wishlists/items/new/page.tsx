'use client';

/**
 * Add Wishlist Item
 *
 * /dashboard/wishlists/items/new?wishlist_id=<id>
 *
 * The wishlist detail page has always linked here ("Add Item"), but the page
 * never existed — the URL fell through to the [itemId] route and 404'd.
 * Minimal form → POST /api/wishlists/[id]/items → back to the wishlist.
 */

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import Input from '@/components/ui/Input';
import Textarea from '@/components/ui/Textarea';
import { Label } from '@/components/ui/label';
import { Breadcrumb } from '@/components/ui/Breadcrumb';
import Loading from '@/components/Loading';
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { API_ROUTES } from '@/config/api-routes';
import { wishlistItemSchema } from '@/lib/validation';
import { apiErrorMessage } from '@/lib/api/errorMessage';

function AddWishlistItemForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const wishlistId = searchParams.get('wishlist_id');

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [externalUrl, setExternalUrl] = useState('');
  const [targetAmountBtc, setTargetAmountBtc] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const wishlistMeta = ENTITY_REGISTRY['wishlist'];
  const backHref = wishlistId ? `${wishlistMeta.basePath}/${wishlistId}` : wishlistMeta.basePath;

  if (!wishlistId) {
    return (
      <div className="text-center py-12">
        <p className="text-fg-secondary mb-4">No wishlist selected.</p>
        <Button onClick={() => router.push(wishlistMeta.basePath)}>Back to Wishlists</Button>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const parsed = wishlistItemSchema.safeParse({
      title: title.trim(),
      description: description.trim() || null,
      external_url: externalUrl.trim() || null,
      target_amount_btc: Number(targetAmountBtc),
    });
    if (!parsed.success) {
      toast.error(parsed.error.issues[0]?.message || 'Please check the form');
      return;
    }

    setSubmitting(true);
    try {
      const response = await fetch(API_ROUTES.WISHLISTS.ITEMS(wishlistId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(parsed.data),
      });
      const data = await response.json();
      if (!response.ok) {
        throw new Error(apiErrorMessage(data, 'Failed to add item'));
      }
      toast.success('Item added to your wishlist');
      router.push(backHref);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to add item');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <Breadcrumb
        items={[
          { label: wishlistMeta.namePlural, href: wishlistMeta.basePath },
          { label: 'Add Item' },
        ]}
        className="mb-6"
      />
      <Card>
        <CardHeader>
          <CardTitle>Add Item</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="space-y-1.5">
              <Label htmlFor="title">Title</Label>
              <Input
                id="title"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="What do you wish for?"
                required
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="description">Description (optional)</Label>
              <Textarea
                id="description"
                value={description}
                onChange={e => setDescription(e.target.value)}
                placeholder="Details, size, color, why you want it…"
                rows={3}
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="external_url">Link (optional)</Label>
              <Input
                id="external_url"
                type="url"
                value={externalUrl}
                onChange={e => setExternalUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="target_amount_btc">Target amount (BTC)</Label>
              <Input
                id="target_amount_btc"
                type="number"
                step="0.00000001"
                min="0"
                value={targetAmountBtc}
                onChange={e => setTargetAmountBtc(e.target.value)}
                placeholder="0.001"
                required
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(backHref)}
                disabled={submitting}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Add Item
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

export default function AddWishlistItemPage() {
  return (
    <Suspense fallback={<Loading message="Loading..." />}>
      <AddWishlistItemForm />
    </Suspense>
  );
}
