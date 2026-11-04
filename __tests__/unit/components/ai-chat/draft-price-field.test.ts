import { draftPriceField } from '@/components/ai-chat/ModernChatPanel/components/draft-price-field';
import { userServiceSchema } from '@/lib/validation';

describe('draftPriceField', () => {
  it('sends a service price as fixed_price by default, hourly_rate when the draft had one', () => {
    expect(draftPriceField('service', { price: 40 })).toBe('fixed_price');
    expect(draftPriceField('service', { hourly_rate: 40 })).toBe('hourly_rate');
    expect(draftPriceField('product', { price: 40 })).toBe('price');
  });

  it('a Cat service draft with its price mapped passes the services API schema', () => {
    const body = {
      title: 'French Language Tutoring & Lessons',
      category: 'Teaching & Tutoring',
      currency: 'CHF',
      status: 'draft',
      [draftPriceField('service', {})]: 40,
    };
    expect(userServiceSchema.safeParse(body).success).toBe(true);
    expect(
      userServiceSchema.safeParse({ ...body, fixed_price: undefined, price: 40 }).success
    ).toBe(false);
  });
});
