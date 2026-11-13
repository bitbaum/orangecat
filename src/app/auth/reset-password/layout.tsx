import type { Metadata } from 'next';

// The page is a client component and cannot name itself; without this the tab
// read "Account", the sign-in page's title, on every recovery step.
export const metadata: Metadata = {
  title: 'Reset password',
  robots: { index: false },
};

export default function ResetPasswordLayout({ children }: { children: React.ReactNode }) {
  return children;
}
