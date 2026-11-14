import { CAT_DOOR, DOOR_EXAMPLES } from '@/config/cat-door';
import { HOME_FIRST_ANSWER_COPY } from '@/config/landing-page';
import { FirstAnswerDoor } from './FirstAnswerDoor';

/**
 * The Cat's door on the home page: the visitor's own sentence gets one real
 * answer before any account. Every other Cat door on the public site sent
 * the sentence straight to a sign-up form (2026-11-13 review, funnel#4),
 * while /feedback already answered strangers.
 */
export default function FirstAnswerSection() {
  return (
    <section
      aria-labelledby="first-answer-heading"
      className="border-t border-default bg-surface-page py-12 sm:py-20"
    >
      <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8">
        <h2
          id="first-answer-heading"
          className="font-heading text-2xl font-bold tracking-display text-fg-primary sm:text-4xl"
        >
          {CAT_DOOR.prompt}
        </h2>
        <p className="mb-0 mt-3 text-base text-fg-secondary sm:text-lg">
          {HOME_FIRST_ANSWER_COPY.subtitle}
        </p>
        <FirstAnswerDoor examples={DOOR_EXAMPLES} />
      </div>
    </section>
  );
}
