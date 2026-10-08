/**
 * /partners lives on bitbaum.
 *
 * This page used to list the members of an OrangeCat "guild" who admitted each
 * other — a second definition of "partner" beside bitbaum's directory, where
 * partners apply and the studio approves them. The guild was never founded, so
 * the page showed an empty list while bitbaum had the real one. One list, one
 * place: the old address keeps working and lands there.
 */
import { permanentRedirect } from 'next/navigation';
import { ECOSYSTEM } from '@/config/ecosystem';

export default function PartnersPage(): never {
  permanentRedirect(ECOSYSTEM.studio.partnersUrl);
}
