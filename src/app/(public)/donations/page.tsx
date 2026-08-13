import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function DonationsRedirectPage() {
  redirect(ROUTES.DISCOVER_TYPE('causes'));
}
