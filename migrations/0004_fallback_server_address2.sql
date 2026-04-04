-- Virtual Audience Platform v2.7 Migration
-- Adds fallback_server_address and fallback_server_address2 to return_feeds
-- Safe to run on databases that already have either column (IF NOT EXISTS).
--
-- fallback_server_address  — 2nd SRS server slot (primary fallback)
-- fallback_server_address2 — 3rd SRS server slot (secondary fallback, round-robin rotation)

ALTER TABLE "return_feeds"
  ADD COLUMN IF NOT EXISTS "fallback_server_address"  text,
  ADD COLUMN IF NOT EXISTS "fallback_server_address2" text;

SELECT
    '0004 Migration Verification' AS migration,
    CASE
        WHEN (
            SELECT COUNT(*) FROM information_schema.columns
            WHERE table_name = 'return_feeds'
              AND column_name IN ('fallback_server_address', 'fallback_server_address2')
        ) = 2
        THEN 'SUCCESS: both fallback columns present on return_feeds'
        ELSE 'ERROR: one or more fallback columns missing'
    END AS result;

\echo 'Migration 0004 (return_feeds fallback_server_address2) completed'
