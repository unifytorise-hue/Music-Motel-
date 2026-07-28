-- Music Motel real XP schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql to already be applied (profiles, gig_log,
-- referrals, gear_listings, gear_claims must exist).

-- ===== xp column =====
alter table public.profiles add column if not exists xp integer not null default 0;

-- XP is never written directly by a client. profiles already has a broad
-- "users update their own profile" RLS policy (auth.uid() = id, no column
-- restriction), and Supabase's default privileges grant authenticated a
-- table-wide UPDATE on every new table — which together would let anyone
-- set their own xp to anything via the exposed Supabase client.
--
-- Revoking UPDATE on just the xp column is NOT enough to stop that: a
-- table-wide UPDATE grant covers every column on its own, so a
-- column-specific revoke layered on top of it has no effect (verified
-- locally — the revoke-only version of this migration still let a plain
-- `update profiles set xp = ...` through). The fix is to revoke the
-- table-wide grant entirely and re-grant UPDATE only on the columns a
-- user should actually be able to edit themselves. RLS still governs
-- which *rows* (auth.uid() = id); this governs which *columns*.
revoke update on public.profiles from authenticated, anon;
grant update (account_type, name, role_label, bio, location_label, lat, lng, avatar_color)
  on public.profiles to authenticated;

create or replace function public.award_xp(p_user_id uuid, p_amount integer)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles set xp = xp + p_amount where id = p_user_id;
end;
$$;

-- ===== +10 XP: logging a gig =====
create or replace function public.on_gig_log_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_xp(new.user_id, 10);
  return new;
end;
$$;

drop trigger if exists trg_gig_log_xp on public.gig_log;
create trigger trg_gig_log_xp
  after insert on public.gig_log
  for each row execute function public.on_gig_log_insert();

-- ===== +25 XP: a referral converts (someone you invited signs up) =====
-- referrals.referred_user_id is unique, so this can only fire once per
-- person you referred — no repeat-farming the same signup.
create or replace function public.on_referral_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform public.award_xp(new.referrer_user_id, 25);
  return new;
end;
$$;

drop trigger if exists trg_referral_xp on public.referrals;
create trigger trg_referral_xp
  after insert on public.referrals
  for each row execute function public.on_referral_insert();

-- ===== +20 XP: gear you listed gets claimed =====
create or replace function public.on_gear_claim_insert()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_lister uuid;
begin
  select user_id into v_lister from public.gear_listings where id = new.gear_id;
  if v_lister is not null then
    perform public.award_xp(v_lister, 20);
  end if;
  return new;
end;
$$;

drop trigger if exists trg_gear_claim_xp on public.gear_claims;
create trigger trg_gear_claim_xp
  after insert on public.gear_claims
  for each row execute function public.on_gear_claim_insert();

-- Postgres grants EXECUTE on a new function to PUBLIC by default, which
-- authenticated/anon inherit — so without this, award_xp is directly
-- callable via POST /rest/v1/rpc/award_xp with an arbitrary p_user_id and
-- p_amount, letting anyone hand out unlimited XP to anyone. Confirmed
-- exploitable locally before this revoke, confirmed blocked (and the
-- trigger-driven flow still works) after it: a trigger's call to another
-- SECURITY DEFINER function runs under that function's owner, not the
-- calling client role, so this doesn't touch the legitimate path at all.
revoke execute on function public.award_xp(uuid, integer) from authenticated, anon, public;
revoke execute on function public.on_gig_log_insert() from authenticated, anon, public;
revoke execute on function public.on_referral_insert() from authenticated, anon, public;
revoke execute on function public.on_gear_claim_insert() from authenticated, anon, public;
