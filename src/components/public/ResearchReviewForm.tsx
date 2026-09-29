'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Textarea } from '@/components/ui/Textarea';
import { API_ROUTES } from '@/config/api-routes';
import { REVIEW_LIMITS, REVIEW_VERDICTS, type ReviewVerdict } from '@/config/open-science';

const SELECT_CLASS =
  'w-full rounded-md border border-default bg-surface-base px-3 py-2 text-sm text-fg-primary';

interface ResearchReviewFormProps {
  researchId: string;
  outputLinks: string[];
}

/**
 * Post a review. There is no edit and no delete — the form says so before the
 * button, not after — so a reviewer knows the words are final when they send.
 */
export default function ResearchReviewForm({ researchId, outputLinks }: ResearchReviewFormProps) {
  const router = useRouter();
  const [verdict, setVerdict] = useState<ReviewVerdict>('supports');
  const [outputLink, setOutputLink] = useState('');
  const [body, setBody] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const tooShort = body.trim().length < REVIEW_LIMITS.MIN_BODY_LENGTH;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    try {
      const res = await fetch(API_ROUTES.RESEARCH_REVIEWS(researchId), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict, body, output_link: outputLink }),
      });
      const json = await res.json().catch(() => null);
      if (!res.ok) {
        toast.error(json?.error?.message ?? 'The review could not be posted. Please try again.');
        return;
      }
      toast.success('Review posted');
      setBody('');
      router.refresh();
    } catch {
      toast.error('The review could not be posted. Check your connection and try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-3 border-t border-subtle pt-4">
      <p className="text-sm font-medium text-fg-primary">Write a review</p>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="space-y-1 text-sm">
          <span className="text-fg-secondary">Your verdict</span>
          <select
            value={verdict}
            onChange={e => setVerdict(e.target.value as ReviewVerdict)}
            className={SELECT_CLASS}
          >
            {REVIEW_VERDICTS.map(v => (
              <option key={v.value} value={v.value}>
                {v.label}
              </option>
            ))}
          </select>
        </label>
        <label className="min-w-0 space-y-1 text-sm">
          <span className="text-fg-secondary">What you reviewed</span>
          <select
            value={outputLink}
            onChange={e => setOutputLink(e.target.value)}
            className={SELECT_CLASS}
          >
            <option value="">The project as a whole</option>
            {outputLinks.map(link => (
              <option key={link} value={link}>
                {link}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Textarea
        value={body}
        onChange={e => setBody(e.target.value)}
        rows={5}
        maxLength={REVIEW_LIMITS.MAX_BODY_LENGTH}
        placeholder="What did you check, how, and what did you find? Name anything you could not reproduce."
      />
      <p className="text-xs text-fg-tertiary">
        Public and permanent: a review cannot be edited or deleted. If you change your mind, post a
        new one.
      </p>
      <Button type="submit" disabled={submitting || tooShort}>
        {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
        Post review
      </Button>
    </form>
  );
}
