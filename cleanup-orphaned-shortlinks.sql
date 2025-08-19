-- Cleanup Orphaned Short Links in Production
-- Run this on your production database to remove short links that no longer have corresponding regular links

-- First, let's see what orphaned short links exist
SELECT sl.id, sl.stream_name, sl.return_feed, sl.chat_enabled, sl.created_at, sl.expires_at
FROM short_links sl
LEFT JOIN generated_links gl ON (
    sl.stream_name = gl.stream_name AND 
    sl.return_feed = gl.return_feed AND 
    sl.chat_enabled = gl.chat_enabled
)
WHERE gl.id IS NULL;

-- Delete the specific orphaned short link that's causing issues
DELETE FROM short_links WHERE id = 'ZqqxxN';

-- Clean up all orphaned short links (use with caution)
-- DELETE FROM short_links 
-- WHERE id IN (
--     SELECT sl.id
--     FROM short_links sl
--     LEFT JOIN generated_links gl ON (
--         sl.stream_name = gl.stream_name AND 
--         sl.return_feed = gl.return_feed AND 
--         sl.chat_enabled = gl.chat_enabled
--     )
--     WHERE gl.id IS NULL
-- );

-- Verify cleanup
SELECT COUNT(*) as remaining_short_links FROM short_links;
SELECT COUNT(*) as regular_links FROM generated_links;