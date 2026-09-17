-- A date is read differently in different places.
--
-- The app shipped one constant, APP_LOCALE = 'en-US', for two different
-- questions: what language the interface speaks, and how a person reads a date.
-- They are not the same question. An English interface in Zurich should still
-- write 15.03.2027; 'en-US' writes 3/15/2027. The platform's default currency
-- is CHF and its audience is Swiss-majority, so the answer shipped was wrong
-- for most users.
--
-- NULL is meaningful here and is the default: it means "keep inferring from
-- where I am", so a person who moves country gets the local convention without
-- touching settings. A stored value pins it and stops the inference.
--
-- Rollback: ALTER TABLE profiles DROP COLUMN date_format;

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS date_format TEXT;

-- The resolver understands exactly these. A constraint rather than an enum so
-- adding a format later is an ALTER, not a type migration; 'auto' is accepted
-- as an explicit way to say "go back to inferring".
ALTER TABLE profiles
  DROP CONSTRAINT IF EXISTS profiles_date_format_check;

ALTER TABLE profiles
  ADD CONSTRAINT profiles_date_format_check
  CHECK (date_format IS NULL OR date_format IN ('auto', 'day-first', 'month-first', 'iso'));

COMMENT ON COLUMN profiles.date_format IS
  'How this person reads dates. NULL or ''auto'' = infer from location_country, then currency, then language. Read by src/config/date-formats.ts.';
