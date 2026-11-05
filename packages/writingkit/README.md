# WritingKit

Revision-safe operations for an editing workspace. One coordinator serializes
generation and editing, captures the requested document revision, and rejects
late answers after edits, document/account changes, cancellation or disposal.

This is the first extraction slice from OrangeCat's article workflow. BiasLens
source rewrites and Heidi language-learning adaptations are intended consumers;
neither is an adopter yet. The package has no runtime dependencies.

## Use

```ts
import { WritingSession } from '@bitbaum/writingkit';

const session = new WritingSession({ documentId, revision });
// On every committed edit, advance the host revision and synchronize it.
session.update({ documentId, revision: nextRevision });

// Capture the text and host options before the asynchronous operation starts.
const input = { ...currentDraft };
const outcome = await session.run(
  ({ signal, base }) => proposeEdit({ input, base, signal }),
  proposal => {
    applyToEditor(proposal);
  }
);

if (outcome.status === 'stale') showWritingChanged();
if (outcome.status === 'failed') showRetry(outcome.error);
// busy/cancelled outcomes must not replace the current workspace's messages.
session.cancel(); // invalidates the answer even if the provider ignores abort
session.dispose(); // permanently closes this owner when the workspace is removed
```

`run` reserves the workspace synchronously, before the first await. Its apply
callback runs only after validation and must be synchronous. Its `undefined`
return type rejects asynchronous callbacks in TypeScript; use a block callback
as above. The callback may advance the host revision after applying the edit.
It should commit the proposed fields together rather than partly applying them.

The document identity is an opaque host key. Include the account/tenant boundary
where a draft id alone is not unique. Never treat that string as authorization.
Revision tokens can be numbers or strings; an internal epoch also detects a
token changed and then restored. Call `update` for every committed edit, even if
the text later returns to its previous value. Repeating the same revision is a
no-op. A document change aborts the old operation and frees the workspace for
the new one immediately. A same-document edit keeps the operation reserved
until completion or explicit cancellation, then reports `stale`.

Create a fresh session per editor lifecycle. In React, create it inside the
owning layout-effect setup and dispose that instance in its cleanup. This also
handles development Strict Mode's setup/cleanup replay. Synchronize committed
revisions in a layout effect, before a pending answer can run between commit and
passive-effect cleanup. UI busy/error state stays with the host; a cancelled old
operation must not clear a newer operation's busy state (`session.busy`).

## Ownership

Hosts own the document, immutable original source, proposed edits and Undo,
version history, labels/citations, language/variety checks, account storage,
server authorization, quotas and publication. Model/HTTP execution remains in
the host's existing ai-kit/API adapter. Chat remains chatkit; published reading
surfaces remain bip-kit. No provider, endpoint or language is selected here.

Cancellation does not undo a server-side write. Prefer operations that produce
proposals. If an existing endpoint commits a revision before returning, retain
its optimistic server revision checks and reconcile its result with server
history even when the browser outcome is stale or cancelled. Never claim that
this editing guard rolls back a database change.

## Extraction and verification

This folder is bootstrap source for a standalone package repository, not an
application dependency or an installed feature. Register it through Fleet's
package-repository workflow, publish a verified release, then consume that
version in OrangeCat before adding another app adapter. Do not create local
cross-product imports into this folder.

After the standalone repository exists, change the engine there. Retire this
bootstrap runtime copy and its temporary product verification binding when the
first consumer adopts the release; preserve the extraction commit as provenance.

```sh
pnpm --dir packages/writingkit run verify
```

The package checks its types, builds its public exports and tests the actual
exported runtime, including overlapping operations and late responses. Committed
`dist` must match the build for the standalone package's GitHub install path.
