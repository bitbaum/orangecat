/**
 * Project Templates
 *
 * Template definitions for project creation.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

import React from 'react';
import { Sprout, Heart, Palette, Lightbulb, Music, BookOpen, Film } from 'lucide-react';
import type { EntityTemplate } from '../types';
import { PLATFORM_DEFAULT_CURRENCY } from '@/config/currencies';

export interface ProjectDefaults {
  title: string;
  description: string;
  goal_amount: number;
  currency: string;
  funding_purpose: string;
  category: string;
}

export const PROJECT_TEMPLATES: EntityTemplate<ProjectDefaults>[] = [
  {
    id: 'community-garden',
    name: 'Community Garden',
    icon: React.createElement(Sprout, { className: 'w-4 h-4' }),
    tagline: 'Transform unused space into green community hub',
    defaults: {
      title: 'Community Garden Project',
      description:
        "Creating a shared community space with raised garden beds and educational workshops for local families. This project will transform unused land into a thriving community garden where residents can grow organic vegetables, learn sustainable farming practices, and build stronger neighborhood connections.\n\nOur garden will feature 20 raised beds, a composting station, rainwater collection system, and a small greenhouse. We'll host weekly workshops on organic gardening, composting, and sustainable living. All community members are welcome to participate, regardless of gardening experience.",
      goal_amount: 5000,
      currency: 'CHF',
      funding_purpose:
        'Construction materials for raised beds ($2000), Soil and composting infrastructure ($1000), Gardening tools and equipment ($800), Educational workshop materials ($500), Seeds and starter plants ($400), Signage and documentation ($300)',
      category: 'Community',
    },
  },
  {
    id: 'animal-shelter',
    name: 'Animal Shelter',
    icon: React.createElement(Heart, { className: 'w-4 h-4' }),
    tagline: 'Rescue and rehome abandoned pets',
    defaults: {
      title: 'Local Animal Shelter Support',
      description:
        'Supporting animal rescue operations and providing veterinary care for abandoned pets in our community. Our shelter has rescued over 200 animals in the past year, giving them a second chance at finding loving families.\n\nWe operate a no-kill shelter focused on rehabilitation and adoption. Every animal receives full veterinary care, behavioral assessment, and socialization before adoption. We also run educational programs teaching responsible pet ownership.',
      goal_amount: 10000,
      currency: 'CHF',
      funding_purpose:
        'Veterinary care and medical supplies ($4000), Food and nutrition ($2500), Shelter maintenance and improvements ($2000), Adoption program support ($1000), Educational materials ($500)',
      category: 'Cause',
    },
  },
  {
    id: 'art-exhibition',
    name: 'Art Exhibition',
    icon: React.createElement(Palette, { className: 'w-4 h-4' }),
    tagline: 'Showcase local artists and cultural diversity',
    defaults: {
      title: 'Traveling Art Exhibition',
      description:
        'Organizing a traveling art show featuring local artists and cultural exhibits to celebrate creativity in our community. This exhibition will showcase diverse artistic talents and provide a platform for emerging artists to share their work with wider audiences.\n\nThe exhibition will tour three cities over two months, featuring paintings, sculptures, photography, and digital art from 25 local artists. Each venue will include artist talks, workshops, and networking events.',
      goal_amount: 3000,
      currency: 'EUR',
      funding_purpose:
        'Venue rental and setup ($1200), Artist compensation and materials ($800), Marketing and promotional materials ($500), Exhibition catalog printing ($300), Opening reception events ($200)',
      category: 'Creative',
    },
  },
  // ── Creative work being MADE ────────────────────────────────────────────
  // A film, an album or a novel is financed the same way a garden is: money up
  // front, accountability as it goes. These exist so the funding side of the
  // Studio has somewhere obvious to land — see src/config/studio.ts.
  {
    id: 'record-an-album',
    name: 'Record an Album',
    icon: React.createElement(Music, { className: 'w-4 h-4' }),
    tagline: 'Fund the studio time, keep the masters',
    defaults: {
      title: 'Debut Album',
      description:
        'Recording and releasing a full-length album. Backers fund the studio time, the mixing and the pressing, and hear every version along the way — including the ones that do not make it.\n\nThe record is written. What is left is the part that costs money: studio days, a mixing engineer, mastering, and a first physical run. Backers get the tracks as they are finished, not a year later, and the masters stay with the artist.',
      goal_amount: 6000,
      currency: PLATFORM_DEFAULT_CURRENCY,
      funding_purpose:
        'Studio time and engineer (40%), Mixing and mastering (25%), Session musicians (15%), Physical pressing and artwork (15%), Distribution (5%)',
      category: 'Creative',
    },
  },
  {
    id: 'write-a-novel',
    name: 'Write a Novel',
    icon: React.createElement(BookOpen, { className: 'w-4 h-4' }),
    tagline: 'Buy the writing time, chapter by chapter',
    defaults: {
      title: 'Novel in Progress',
      description:
        'Writing a novel in the open. Backers fund the months of writing it actually takes, and read each chapter as it is finished rather than waiting for a publisher to decide.\n\nThe outline is done and the first chapters exist. Funding covers the writing time, a structural edit and a copy-edit, and a cover. No advance to earn out, no rights signed away.',
      goal_amount: 4000,
      currency: PLATFORM_DEFAULT_CURRENCY,
      funding_purpose:
        'Writing time (60%), Structural edit (15%), Copy-edit and proofread (10%), Cover and typesetting (10%), Print run (5%)',
      category: 'Creative',
    },
  },
  {
    id: 'make-a-short-film',
    name: 'Make a Short Film',
    icon: React.createElement(Film, { className: 'w-4 h-4' }),
    tagline: 'Shoot it without asking a commissioner first',
    defaults: {
      title: 'Short Film',
      description:
        'Producing a short film, from shoot to festival print. Backers fund the days that cost money — crew, locations, kit — and see the cut as it comes together.\n\nThe script is locked and the cast is attached. Funding covers a four-day shoot, post-production and festival submissions. No commissioner, no notes from anyone who is not paying for it.',
      goal_amount: 8000,
      currency: PLATFORM_DEFAULT_CURRENCY,
      funding_purpose:
        'Crew and cast (35%), Locations and permits (15%), Camera and lighting hire (20%), Post-production and sound (20%), Festival submissions (10%)',
      category: 'Creative',
    },
  },
  {
    id: 'open-source',
    name: 'Open Source Project',
    icon: React.createElement(Lightbulb, { className: 'w-4 h-4' }),
    tagline: 'Build privacy-focused tools for everyone',
    defaults: {
      title: 'Open Source Privacy Tools',
      description:
        "Building free, open-source privacy tools that anyone can use, audit, and improve. Our mission is to make privacy accessible to everyone, not just technical experts.\n\nWe're developing a suite of privacy-focused applications including encrypted messaging, secure file sharing, and anonymous browsing tools. All code is open source, regularly audited, and available on GitHub. The project is maintained by a global community of contributors.",
      goal_amount: 10000,
      currency: PLATFORM_DEFAULT_CURRENCY,
      funding_purpose:
        'Developer time and compensation (60%), Infrastructure and hosting (20%), Security audits (10%), Documentation and tutorials (10%)',
      category: 'Technology',
    },
  },
];
