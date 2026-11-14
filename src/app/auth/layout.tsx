import type { Metadata } from 'next';
import { APP_NAME, APP_PROMISE } from '@/config/brand';

export const metadata: Metadata = {
  // Was 'Sign In' — but this layout serves /auth?mode=login AND
  // /auth?mode=register from the same page module, so the browser tab
  // title lied half the time. 'Account' covers both modes honestly.
  title: 'Account',
  description: `Sign in or create your ${APP_NAME} account. ${APP_PROMISE}`,
};

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return children;
}
