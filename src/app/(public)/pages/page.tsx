import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function PagesRedirectPage() {
  redirect(ROUTES.DISCOVER_TYPE('projects'));
}
