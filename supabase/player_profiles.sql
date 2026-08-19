-- DEPRECATED in AutoSyndicate v5.
-- Open and run `supabase/schema_v5.sql` in the Supabase SQL Editor instead.
--
-- The old version of this file used permissive INSERT/UPDATE RLS policies and
-- allowed one client to overwrite another player's public profile. v5 replaces
-- those policies with authenticated ownership and server-side guards.
select 'Run supabase/schema_v5.sql for AutoSyndicate v5' as autosyndicate_setup;
