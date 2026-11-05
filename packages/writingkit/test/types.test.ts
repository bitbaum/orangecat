import { WritingSession, type WritingOutcome } from '@bitbaum/writingkit';

/** Compile the installed public surface as an adapter would use it. */
export async function publicContract(): Promise<WritingOutcome> {
  const session = new WritingSession({ documentId: 'owned-draft', revision: 'etag-1' });
  const result = await session.run(
    async ({ signal, base }) => {
      signal.throwIfAborted();
      // @ts-expect-error A captured revision is immutable.
      base.revision = 'changed';
      return { text: 'Proposed text' };
    },
    proposal => {
      const text: string = proposal.text;
      void text;
    }
  );
  void session.run(
    async () => 'draft',
    // @ts-expect-error Async application leaves an await after the revision check.
    async () => {}
  );
  return result;
}
