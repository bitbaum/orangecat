import { permanentRedirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

/**
 * /company/about was a second About page beside /about. Its one unique door,
 * "Ways in" (/company/careers), is linked from /about now.
 */
export default function CompanyAboutPage(): never {
  permanentRedirect(ROUTES.ABOUT);
}
