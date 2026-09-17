'use client';

import Link from 'next/link';
import { useAuth } from '@/hooks/useAuth';
import { ROUTES } from '@/config/routes';
import { API_ROUTES } from '@/config/api-routes';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { PlayCircle, Radio, Video, Mic2, Share2, Users, Clock } from 'lucide-react';
import ProfileShare from '@/components/sharing/ProfileShare';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { waitlistSchema, type WaitlistFormData } from '@/lib/validation/social';
import { toast } from 'sonner';
import { apiErrorMessage } from '@/lib/api/errorMessage';

export default function ChannelComingSoonPage() {
  const { user, profile } = useAuth();
  const [showShare, setShowShare] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors: formErrors },
  } = useForm<WaitlistFormData>({
    resolver: zodResolver(waitlistSchema),
    defaultValues: { email: profile?.email || '' },
  });

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-lg bg-surface-raised border border-subtle text-fg-primary shadow-sm">
            <PlayCircle className="w-8 h-8" />
          </div>
          <h1 className="mt-4 font-heading tracking-display text-3xl sm:text-4xl font-bold text-fg-primary">
            Stream anything. Get paid directly.
          </h1>
          <p className="mt-3 text-fg-secondary max-w-2xl mx-auto">
            Share videos, audio, and live sessions. Build your audience, accept Bitcoin payments,
            and keep your creative freedom. We respect rights and make support simple.
          </p>
        </div>

        {/* Highlights */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Video className="w-5 h-5 text-fg-secondary" />
                <div>
                  <div className="font-semibold">Video uploads</div>
                  <div className="text-base text-fg-secondary">Share long-form and shorts</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Mic2 className="w-5 h-5 text-fg-secondary" />
                <div>
                  <div className="font-semibold">Audio & podcasts</div>
                  <div className="text-base text-fg-secondary">Episodes, clips, and more</div>
                </div>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-5">
              <div className="flex items-center gap-3">
                <Radio className="w-5 h-5 text-fg-secondary" />
                <div>
                  <div className="font-semibold">Live streaming</div>
                  <div className="text-base text-fg-secondary">Connect with your audience</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Rights & Safety */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold text-fg-primary mb-2">Rights & Safety</h3>
            <p className="text-base text-fg-primary">
              Use original or licensed content, or ensure your use is transformative under fair use.
              We respect artists and owners: we will offer clear licensing metadata, an easy
              takedown process, and fair dispute handling. Our goal is to make direct creator
              support easy while protecting rights holders.
            </p>
          </CardContent>
        </Card>

        {/* CTA Card */}
        <Card className="border-default bg-surface-base/90 dark:bg-surface-base/90">
          <CardContent className="p-6">
            <div className="flex flex-col md:flex-row items-center justify-between gap-4">
              <div className="text-center md:text-left">
                <h3 className="text-lg font-semibold text-fg-primary">Be the first to try it</h3>
                <p className="text-base text-fg-secondary">
                  Invite friends, build your audience, and get notified when we launch.
                </p>
                <form
                  className="mt-3 flex items-center gap-2"
                  onSubmit={handleSubmit(async (data: WaitlistFormData) => {
                    try {
                      setSubmitting(true);
                      const res = await fetch(API_ROUTES.WAITLIST, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                          email: data.email,
                          source: 'channel_page',
                          referrer: document.referrer,
                        }),
                      });
                      const json = await res.json();
                      if (!res.ok || !json.success) {
                        throw new Error(apiErrorMessage(json, 'Failed to subscribe'));
                      }
                      toast.success('We will notify you when Channel goes live');
                      reset({ email: profile?.email || '' });
                    } catch (e) {
                      toast.error(e instanceof Error ? e.message : 'Failed to subscribe');
                    } finally {
                      setSubmitting(false);
                    }
                  })}
                >
                  <div className="relative">
                    <Input
                      type="email"
                      placeholder="your@email.com"
                      className={`pr-28 w-72 max-w-full${formErrors.email ? ' border-status-negative' : ''}`}
                      {...register('email')}
                    />
                    <Button
                      type="submit"
                      className="absolute right-1 top-1/2 -translate-y-1/2 h-8 px-3"
                      disabled={submitting}
                    >
                      Notify me
                    </Button>
                  </div>
                </form>
              </div>
              <div className="flex flex-col-reverse sm:flex-row items-center gap-2 relative">
                <Link href={ROUTES.DASHBOARD.PEOPLE}>
                  <Button variant="outline">
                    <Users className="w-4 h-4 mr-2" /> Discover People
                  </Button>
                </Link>
                <div className="relative">
                  <Button variant="accent" onClick={() => setShowShare(!showShare)}>
                    <Share2 className="w-4 h-4 mr-2" /> Share My Profile
                  </Button>
                  {showShare && (
                    <div className="absolute right-0 mt-2 z-50">
                      <ProfileShare
                        username={profile?.username || user?.id || ''}
                        profileName={profile?.name || profile?.username || 'My Profile'}
                        profileBio={profile?.bio || undefined}
                        onClose={() => setShowShare(false)}
                      />
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Roadmap */}
        <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-4">
          {[
            {
              title: 'Phase 1 — Uploads',
              desc: 'Upload videos and audio, with shareable links, Bitcoin tipping, and basic analytics.',
            },
            {
              title: 'Phase 2 — Live',
              desc: 'Live streaming with basic chat and replays.',
            },
            {
              title: 'Phase 3 — Monetize',
              desc: 'Paywalled content, subscriptions, revenue splits, creator tools.',
            },
          ].map((item, _idx) => (
            <Card key={item.title}>
              <CardContent className="p-5">
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-fg-secondary mt-0.5" />
                  <div>
                    <div className="font-semibold">{item.title}</div>
                    <div className="text-base text-fg-secondary">{item.desc}</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
