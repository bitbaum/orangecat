'use client';

import { createContext, useContext } from 'react';
import { usePathname, useSelectedLayoutSegment } from 'next/navigation';

/**
 * The route Next.js renders a URL under when no route matches it, and the path
 * the shell draws its chrome for on that page.
 */
export const NOT_FOUND_SHELL_PATH = '/_not-found';

/**
 * Next.js renders a URL that matches no route (/discover/zzz,
 * /settings/security) through its own /_not-found route. On the server
 * usePathname() then answers '/_not-found'; in the browser the router reads
 * the address bar and answers '/discover/zzz'. Chrome that branched on it —
 * the surface, the footer, the phone tab bar, the active header link — drew
 * different HTML on each side, so every such 404 threw React #418 and swapped
 * its chrome after load (production, 2026-11-12). The selected segment comes
 * from the route tree the server sent, so it is the same on both sides.
 */
export function resolveShellPathname(pathname: string | null, topSegment: string | null): string {
  return topSegment === NOT_FOUND_SHELL_PATH ? NOT_FOUND_SHELL_PATH : (pathname ?? '/');
}

export const ShellPathnameContext = createContext<string | null>(null);

/**
 * For AppShell alone. It is rendered by the root layout, so the segment it
 * reads is the top one; read lower down, useSelectedLayoutSegment answers for
 * that layout instead.
 */
export function useRootShellPathname(): string {
  return resolveShellPathname(usePathname(), useSelectedLayoutSegment());
}

/**
 * The path every piece of shell chrome (header, footer, tab bar) draws for.
 * Read this, not usePathname(), for anything that changes the shell's markup.
 * Outside AppShell (a component rendered on its own) there is no shell, and
 * the router's pathname is the answer.
 */
export function useShellPathname(): string {
  const shellPathname = useContext(ShellPathnameContext);
  const pathname = usePathname();
  return shellPathname ?? pathname ?? '/';
}
