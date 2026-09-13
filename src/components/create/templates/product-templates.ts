/**
 * Product Templates
 *
 * Template definitions for product creation.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

import React from 'react';
import { FileDigit, ShoppingBag, Music, Ticket, BookOpen, Film } from 'lucide-react';
import type { EntityTemplate } from '../types';
import { ENTITY_STATUS } from '@/config/database-constants';
import type { UserProductFormData } from '@/lib/validation';

export const PRODUCT_TEMPLATES: EntityTemplate<UserProductFormData>[] = [
  {
    id: 'digital-download',
    icon: React.createElement(FileDigit, { className: 'w-4 h-4' }),
    name: 'Digital Download',
    tagline: 'One file, instant delivery.',
    defaults: {
      title: 'Digital Download',
      description: 'A digital file delivered instantly after purchase.',
      category: 'Digital',
      product_type: 'digital',
      price: 15,
      currency: 'CHF',
      inventory_count: -1,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  {
    id: 'limited-merch',
    icon: React.createElement(ShoppingBag, { className: 'w-4 h-4' }),
    name: 'Limited Merch Drop',
    tagline: 'Small-batch physical item.',
    defaults: {
      title: 'Limited Merch Drop',
      description: 'A small-batch, high-quality item. Ships in 7–10 days.',
      category: 'Merch',
      product_type: 'physical',
      price: 45,
      currency: 'CHF',
      inventory_count: 25,
      fulfillment_type: 'manual',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  {
    id: 'event-ticket',
    icon: React.createElement(Ticket, { className: 'w-4 h-4' }),
    name: 'Event Ticket',
    tagline: 'Simple admission with capped quantity.',
    defaults: {
      title: 'Event Ticket',
      description: 'Admission to a single event. Confirmation sent on purchase.',
      category: 'Events',
      product_type: 'digital',
      price: 25,
      currency: 'CHF',
      inventory_count: 50,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  // ── Finished creative work, for sale ────────────────────────────────────
  // The other end of the Studio: once the thing exists, it is a product like
  // any other, and Bitcoin settles straight to the maker's wallet.
  {
    id: 'novel-ebook',
    icon: React.createElement(BookOpen, { className: 'w-4 h-4' }),
    name: 'Novel or Ebook',
    tagline: 'A finished book, delivered on purchase.',
    defaults: {
      title: 'Novel (ebook)',
      description:
        'A complete novel, delivered as EPUB and PDF the moment you buy it. No store account, no reader lock-in, no rights held by anyone but the author.',
      category: 'Writing',
      product_type: 'digital',
      price: 12,
      currency: 'CHF',
      inventory_count: -1,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  {
    id: 'album-download',
    icon: React.createElement(Music, { className: 'w-4 h-4' }),
    name: 'Album',
    tagline: 'A full record, yours to keep.',
    defaults: {
      title: 'Album (digital)',
      description:
        'The full record as lossless files, plus artwork and liner notes. A purchase, not a licence that expires when a service does.',
      category: 'Music',
      product_type: 'digital',
      price: 18,
      currency: 'CHF',
      inventory_count: -1,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  {
    id: 'short-film',
    icon: React.createElement(Film, { className: 'w-4 h-4' }),
    name: 'Film or Video',
    tagline: 'A finished piece, sold directly.',
    defaults: {
      title: 'Short Film',
      description:
        'The finished film in full quality, bought directly from the people who made it. No platform between the audience and the work.',
      category: 'Film',
      product_type: 'digital',
      price: 9,
      currency: 'CHF',
      inventory_count: -1,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
  {
    id: 'music-pack',
    icon: React.createElement(Music, { className: 'w-4 h-4' }),
    name: 'Music Pack',
    tagline: 'Bundle of tracks with commercial rights.',
    defaults: {
      title: 'Music Pack (5 tracks)',
      description: 'A bundle of 5 tracks with light commercial licensing.',
      category: 'Music',
      product_type: 'digital',
      price: 30,
      currency: 'CHF',
      inventory_count: -1,
      fulfillment_type: 'digital',
      status: ENTITY_STATUS.DRAFT,
    },
  },
];
