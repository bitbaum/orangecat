'use client';

import { useEffect, useRef, useState } from 'react';
import { Cat, Send, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import Input from '@/components/ui/Input';
import { PageHeading } from '@/components/layout/PageHeading';
import { API_ROUTES } from '@/config/api-routes';

interface Exchange {
  message: string;
  kind: 'question' | 'feedback';
  /** Null when Cat couldn't answer — the message still reached the team. */
  answer: string | null;
}

const MAX_MESSAGE_CHARS = 2000;

/**
 * Public Ask-Cat / feedback surface. Deliberately the simplest form on the
 * site: one box, one button, no account, no required extras. Questions get an
 * immediate answer from Cat; feedback gets a real acknowledgement. Exchanges
 * stack up on the page like a conversation so follow-up questions feel natural.
 */
export function FeedbackClient() {
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [exchanges, setExchanges] = useState<Exchange[]>([]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  // A report that arrives written (an error's "Report this" carries the
  // failure in ?message=) lands in the box, so Send is one tap. Read on the
  // client after mount: this page is static and useSearchParams would make
  // it wait on the request.
  const [prefilled, setPrefilled] = useState(false);
  useEffect(() => {
    const given = new URLSearchParams(window.location.search).get('message')?.trim();
    if (given) {
      setMessage(given.slice(0, MAX_MESSAGE_CHARS));
      setPrefilled(true);
    }
  }, []);

  const canSubmit = message.trim().length > 0 && !isSubmitting;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!canSubmit) {
      return;
    }
    const text = message.trim();
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await fetch(API_ROUTES.FEEDBACK, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: text,
          email: email.trim() || undefined,
          page_path: '/feedback',
        }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        setError(
          res.status === 429
            ? 'The Cat needs a short breather — please try again in a few minutes.'
            : 'Something went wrong sending your message. Please try again.'
        );
        return;
      }
      const data = (json?.data ?? {}) as Partial<Exchange>;
      setExchanges(prev => [
        ...prev,
        {
          message: text,
          kind: data.kind === 'question' ? 'question' : 'feedback',
          answer: typeof data.answer === 'string' ? data.answer : null,
        },
      ]);
      setMessage('');
      textareaRef.current?.focus();
    } catch {
      setError('Could not reach the server. Please check your connection and try again.');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-surface-page">
      <div className="mx-auto max-w-2xl px-4 py-12 sm:px-6 lg:py-16">
        <div className="text-center">
          <span className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-accent-warm/10 text-accent-warm">
            <Cat className="h-6 w-6" aria-hidden />
          </span>
          <PageHeading className="mt-4">Ask the Cat anything</PageHeading>
          <p className="mx-auto mt-3 max-w-lg text-fg-secondary">
            Questions, problems, ideas — one box, no account needed. The Cat answers right away, and
            a human reads every single message.
          </p>
        </div>

        {/* Past exchanges, newest at the bottom like a chat. */}
        {exchanges.length > 0 && (
          <ul className="mt-10 space-y-6" aria-label="Your conversation">
            {exchanges.map((ex, i) => (
              <li key={i} className="space-y-3">
                <div className="ml-auto w-fit max-w-[85%] rounded-lg bg-surface-raised px-4 py-3 text-sm text-fg-primary">
                  {ex.message}
                </div>
                {ex.answer ? (
                  <div className="flex max-w-[95%] items-start gap-3">
                    <span className="mt-1 flex h-7 w-7 flex-shrink-0 items-center justify-center rounded-md bg-accent-warm/10 text-accent-warm">
                      <Cat className="h-4 w-4" aria-hidden />
                    </span>
                    <div className="rounded-lg border border-default bg-surface-base px-4 py-3 text-sm leading-relaxed text-fg-primary whitespace-pre-line">
                      {ex.answer}
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-sm text-fg-secondary">
                    <CheckCircle2 className="h-4 w-4 text-status-positive" aria-hidden />
                    Got it — your message reached the team, and someone will read it.
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}

        <form onSubmit={handleSubmit} className="mt-10 space-y-4" aria-label="Send a message">
          <Textarea
            ref={textareaRef}
            label={
              exchanges.length > 0
                ? 'Anything else?'
                : prefilled
                  ? 'What happened — already written, just send it'
                  : 'Your question or feedback'
            }
            placeholder="e.g. How do I get paid without a bank account? — or: the signup button is broken on my phone"
            value={message}
            onChange={e => setMessage(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.currentTarget.form?.requestSubmit();
              }
            }}
            rows={4}
            maxLength={MAX_MESSAGE_CHARS}
            required
            autoFocus
          />

          <Input
            type="email"
            label="Email (optional)"
            description="Only if you'd like a human follow-up — never required."
            placeholder="you@example.com"
            value={email}
            onChange={e => setEmail(e.target.value)}
            maxLength={200}
            autoComplete="email"
          />

          {error && (
            <p role="alert" className="text-sm text-status-negative">
              {error}
            </p>
          )}

          <div className="flex items-center justify-between gap-4">
            <span className="text-xs text-fg-tertiary">
              {message.length}/{MAX_MESSAGE_CHARS}
            </span>
            <Button
              type="submit"
              variant="accent"
              size="lg"
              disabled={!canSubmit}
              isLoading={isSubmitting}
              className="gap-2"
            >
              {!isSubmitting && <Send className="h-4 w-4" aria-hidden />}
              {isSubmitting ? 'Asking the Cat…' : 'Send'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
