/**
 * One way to file a bug from inside the product.
 *
 * OrangeCat embeds Loki's feedback widget (see src/app/layout.tsx), which
 * publishes `window.Loki.report()` — it opens the feedback panel with the
 * failure already described and machine-readable context attached, so reporting
 * a bug is one click instead of "notice the floating button, open it, re-type
 * what the product already knew".
 *
 * Everything that wants to offer "report this" goes through here, so the
 * fallback behaviour is decided once: `widget.js` is loaded async and gated by
 * a server-side kill switch, so it may legitimately be absent. Callers get a
 * boolean and render a plain link to the feedback page when it is.
 */

/** Flat context; rendered as `key: value` lines into the report body. */
export type ReportDiagnostics = Record<string, string | number | boolean | null | undefined>;

interface LokiApi {
  /**
   * False until the widget's boot gate has said active AND its panel exists.
   *
   * The widget publishes `report` synchronously so callers need not know
   * whether it finished booting — which means the function exists even on a
   * page where the widget will never render. Checking only for the function
   * ships a control that silently does nothing.
   */
  ready?: boolean;
  report(input: { message?: string; diagnostics?: ReportDiagnostics }): void;
}

declare global {
  interface Window {
    Loki?: LokiApi;
  }
}

/**
 * Open the feedback panel pre-filled, and say whether it actually opened.
 *
 * Returns false when the panel cannot open right now — no widget, still
 * booting, or switched off. Callers render a real link to the feedback page and
 * only suppress the navigation when this returns true, so the control is never
 * capable of doing nothing. That shape also covers the cases a readiness check
 * alone cannot: no JavaScript, and widget.js not yet executed (it loads async).
 */
export function reportToLoki(input: {
  message: string;
  diagnostics?: ReportDiagnostics;
}): boolean {
  if (typeof window === 'undefined') {
    return false;
  }
  const api = window.Loki;
  if (!api?.ready || typeof api.report !== 'function') {
    return false;
  }
  api.report(input);
  return true;
}
