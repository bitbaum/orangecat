/**
 * The admission test, enforced.
 *
 * "An entity is anything that can hold a wallet and is better for holding one"
 * is only a definition if something checks it. Written as prose in a header it
 * is a wish: the next type gets added because it resembles the types already
 * there, and the definition quietly becomes a description of whatever was
 * added last.
 *
 * So the rationale is a required field, and the exceptions are a RATCHET. The
 * set of types that do not hold a wallet may shrink — that is a type being
 * either justified or removed — and may never grow without someone editing the
 * list below and having to say why in a diff.
 */

import { ENTITY_REGISTRY, ENTITY_TYPES } from '@/config/entity-registry';

/**
 * The only two types in this registry that are not economic actors.
 *
 * `wallet` is the primitive the test is written against — asking whether a
 * wallet can hold a wallet is a category error, not a failure.
 *
 * `document` is Cat context: it receives nothing and owes nothing. It is here
 * because it shares the registry's plumbing (tables, routes, create flow), not
 * because it is an entity in the sense this file defines. If it is ever given
 * its own surface, it should leave this registry rather than earn a wallet.
 */
const NOT_ECONOMIC_ACTORS = ['wallet', 'document'] as const;

describe('every registered type answers the admission test', () => {
  it.each([...ENTITY_TYPES])('%s states why it is an entity', type => {
    const why = ENTITY_REGISTRY[type].wallet.why;
    expect(why.trim()).not.toBe('');
    // Long enough to be a reason rather than a label. "Money" was the shortest
    // honest answer anyone wrote by hand; anything below this is a placeholder.
    expect(why.length).toBeGreaterThan(25);
    expect(why.trim().endsWith('.')).toBe(true);
  });

  it('holds a wallet unless it is one of the two known exceptions', () => {
    const notHolding = ENTITY_TYPES.filter(t => !ENTITY_REGISTRY[t].wallet.holds).sort();
    expect(notHolding).toEqual([...NOT_ECONOMIC_ACTORS].sort());
  });

  it('keeps the exception list a ratchet — it may shrink, never grow', () => {
    // If this fails because you ADDED a type that holds no wallet: the type
    // does not belong in this registry. If it fails because you removed one
    // from NOT_ECONOMIC_ACTORS: good, shrink the list above in the same diff.
    const notHolding = ENTITY_TYPES.filter(t => !ENTITY_REGISTRY[t].wallet.holds);
    expect(notHolding.length).toBeLessThanOrEqual(NOT_ECONOMIC_ACTORS.length);
  });

  it('never dresses a non-actor up with a payment surface', () => {
    // A type that cannot hold a wallet must not advertise one. This is the
    // consistency the field buys: the rationale and the payment metadata are
    // two statements about the same thing, and they have to agree.
    for (const type of NOT_ECONOMIC_ACTORS) {
      const meta = ENTITY_REGISTRY[type];
      expect(meta.wallet.holds).toBe(false);
      expect(meta.canReceiveSupport).toBe(false);
      expect(meta.paymentPattern).toBe('none');
    }
  });

  it('names every economic actor that still has no way to be paid', () => {
    // The converse of the test above, and the first thing applying the
    // definition actually found: `asset` and `loan` hold a wallet by their
    // nature — rent and deposits for one, principal and repayments for the
    // other — and yet nothing on the platform can pay into either. A loan
    // whose repayment has no surface is missing the part that makes it a loan.
    //
    // That is a product gap, not a metadata typo, so this does not quietly
    // flip `paymentPattern` on live entities. It pins the gap instead: the
    // list may SHRINK as each one gets its surface, and may never grow.
    const NO_WAY_TO_PAY_IN = ['asset', 'loan'];
    const unpayable = ENTITY_TYPES.filter(t => {
      const meta = ENTITY_REGISTRY[t];
      return meta.wallet.holds && meta.paymentPattern === 'none' && !meta.canReceiveSupport;
    }).sort();
    expect(unpayable).toEqual([...NO_WAY_TO_PAY_IN].sort());
  });
});
