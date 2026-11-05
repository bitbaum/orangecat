/** Text handed to a new article by a sister product (`?import=`). */
export interface ArticlePrefill {
  title: string;
  excerpt?: string;
  body: string;
  /** The site it came from, named in the notice above the editor. */
  host: string;
}

/** Says where an imported article came from and that it is now the writer's to change. */
export default function ImportNotice({ host }: { host: string }) {
  return (
    <p
      role="status"
      className="mb-5 rounded-md border border-default bg-surface-raised px-3 py-2.5 text-sm text-fg-secondary"
    >
      Brought over from {host}. Change anything you like, then publish it here too.
    </p>
  );
}
