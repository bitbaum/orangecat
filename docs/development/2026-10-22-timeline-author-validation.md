# Timeline post author validation

The legacy `create_post_with_visibility` function is SECURITY DEFINER. Its original authentication check accepted any non-null supplied author, while table-level RLS is bypassed inside the function. The repository grants execution to anonymous and authenticated callers. The newer general timeline writer already requires its author to match `auth.uid()`.

An isolated PostgreSQL 17 database reproduced both an unsigned supplied author and a different authenticated author being accepted by the original function. All records were invented local fixtures; no writes were attempted against another person's account or the live service. This establishes the repository function's behavior, not a claim about the exact deployed database definition.

The new migration requires an authenticated identity and matching author before rate-limit queries or insertion. It preserves the existing signature, JSON response envelope, profile-ID contract, visibility contexts, duplicate prevention and rate limits. The existing browser RPC caller supplies its own profile ID. Trusted background writes can use their separately authorized paths; this browser-facing function follows the same author rule as the newer timeline writer.

`tests/database/timeline-post-author.test.sql` runs only in an empty disposable PostgreSQL database. It creates minimal fixture tables and auth helpers, includes the new migration, checks unsigned/mismatched rejection without inserted rows, self-authorship with default identity/context, duplicate prevention and rate limits, then rolls back. Creating `auth` deliberately fails against an existing Supabase schema. Run with `psql -v ON_ERROR_STOP=1 -f tests/database/timeline-post-author.test.sql` from the repository in that isolated database.

The regression passed in a disposable container with no network or published ports. Existing migrations were left unchanged; the original function was backed up before creating the replacement migration.
