/**
 * Product Templates
 *
 * Template definitions for product creation.
 *
 * Created: 2025-01-30
 * Last Modified: 2025-01-30
 */

import React from 'react';
import { FileDigit, ShoppingBag, Music, Ticket } from 'lucide-react';
import type { EntityTemplate } from '../types';
import { ENTITY_STATUS } from '@/config/database-constants';
import type { UserProductFormData } from '@/lib/validation';

export const PRODUCT_TEMPLATES: EntityTemplate<UserProductFormData>[] = [
  {
    id: 'digital-download',
    icon: React.createElement(FileDigit, { className: 'w-4 h-4' }),
    name: 'Digital Download',
    tagline: 'A file you send each buyer.',
    defaults: {
      title: 'Digital Download',
      description: 'A digital file you send to each buyer after they pay.',
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
