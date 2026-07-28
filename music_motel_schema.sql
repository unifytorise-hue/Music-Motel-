-- Music Motel: base schema (profiles, gig_log, follows, referral_codes,
-- referrals, gear_listings, gear_claims).
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run,
-- BEFORE any other *_schema.sql file in this repo — every later file
-- assumes these tables already exist.
--
-- Reconstructed from the live frontend code (every .from()/.select()/
-- .insert()/.eq() call across js/*.js) rather than a saved source file —
-- the original handoff schema was applied directly to a Supabase project
-- in an earlier session and never committed here. Every table and column
-- below is required by, and only by, code already in this repo; verified
-- idempotent (run twice, zero errors) against a local Postgres 16
-- instance before being run against the real (previously empty) project.
--
-- No explicit GRANTs here, same convention as every later *_schema.sql
-- file: Supabase's default privileges already grant table-wide access to
-- authenticated/anon on any new table, and RLS below is the real
-- boundary. xp_schema.sql deliberately narrows profiles' default grant
-- later, once the xp column exists and needs protecting from that.

create extension if not exists pgcrypto;

-- ===== profiles =====
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  account_type text not null default 'fan' check (account_type in ('fan','musician','educator','venue','publicspace')),
  name text not null default '',
  role_label text not null default '',
  bio text not null default '',
  location_label text not null default '',
  lat double precision,
  lng double precision,
  avatar_color text not null default '#2BE8D9',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are viewable by everyone"
  on public.profiles for select
  using (true);

drop policy if exists "users insert their own profile" on public.profiles;
create policy "users insert their own profile"
  on public.profiles for insert
  with check (auth.uid() = id);

drop policy if exists "users update their own profile" on public.profiles;
create policy "users update their own profile"
  on public.profiles for update
  using (auth.uid() = id);

-- ===== gig log (a fan's personal list of gigs attended) =====
create table if not exists public.gig_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  artist text not null default '',
  venue text not null default '',
  date_text text not null default '',
  created_at timestamptz not null default now()
);

alter table public.gig_log enable row level security;

drop policy if exists "users manage their own gig log" on public.gig_log;
create policy "users manage their own gig log"
  on public.gig_log for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== follows (fans following artists) =====
create table if not exists public.follows (
  id uuid primary key default gen_random_uuid(),
  follower_id uuid not null references auth.users(id) on delete cascade,
  following_id uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (follower_id, following_id),
  check (follower_id <> following_id)
);

alter table public.follows enable row level security;

drop policy if exists "follows visible to participants" on public.follows;
create policy "follows visible to participants"
  on public.follows for select
  using (auth.uid() = follower_id or auth.uid() = following_id);

drop policy if exists "users manage their own follows" on public.follows;
create policy "users manage their own follows"
  on public.follows for all
  using (auth.uid() = follower_id)
  with check (auth.uid() = follower_id);

-- ===== referral codes (one stable invite code per signed-up user) =====
create table if not exists public.referral_codes (
  user_id uuid primary key references auth.users(id) on delete cascade,
  code text not null unique,
  created_at timestamptz not null default now()
);

alter table public.referral_codes enable row level security;

-- Publicly readable: signup needs to resolve a stranger's invite code
-- back to their user_id to credit the referral, before the new visitor
-- has an account of their own.
drop policy if exists "referral codes are publicly readable" on public.referral_codes;
create policy "referral codes are publicly readable"
  on public.referral_codes for select
  using (true);

drop policy if exists "users create their own referral code" on public.referral_codes;
create policy "users create their own referral code"
  on public.referral_codes for insert
  with check (auth.uid() = user_id);

-- ===== referrals (a signup credited to whoever referred them) =====
create table if not exists public.referrals (
  id uuid primary key default gen_random_uuid(),
  referrer_user_id uuid not null references auth.users(id) on delete cascade,
  referred_user_id uuid not null unique references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  check (referrer_user_id <> referred_user_id)
);

alter table public.referrals enable row level security;

drop policy if exists "referrals visible to participants" on public.referrals;
create policy "referrals visible to participants"
  on public.referrals for select
  using (auth.uid() = referrer_user_id or auth.uid() = referred_user_id);

-- A new signup can only ever record a referral for themselves (as the
-- referred party), never fabricate one crediting someone else's account.
drop policy if exists "a new signup records their own referral" on public.referrals;
create policy "a new signup records their own referral"
  on public.referrals for insert
  with check (auth.uid() = referred_user_id);

-- ===== gear donation board =====
create table if not exists public.gear_listings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  category text not null default 'Other',
  condition text not null default '',
  location_label text not null default '',
  created_at timestamptz not null default now()
);

alter table public.gear_listings enable row level security;

drop policy if exists "gear listings are publicly readable" on public.gear_listings;
create policy "gear listings are publicly readable"
  on public.gear_listings for select
  using (true);

drop policy if exists "owners manage their own gear listings" on public.gear_listings;
create policy "owners manage their own gear listings"
  on public.gear_listings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- claimed_by, not user_id — the claimer is never the lister (enforced
-- below), so a distinct column name avoids confusion with gear_listings.
create table if not exists public.gear_claims (
  id uuid primary key default gen_random_uuid(),
  gear_id uuid not null unique references public.gear_listings(id) on delete cascade,
  claimed_by uuid not null references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.gear_claims enable row level security;

drop policy if exists "gear claims are publicly readable" on public.gear_claims;
create policy "gear claims are publicly readable"
  on public.gear_claims for select
  using (true);

drop policy if exists "signed-in users claim gear" on public.gear_claims;
create policy "signed-in users claim gear"
  on public.gear_claims for insert
  with check (auth.uid() = claimed_by);
