/**
 * The create panel ("Why organizations?") promises only what a group gets, and
 * names the kind the way the rest of the app does (ENTITY_REGISTRY.group).
 *
 * It listed "Collective treasury with multi-signature Bitcoin wallets". A group
 * wallet is a name, a purpose and the group's own Bitcoin and Lightning
 * addresses (GroupWalletCreateForm), readable by members; nothing sets a signer
 * or a threshold, and OrangeCat holds no keys, so it cannot make or enforce a
 * multi-signature wallet. Advising a group to bring its own is fine; offering
 * one as a feature is not.
 */
import { ENTITY_REGISTRY } from '@/config/entity-registry';
import { groupDefaultGuidance, groupGuidanceContent } from '@/lib/entity-guidance/group-guidance';

const featureText = groupDefaultGuidance.features.map(feature => feature.text);

describe('Create Group: what the panel says a group gets', () => {
  it('does not offer multi-signature wallets as a feature', () => {
    for (const text of featureText) {
      expect(text).not.toMatch(/multi-?sig/i);
    }
  });

  it('describes the treasury as the group’s own addresses, shown to its members', () => {
    expect(featureText).toContain(
      `A shared treasury: the ${ENTITY_REGISTRY.group.name.toLowerCase()}'s own Bitcoin and Lightning addresses, shown to its members`
    );
  });

  it('names the kind from the registry, not "Group"', () => {
    expect(groupDefaultGuidance.title).toBe(
      `Why ${ENTITY_REGISTRY.group.namePlural.toLowerCase()}?`
    );
    expect(groupDefaultGuidance.title).not.toMatch(/group/i);
    expect(groupDefaultGuidance.description).not.toMatch(/\bgroups?\b/i);
  });

  it('keeps multi-signature only as advice for a wallet the members set up', () => {
    const { tips } = groupGuidanceContent.bitcoin_address;
    const multisig = tips.filter(tip => /multi-?sig/i.test(tip));
    expect(multisig.length).toBeGreaterThan(0);
    for (const tip of multisig) {
      expect(tip).toMatch(/your members set up/);
    }
  });
});
