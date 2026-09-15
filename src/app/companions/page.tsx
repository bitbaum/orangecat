import { redirect } from 'next/navigation';
import { ROUTES } from '@/config/routes';

export default function AIAssistantsPage() {
  redirect(ROUTES.DISCOVER_TYPE('ai_assistants'));
}
