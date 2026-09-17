'use client';

/**
 * The screen that hands the keys over.
 *
 * ADR-0005 D8. Everything up to here produces a link; this is where the link
 * reaches a person. It is deliberately the ONLY thing on the page — a copy
 * button, a message already written, and one tap to the app the creator
 * actually uses. The failure this exists to prevent is not an error: it is a
 * link created on Tuesday and never sent, because sending it required
 * composing a message about a thing that is hard to explain.
 *
 * The message is prewritten for exactly that reason. It says three things a
 * recipient needs before they will tap an unfamiliar link: who it is from,
 * what it is, and that it already belongs to them.
 */

import { useState } from 'react';
import { Check, Copy, Mail, MessageCircle, Send, ExternalLink } from 'lucide-react';
import Link from 'next/link';
import Button from '@/components/ui/Button';
import { Card, CardContent } from '@/components/ui/Card';
import { APP_NAME } from '@/config/brand';
import { logger } from '@/utils/logger';

export function ShareClaim({
  recipientName,
  claimUrl,
  pageUrl,
  thingName,
}: {
  recipientName: string;
  /** Absolute URL of the claim link — the credential that lets them take it over. */
  claimUrl: string;
  /** Absolute URL of the public page, if something was set up alongside the person. */
  pageUrl?: string | null;
  /** What was set up, e.g. "Art studio". Omitted when it is a person alone. */
  thingName?: string | null;
}) {
  const [copied, setCopied] = useState<'link' | 'message' | null>(null);

  const firstName = recipientName.trim().split(' ')[0] || recipientName;
  const message = thingName
    ? `Hi ${firstName} — I set up a page for ${thingName} on ${APP_NAME}. It's yours, not mine; just tap to take it over: ${claimUrl}`
    : `Hi ${firstName} — I set up a page for you on ${APP_NAME}. It's yours; just tap to take it over: ${claimUrl}`;

  const copy = async (value: string, which: 'link' | 'message') => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(which);
      setTimeout(() => setCopied(null), 2000);
    } catch (error) {
      logger.error('Clipboard write failed', error, 'ShareClaim');
    }
  };

  // Channels people actually hand things over on. `wa.me` and Signal both take
  // the whole message; mail splits it into a subject and a body.
  const encoded = encodeURIComponent(message);
  const channels = [
    { name: 'WhatsApp', href: `https://wa.me/?text=${encoded}`, icon: MessageCircle },
    { name: 'Signal', href: `https://signal.me/#p/?text=${encoded}`, icon: Send },
    {
      name: 'Email',
      href: `mailto:?subject=${encodeURIComponent(
        thingName ? `${thingName} on ${APP_NAME}` : `Your page on ${APP_NAME}`
      )}&body=${encoded}`,
      icon: Mail,
    },
  ];

  return (
    <div className="mx-auto max-w-xl px-4 py-12 sm:px-6">
      <p className="text-center text-xs font-medium uppercase tracking-caps text-fg-muted">
        Ready for {firstName}
      </p>
      <h1 className="mt-3 text-center font-heading text-2xl font-semibold tracking-display text-fg-primary">
        {thingName ? `${thingName} is set up` : `${recipientName}’s page is set up`}
      </h1>
      <p className="mt-2 text-center text-sm text-fg-secondary">
        It already belongs to {firstName}. Send them the link and they take it over — nothing here
        can receive funds until they do.
      </p>

      <Card variant="elevated" className="mt-8">
        <CardContent className="space-y-5 pt-6">
          <div>
            <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">Their link</p>
            <div className="mt-2 flex items-center gap-2">
              <code className="min-w-0 flex-1 truncate rounded-md border border-default bg-surface-page px-3 py-2 text-xs text-fg-secondary">
                {claimUrl}
              </code>
              <Button variant="outline" size="sm" onClick={() => copy(claimUrl, 'link')}>
                {copied === 'link' ? (
                  <Check className="h-3.5 w-3.5" />
                ) : (
                  <Copy className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
            <p className="mt-1.5 text-xs text-fg-muted">
              Anyone with this link can take it over, so send it to {firstName} directly.
            </p>
          </div>

          <div>
            <p className="text-xs font-medium uppercase tracking-caps text-fg-muted">Message</p>
            <p className="mt-2 rounded-lg border border-default bg-surface-page p-3 text-sm text-fg-secondary">
              {message}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {channels.map(channel => (
                <a key={channel.name} href={channel.href} target="_blank" rel="noopener noreferrer">
                  <Button variant="outline" size="sm" className="gap-1.5">
                    <channel.icon className="h-3.5 w-3.5" />
                    {channel.name}
                  </Button>
                </a>
              ))}
              <Button variant="ghost" size="sm" onClick={() => copy(message, 'message')}>
                {copied === 'message' ? (
                  <Check className="mr-1.5 h-3.5 w-3.5" />
                ) : (
                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                )}
                Copy message
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {pageUrl && (
        <p className="mt-6 text-center text-sm">
          <Link
            href={pageUrl}
            className="inline-flex items-center gap-1.5 text-fg-secondary underline underline-offset-2 hover:text-fg-primary"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            See the page as {firstName} will
          </Link>
        </p>
      )}
    </div>
  );
}
