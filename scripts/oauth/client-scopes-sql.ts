/**
 * Print the SQL that brings the registered clients in line with
 * scripts/oauth/client-specs.ts. The deploy pipes it through the box's psql
 * right after the migrations (scripts/deploy-selfhost.sh), so a scope widened
 * in the code is live with the code. A client with no row yet gets one,
 * switched off and without a secret (clientRowInserts): it signs nobody in
 * until loki app-secrets.sh or register-client.ts gives it a secret. The
 * privacy and terms links the consent screen shows are refreshed the same way.
 *
 *   npx tsx scripts/oauth/client-scopes-sql.ts | psql …
 */

import { clientDocumentUpdates, clientRowInserts, clientScopeUpdates } from './client-specs';

process.stdout.write(
  `${[...clientRowInserts(), ...clientScopeUpdates(), ...clientDocumentUpdates()].join('\n')}\n`
);
