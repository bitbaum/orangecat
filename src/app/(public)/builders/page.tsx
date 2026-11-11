/**
 * /builders lives on bitbaum: the directory of independent builders the studio
 * approves on their shipped work, and the door to apply. One list, one place.
 */
import { permanentRedirect } from 'next/navigation';
import { ECOSYSTEM } from '@/config/ecosystem';

export default function BuildersPage(): never {
  permanentRedirect(ECOSYSTEM.studio.buildersUrl);
}
