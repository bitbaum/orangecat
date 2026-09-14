-- Projects: the end state the work is building toward.
--
-- A project page already answers three questions and not the fourth. It says
-- what the project IS (`description`), what is happening on it right now
-- (`work_status`, 2026-08-24), and what the money BUYS (`funding_purpose`).
-- None of those answer the one a backer actually weighs before funding
-- soft-strings work: where does this end up if it succeeds?
--
-- That question is the whole difference between a project and a shopping cart.
-- A product page needs no vision — you get the thing or you do not. A project
-- asks someone to fund an intention, and an intention with no stated end state
-- is indistinguishable from an open-ended bill.
--
-- Nullable and additive: every existing row renders exactly as it does today,
-- and the section is absent rather than empty when a project has not written
-- one. No backfill is possible — the text has never been collected.
ALTER TABLE projects ADD COLUMN IF NOT EXISTS vision TEXT;

COMMENT ON COLUMN projects.vision IS
  'Owner-written end state the project is building toward — where it is going, as distinct from what it is (description) and where it stands (work_status).';

-- The two projects that ARE this stack get theirs now, because a platform that
-- asks every project to state a vision and states none for itself is asking
-- for something it has not shown is worth doing. Until today both visions lived
-- only in the repository (CLAUDE.md) and in build-time config — readable by the
-- people building, by nobody funding.
--
-- Seeded once, owner-editable afterwards: the guard is `vision IS NULL`, so a
-- replay onto a database where these have since been edited changes nothing.
-- The ids are the production defaults behind NEXT_PUBLIC_ORANGECAT_PROJECT_ID
-- and NEXT_PUBLIC_LOKI_ORANGECAT_PROJECT_ID (src/config/ecosystem.ts); on a
-- database where those rows do not exist this updates nothing and still
-- succeeds, which is the correct outcome for a seed, not a silent failure.
UPDATE projects
SET vision = 'A world where economic participation is as open and uncensorable as speech. Where any identity — human, pseudonymous, or AI — can earn, fund, lend, invest, and govern freely. Where AI agents work on behalf of people and organizations to make this effortless, and where every economic relationship is structured, transparent where appropriate, and private where it matters.'
WHERE id = 'cb093f00-8745-4579-98df-050ebfb37181'
  AND vision IS NULL;

UPDATE projects
SET vision = 'A world where anyone can build what they can describe. Where the distance between a funded intention and a working system is a conversation rather than a hiring round, and where the person who had the idea still decides what ships — however much of the work a fleet does.'
WHERE id = '8130c927-114a-45b7-8cc2-99efd5224025'
  AND vision IS NULL;
