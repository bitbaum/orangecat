/**
 * Print the SQL that brings every registered client's scope ceiling in line
 * with scripts/oauth/client-specs.ts. The deploy pipes it through the box's
 * psql right after the migrations (scripts/deploy-selfhost.sh), so a scope
 * widened in the code is live with the code. Creates nothing; a client that
 * is not registered yet stays that way until register-client.ts runs by hand.
 *
 *   npx tsx scripts/oauth/client-scopes-sql.ts | psql …
 */

import { clientScopeUpdates } from './client-specs';

process.stdout.write(`${clientScopeUpdates().join('\n')}\n`);
