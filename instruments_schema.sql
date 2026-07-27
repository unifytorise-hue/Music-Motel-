-- Music Motel: instruments a member plays
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql and xp_schema.sql to already be applied.

alter table public.profiles add column if not exists instruments text[] not null default '{}';

-- Re-run the column-scoped grant (same pattern/reasoning as xp_schema.sql):
-- a table-wide UPDATE grant would let a client overwrite xp directly, so
-- UPDATE is revoked entirely and re-granted only on the columns a user
-- should be able to edit themselves, now including instruments.
revoke update on public.profiles from authenticated, anon;
grant update (account_type, name, role_label, bio, location_label, lat, lng, avatar_color, instruments)
  on public.profiles to authenticated;
