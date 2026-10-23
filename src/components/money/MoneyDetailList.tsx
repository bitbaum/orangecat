/**
 * The label/value list used wherever money is summarised — the review card
 * before sending, and the receipt after.
 *
 * Those two surfaces must look like the same object seen twice, because that
 * resemblance is what lets someone confirm at a glance that what they approved
 * is what happened. Sharing the markup is how that stays true.
 *
 * Rows with no value are dropped rather than rendered blank: an empty "For —"
 * row invites the reader to wonder what went missing.
 */

export interface MoneyDetailRow {
  label: string;
  value: React.ReactNode | null | undefined;
}

export function MoneyDetailList({
  rows,
  className,
}: {
  rows: readonly MoneyDetailRow[];
  className?: string;
}) {
  const visible = rows.filter(
    row => row.value !== null && row.value !== undefined && row.value !== ''
  );
  if (visible.length === 0) {
    return null;
  }

  return (
    <dl
      className={`w-full space-y-2 rounded-md border border-default bg-surface-raised/40 px-4 py-3 text-left text-sm ${className ?? ''}`}
    >
      {visible.map(row => (
        <div key={row.label} className="flex items-baseline justify-between gap-3">
          <dt className="shrink-0 text-fg-tertiary">{row.label}</dt>
          <dd className="min-w-0 truncate text-right font-medium text-fg-primary">{row.value}</dd>
        </div>
      ))}
    </dl>
  );
}
