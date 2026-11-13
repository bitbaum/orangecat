import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * /pages is an old public address. It sent a visitor to the signed-in project
 * dashboard, which only bounced them to sign-in; Discover is the public list.
 */
export default function PagesRedirectPage() {
  redirect(ROUTES.DISCOVER);
}
