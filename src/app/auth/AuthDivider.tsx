/**
 * "or …" between two ways in. The rules sit beside the words in a flex row,
 * so nothing runs behind the label and no background has to mask it — a
 * translucent mask let the line strike through the words in light mode.
 * The same shape as @bitbaum/accountkit's auth divider.
 */
export function AuthDivider({ label, className = '' }: { label: string; className?: string }) {
  return (
    <div
      className={`flex items-center gap-3 text-xs uppercase tracking-wider text-fg-tertiary ${className}`.trim()}
    >
      <span aria-hidden="true" className="flex-1 border-t border-default" />
      <span>{label}</span>
      <span aria-hidden="true" className="flex-1 border-t border-default" />
    </div>
  );
}
