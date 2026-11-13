/**
 * The title block every account screen opens with — sign in, create account,
 * forgotten password, the reset code, the new password, the done screen. One
 * shape, so the recovery steps read as the same place and not three others
 * (one had a card, one an icon tile, one Title Case).
 */
export function AuthTitle({ title, lede }: { title: string; lede?: string }) {
  return (
    <div className="mb-8 text-center max-[359px]:mb-4">
      <h1 className="mb-2 text-2xl font-semibold text-fg-primary">{title}</h1>
      {lede && <p className="mb-0 text-fg-secondary">{lede}</p>}
    </div>
  );
}

/** The page around a single account step: centred, one column, the page surface. */
export function AuthStepPage({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-surface-page px-4 py-12">
      <div className="w-full max-w-md">{children}</div>
    </div>
  );
}
