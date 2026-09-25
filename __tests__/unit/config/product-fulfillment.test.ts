/**
 * Nothing on OrangeCat delivers a product automatically, so nothing a seller
 * reads may say it does. "Automatic: System delivers digital files instantly"
 * sat in the form guidance for a feature no code implements.
 */

import {
  PRODUCT_FULFILLMENT_CHOICES,
  PRODUCT_FULFILLMENT_TYPES,
  PRODUCT_TYPES,
} from '@/config/products';
import { productGuidanceContent } from '@/lib/entity-guidance/product-guidance';
import { PRODUCT_TEMPLATES } from '@/components/create/templates';
import { productConfig } from '@/config/entity-configs/product-config';

const PROMISE = /instant(ly)? deliver|deliver(s|ed)? instantly|system delivers|automatic delivery/i;

describe('product fulfillment', () => {
  it('the form does not offer delivery that does not exist', () => {
    expect(PRODUCT_FULFILLMENT_CHOICES.map(c => c.value)).toEqual(['manual', 'digital']);
    // Still valid for existing rows and loans.
    expect(PRODUCT_FULFILLMENT_TYPES.map(c => c.value)).toContain('automatic');
  });

  it('every choice explains itself where it is made', () => {
    for (const option of [...PRODUCT_FULFILLMENT_CHOICES, ...PRODUCT_TYPES]) {
      expect(option.description.length).toBeGreaterThan(20);
    }
  });

  it('no seller-facing copy promises instant or automatic delivery', () => {
    const copy = JSON.stringify([
      PRODUCT_FULFILLMENT_CHOICES,
      productGuidanceContent.fulfillment_type,
      PRODUCT_TEMPLATES.map(t => [t.tagline, t.defaults]),
    ]);
    expect(copy).not.toMatch(PROMISE);
  });

  it('the product form has a photo field', () => {
    const fields = productConfig.fieldGroups.flatMap(g => g.fields ?? []);
    expect(fields.find(f => f.name === 'thumbnail_url')?.type).toBe('image');
  });
});
