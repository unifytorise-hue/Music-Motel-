-- Music Motel: distance/currency preferences, personal-vs-band signup,
-- and band membership with per-member access levels.
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql to already be applied.

-- ===== per-user display preferences =====
alter table public.profiles add column if not exists distance_unit text not null default 'km' check (distance_unit in ('km','mi'));
alter table public.profiles add column if not exists currency text not null default 'USD';
alter table public.profiles add column if not exists profile_kind text not null default 'personal' check (profile_kind in ('personal','band'));

-- Re-run the column-scoped grant (same pattern as xp_schema.sql /
-- instruments_schema.sql), now including the three new columns above.
revoke update on public.profiles from authenticated, anon;
grant update (account_type, name, role_label, bio, location_label, lat, lng, avatar_color, instruments, distance_unit, currency, profile_kind)
  on public.profiles to authenticated;

-- ===== band membership =====
-- A "band profile" is just a normal profiles row (profile_kind = 'band')
-- owned by whoever signed up for it — that account is the implicit owner
-- via the existing auth.uid() = id policy already on profiles, no row
-- needed here for them. This table is for OTHERS who've unified with the
-- band: a pending request until the band approves it and picks a role.
create table if not exists public.band_members (
  id uuid primary key default gen_random_uuid(),
  band_profile_id uuid not null references auth.users(id) on delete cascade,
  member_user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'editor' check (role in ('admin','editor','viewer')),
  status text not null default 'pending' check (status in ('pending','approved','declined')),
  created_at timestamptz not null default now(),
  decided_at timestamptz,
  unique (band_profile_id, member_user_id)
);

alter table public.band_members enable row level security;

-- Both the SELECT policy and the UPDATE policy below need to answer "is
-- this user an approved admin of this band?" — and both need that answer
-- while evaluating a policy ON band_members itself. A plain EXISTS
-- subquery against the same table re-triggers that table's own RLS
-- policies for the subquery, which triggers the same subquery again, and
-- Postgres correctly refuses that as infinite recursion (confirmed
-- locally: this is not a theoretical concern, it errors immediately).
-- A SECURITY DEFINER function sidesteps this the same way award_xp() in
-- xp_schema.sql sidesteps RLS to write a column no client can — its
-- internal query runs as the function owner and never re-enters the
-- calling policy.
create or replace function public.is_band_admin(p_band_profile_id uuid, p_user_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public
as $$
  select exists (
    select 1 from public.band_members
    where band_profile_id = p_band_profile_id
      and member_user_id = p_user_id
      and status = 'approved'
      and role = 'admin'
  );
$$;

-- Approved memberships are public (a band's profile page can show who's
-- in it); a pending/declined row is only visible to the person who
-- requested it, the band account itself, and any of the band's own
-- already-approved admins (who also need to see pending requests in
-- order to act on them — UPDATE in Postgres RLS requires a row to pass
-- the table's SELECT policy too, not just the UPDATE policy's USING
-- clause, so this list must match who the UPDATE policy below allows).
drop policy if exists "band membership visibility" on public.band_members;
create policy "band membership visibility"
  on public.band_members for select
  using (
    status = 'approved'
    or auth.uid() = member_user_id
    or auth.uid() = band_profile_id
    or public.is_band_admin(band_profile_id, auth.uid())
  );

-- Joining is a self-service request: you can only file it for yourself,
-- it starts pending, and you can't hand yourself a role above 'editor'.
drop policy if exists "request to join a band" on public.band_members;
create policy "request to join a band"
  on public.band_members for insert
  with check (
    auth.uid() = member_user_id
    and status = 'pending'
    and role in ('editor','viewer')
    and member_user_id <> band_profile_id
  );

-- Approving/declining/re-role a request: only the band account itself, or
-- one of its own already-approved 'admin' members, can do this — never
-- the requester themselves (they're not yet an approved admin of a band
-- they're not yet a member of, so this can't be used to self-approve).
drop policy if exists "band owner or admin manage membership" on public.band_members;
create policy "band owner or admin manage membership"
  on public.band_members for update
  using (
    auth.uid() = band_profile_id
    or public.is_band_admin(band_profile_id, auth.uid())
  )
  with check (
    auth.uid() = band_profile_id
    or public.is_band_admin(band_profile_id, auth.uid())
  );

-- Leaving (member) or removing a member (band account) — either side can
-- delete the row.
drop policy if exists "leave or remove band member" on public.band_members;
create policy "leave or remove band member"
  on public.band_members for delete
  using (auth.uid() = member_user_id or auth.uid() = band_profile_id);

-- ===== approved band members can edit the band's profile page =====
-- Additive policies (Postgres OR's multiple permissive policies of the
-- same command together), so these only ever widen access on top of the
-- existing auth.uid() = id policy — never touches or risks it.
drop policy if exists "approved band members edit band profile" on public.profiles;
create policy "approved band members edit band profile"
  on public.profiles for update
  using (
    exists (
      select 1 from public.band_members bm
      where bm.band_profile_id = profiles.id
        and bm.member_user_id = auth.uid()
        and bm.status = 'approved'
        and bm.role in ('admin','editor')
    )
  );

drop policy if exists "approved band members manage band rate card" on public.artist_rate_cards;
create policy "approved band members manage band rate card"
  on public.artist_rate_cards for all
  using (
    exists (
      select 1 from public.band_members bm
      where bm.band_profile_id = artist_rate_cards.user_id
        and bm.member_user_id = auth.uid()
        and bm.status = 'approved'
        and bm.role in ('admin','editor')
    )
  )
  with check (
    exists (
      select 1 from public.band_members bm
      where bm.band_profile_id = artist_rate_cards.user_id
        and bm.member_user_id = auth.uid()
        and bm.status = 'approved'
        and bm.role in ('admin','editor')
    )
  );
