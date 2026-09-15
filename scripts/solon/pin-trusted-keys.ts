/**
 * Pin Solon member keys as OrangeCat's governance trust anchor.
 *
 * Fetches the PUBLIC member roster from Solon and pins the selected members
 * into solon_trusted_keys — the set decision-verify checks vote signatures
 * against. Pinning is a deliberate operator act (owner-gated): review what
 * you pin. Votes from unpinned addresses cause the whole decision to be
 * refused, whatever the document claims.
 *
 * Run:
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/solon/pin-trusted-keys.ts --list
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/solon/pin-trusted-keys.ts --addresses <a1>,<a2>
 *   ORANGECAT_OWNER_SEED=1 npx tsx scripts/solon/pin-trusted-keys.ts --revoke <address>
 */
import { die, requireOwnerAdminClient } from '../lib/owner-gate';
import { parseArgs } from 'node:util';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SOLON_BASE_URL_DEFAULT, SOLON_ORG_ID, SOLON_ORG_SLUG } from '../../src/config/solon';

const admin = requireOwnerAdminClient();

const { values } = parseArgs({
  options: {
    list: { type: 'boolean', default: false },
    addresses: { type: 'string' },
    revoke: { type: 'string' },
  },
});

interface SolonMember {
  id: string;
  displayName: string;
  memberType: 'HUMAN' | 'AGENT';
  bitcoinAddress: string;
  publicKeyHex: string | null;
  votingWeight: number;
  status: string;
}

async function fetchRoster(): Promise<SolonMember[]> {
  const base = process.env.SOLON_BASE_URL || SOLON_BASE_URL_DEFAULT;
  const res = await fetch(`${base}/api/orgs/${SOLON_ORG_SLUG}`);
  if (!res.ok) die(`Solon roster fetch failed: HTTP ${res.status}`);
  const org = (await res.json()) as { id: string; members: SolonMember[] };
  if (org.id !== SOLON_ORG_ID) die(`org id mismatch: expected ${SOLON_ORG_ID}, got ${org.id}`);
  return org.members;
}

async function main() {
  if (values.revoke) {
    const { error } = await admin
      .from('solon_trusted_keys')
      .update({ revoked_at: new Date().toISOString() })
      .eq('bitcoin_address', values.revoke)
      .is('revoked_at', null);
    if (error) die(`revoke failed: ${error.message}`);
    console.log(`✓ revoked ${values.revoke}`);
    return;
  }

  const roster = await fetchRoster();
  if (values.list || !values.addresses) {
    console.log('Solon roster (pass --addresses <a1>,<a2> to pin):');
    for (const m of roster) {
      console.log(
        `  ${m.bitcoinAddress}  ${m.memberType}  weight=${m.votingWeight}  ${m.displayName} (${m.status})`
      );
    }
    return;
  }

  const wanted = new Set(
    values.addresses
      .split(',')
      .map(a => a.trim())
      .filter(Boolean)
  );
  const selected = roster.filter(m => wanted.has(m.bitcoinAddress));
  const missing = [...wanted].filter(a => !selected.some(m => m.bitcoinAddress === a));
  if (missing.length > 0) die(`not on the Solon roster: ${missing.join(', ')}`);

  for (const m of selected) {
    if (m.status !== 'ACTIVE') die(`${m.bitcoinAddress} is ${m.status} on Solon — refusing to pin`);
    const { error } = await admin.from('solon_trusted_keys').upsert(
      {
        solon_member_id: m.id,
        display_name: m.displayName,
        member_type: m.memberType,
        bitcoin_address: m.bitcoinAddress,
        public_key_hex: m.publicKeyHex,
        voting_weight: m.votingWeight,
        revoked_at: null,
      },
      { onConflict: 'solon_member_id' }
    );
    if (error) die(`pin failed for ${m.bitcoinAddress}: ${error.message}`);
    console.log(
      `✓ pinned ${m.bitcoinAddress} (${m.displayName}, ${m.memberType}, weight ${m.votingWeight})`
    );
  }
}

main().catch(e => die(e instanceof Error ? e.message : String(e)));
