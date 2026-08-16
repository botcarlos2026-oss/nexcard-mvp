-- NexCard — Force PostgREST to reload its schema cache.
-- profiles_public was dropped and recreated by 202608112350_checkout_attempt_idempotency.sql;
-- PostgREST kept serving from a stale cache and started rejecting every request to the view
-- with PGRST205 ("Could not find the table 'public.profiles_public' in the schema cache"),
-- breaking every public profile page in production.
notify pgrst, 'reload schema';
