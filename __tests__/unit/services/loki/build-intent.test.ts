// @vitest-environment jsdom
import { createHmac } from 'node:crypto';
import {
  signLokiBuildIntent,
  suggestedHandoffFor,
  type LokiBuildIntent,
} from '@/services/loki/build-intent';
import { publicSupportCreateSchema } from '@/lib/validation/finance';
import { projectSchema } from '@/lib/validation/projects';
import { ENTITY_REGISTRY } from '@/config/entity-registry';

describe('OrangeCat → Loki build handoff', () => {
  const originalSecret = process.env.LOKI_BUILD_INTENT_SECRET;

  beforeEach(() => {
    process.env.LOKI_BUILD_INTENT_SECRET =
      'test-secret-that-is-at-least-thirty-two-characters';
  });

  afterAll(() => {
    if (originalSecret === undefined) {
      delete process.env.LOKI_BUILD_INTENT_SECRET;
    } else {
      process.env.LOKI_BUILD_INTENT_SECRET = originalSecret;
    }
  });

  it('signs a ten-minute HS256 intent bound to the OrangeCat actor', () => {
    const token = signLokiBuildIntent({
      sub: '8be1ca55-58f7-420c-8dfa-1c9f19d6232e',
      entity: {
        type: 'group',
        id: '4caf8213-4aca-43ba-af9d-93b2cd22c6d9',
        title: 'Neighbourhood club',
        description: 'A public club.',
        publicUrl: 'https://www.orangecat.ch/groups/neighbourhood-club',
      },
      suggestedHandoff: suggestedHandoffFor('group', 'Neighbourhood club'),
    });

    const [header, body, signature] = token.split('.');
    const expected = createHmac('sha256', process.env.LOKI_BUILD_INTENT_SECRET as string)
      .update(`${header}.${body}`)
      .digest('base64url');
    const payload = JSON.parse(
      Buffer.from(body, 'base64url').toString('utf8')
    ) as LokiBuildIntent;

    expect(signature).toBe(expected);
    expect(payload.iss).toBe('orangecat');
    expect(payload.aud).toBe('loki');
    expect(payload.sub).toBe('8be1ca55-58f7-420c-8dfa-1c9f19d6232e');
    expect(payload.exp - payload.iat).toBe(600);
    expect(payload.suggestedHandoff).toEqual(
      expect.arrayContaining([expect.stringContaining('business plan')])
    );
  });

  it('marks infrastructure private but lets actionable entities receive support', () => {
    expect(ENTITY_REGISTRY.wallet.canReceiveSupport).toBe(false);
    expect(ENTITY_REGISTRY.document.canReceiveSupport).toBe(false);
    expect(ENTITY_REGISTRY.project.canReceiveSupport).toBe(true);
    expect(ENTITY_REGISTRY.product.canReceiveSupport).toBe(true);
    expect(ENTITY_REGISTRY.group.canReceiveSupport).toBe(true);
    expect(ENTITY_REGISTRY.group.titleColumn).toBe('name');
  });

  it('bounds public contributions and accepts explicit active integration projects', () => {
    expect(
      publicSupportCreateSchema.safeParse({
        entity_type: 'project',
        entity_id: '4caf8213-4aca-43ba-af9d-93b2cd22c6d9',
        amount_btc: 0.000001,
      }).success
    ).toBe(true);
    expect(
      publicSupportCreateSchema.safeParse({
        entity_type: 'project',
        entity_id: '4caf8213-4aca-43ba-af9d-93b2cd22c6d9',
        amount_btc: 2,
      }).success
    ).toBe(false);
    expect(
      projectSchema.safeParse({
        title: 'Loki',
        description: 'Public projection',
        status: 'active',
      }).success
    ).toBe(true);
  });
});
