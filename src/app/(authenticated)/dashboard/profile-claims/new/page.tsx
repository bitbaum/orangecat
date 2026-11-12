'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Plus, Trash2, Copy, Check } from 'lucide-react';
import EntityListShell from '@/components/entity/EntityListShell';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Textarea } from '@/components/ui/Textarea';
import { Button } from '@/components/ui/Button';
import { useCopyToClipboard } from '@/hooks/useCopyToClipboard';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import { logger } from '@/utils/logger';

interface SocialLinkField {
  platform: string;
  value: string;
}

const EMPTY_LINK: SocialLinkField = { platform: '', value: '' };

export default function NewProfileClaimPage() {
  const router = useRouter();
  const { copied, copy } = useCopyToClipboard();

  const [name, setName] = useState('');
  const [suggestedUsername, setSuggestedUsername] = useState('');
  const [bio, setBio] = useState('');
  const [avatarUrl, setAvatarUrl] = useState('');
  const [website, setWebsite] = useState('');
  const [links, setLinks] = useState<SocialLinkField[]>([EMPTY_LINK]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [claimUrl, setClaimUrl] = useState<string | null>(null);

  const updateLink = (index: number, field: keyof SocialLinkField, value: string) => {
    setLinks(prev => prev.map((link, i) => (i === index ? { ...link, [field]: value } : link)));
  };

  const removeLink = (index: number) => {
    setLinks(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error('Give the profile a name first.');
      return;
    }

    setIsSubmitting(true);
    try {
      const socialLinks = links
        .filter(link => link.platform.trim() && link.value.trim())
        .map(link => ({ platform: link.platform.trim(), value: link.value.trim() }));

      const res = await fetch(API_ROUTES.PROFILE_CLAIMS.BASE, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          bio: bio.trim() || undefined,
          avatarUrl: avatarUrl.trim() || undefined,
          website: website.trim() || undefined,
          suggestedUsername: suggestedUsername.trim() || undefined,
          socialLinks: socialLinks.length ? socialLinks : undefined,
        }),
      });
      const body = await res.json();
      if (!res.ok || !body.success) {
        toast.error(body?.error?.message || 'Could not create the claim link.');
        return;
      }

      const url = `${window.location.origin}${body.data.claimUrl}`;
      setClaimUrl(url);
      toast.success('Claim link ready — send it to them.');
    } catch (error) {
      logger.error('Failed to create profile claim', error, 'ProfileClaims');
      toast.error('Something went wrong. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (claimUrl) {
    return (
      <EntityListShell title="Profile claim created" description="Send this link to them.">
        <Card variant="elevated" className="max-w-xl">
          <CardContent className="space-y-4 pt-6">
            <p className="text-sm text-fg-secondary">
              This link shows {name} a preview of the profile you drafted and lets them claim it
              with their own account. It stays private to them until they do.
            </p>
            <div className="flex items-center gap-2 rounded-lg border border-border-subtle bg-surface-page p-3">
              <code className="flex-1 truncate text-sm text-fg-primary">{claimUrl}</code>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => copy(claimUrl)}
                aria-label="Copy claim link"
              >
                {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
              </Button>
            </div>
            <div className="flex gap-2">
              <Button variant="ghost" onClick={() => router.push(ROUTES.DASHBOARD.PROFILE_CLAIMS)}>
                View all claims
              </Button>
              <Button
                variant="ghost"
                onClick={() => router.push(ROUTES.DASHBOARD.PROFILE_CLAIMS_NEW)}
              >
                Draft another
              </Button>
            </div>
          </CardContent>
        </Card>
      </EntityListShell>
    );
  }

  return (
    <EntityListShell
      title="Draft a profile for someone"
      description="Fill in what you know — they'll see a preview and can claim it with their own account."
    >
      <form onSubmit={handleSubmit} className="max-w-xl space-y-6">
        <Card>
          <CardContent className="space-y-4 pt-6">
            <Input
              label="Name"
              required
              value={name}
              onChange={e => setName(e.target.value)}
              placeholder="How they're known publicly"
            />
            <Input
              label="Suggested username"
              value={suggestedUsername}
              onChange={e => setSuggestedUsername(e.target.value)}
              placeholder="lila"
              description="They can change this. Left blank, OrangeCat assigns one automatically."
            />
            <Textarea
              label="Bio"
              value={bio}
              onChange={e => setBio(e.target.value)}
              placeholder="A couple of sentences for their profile"
              rows={4}
            />
            <Input
              label="Avatar image URL"
              value={avatarUrl}
              onChange={e => setAvatarUrl(e.target.value)}
              placeholder="https://…"
            />
            <Input
              label="Website"
              value={website}
              onChange={e => setWebsite(e.target.value)}
              placeholder="https://…"
            />
          </CardContent>
        </Card>

        <Card>
          <CardContent className="space-y-3 pt-6">
            <p className={'text-sm font-medium text-fg-primary'}>Links</p>
            {links.map((link, index) => (
              <div key={index} className="flex items-end gap-2">
                <Input
                  label={index === 0 ? 'Platform' : undefined}
                  value={link.platform}
                  onChange={e => updateLink(index, 'platform', e.target.value)}
                  placeholder="Instagram"
                  className="w-32 flex-none"
                />
                <Input
                  label={index === 0 ? 'Link or handle' : undefined}
                  value={link.value}
                  onChange={e => updateLink(index, 'value', e.target.value)}
                  placeholder="https://…"
                  className="flex-1"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeLink(index)}
                  aria-label="Remove link"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setLinks(prev => [...prev, { ...EMPTY_LINK }])}
            >
              <Plus className="mr-1 h-4 w-4" />
              Add another link
            </Button>
          </CardContent>
        </Card>

        <Button type="submit" size="lg" isLoading={isSubmitting}>
          Create claim link
        </Button>
      </form>
    </EntityListShell>
  );
}
