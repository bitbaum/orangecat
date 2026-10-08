/** One section of a room: an anchor for the index, a title, and where it comes from. */
export function RoomSection({
  id,
  title,
  note,
  children,
}: {
  id: string;
  title: string;
  /** A short line under the title saying where this section comes from. */
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className="mt-12 scroll-mt-20 border-t border-border-subtle pt-8">
      <h2 className="font-heading text-xl font-semibold tracking-display text-fg-primary">
        {title}
      </h2>
      {note && <p className="mt-1 text-xs text-fg-muted">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
