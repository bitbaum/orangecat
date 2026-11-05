# WritingKit

Revision-safe operations for an editing workspace. One coordinator serializes
generation and editing, captures the requested document revision, and rejects
late answers after edits, document/account changes, cancellation or disposal.

The package supports authoring adapters such as OrangeCat article editing,
BiasLens source rewrites and Heidi language-learning adaptations. Product
package plans record actual adoption. The package has no runtime dependencies.

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

## Verification and ownership

From the package directory, install its declared development dependencies and run:

```sh
pnpm run verify
```

The package checks its types, builds its public exports and tests the actual
exported runtime, including overlapping operations and late responses. Committed
`dist` must match the build for the standalone package's GitHub install path.

Consumers install a verified package release; they do not import another
product's source folder. During extraction, Fleet's package-repository workflow
copies bootstrap source into its standalone repository. After creation, change
the engine there and retire the bootstrap runtime copy and its temporary product
verification binding on first adoption. Preserve the extraction commit as
provenance. Product handoffs record the release/adoption state rather than this
README claiming an unverified installation.
