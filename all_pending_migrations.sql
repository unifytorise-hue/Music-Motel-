-- Music Motel: run all pending migrations in one paste
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql (the original handoff schema — profiles,
-- gig_log, referrals, referral_codes, gear_listings, gear_claims) to
-- already be applied.
--
-- This is a straight concatenation of xp_schema.sql, then
-- booking_requests_schema.sql, then booking_reviews_schema.sql, then
-- instruments_schema.sql, then rate_card_schema.sql, then
-- bands_and_prefs_schema.sql, in that order. Every statement across all
-- six is idempotent (create table if not exists, drop-then-create for
-- policies and triggers, create or replace for functions, add column if
-- not exists) — verified locally by running this exact file twice in a
-- row against the same database with zero errors both times. That means
-- it's safe to paste this whole file in regardless of which of the six
-- you may have already run individually before.
--
-- Going forward, treat the six individual files as the source of truth
-- for what each migration does; this file is a convenience snapshot for
-- catching a project up in one paste and won't be kept byte-for-byte in
-- sync if an individual file changes later — re-concatenate if needed.

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


-- Music Motel quoting / RFQ / invoicing schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql to already be applied.

-- ===== artist quick-reply rate presets =====
-- Lets an artist save named prices ("2hr acoustic set - $250") so they can
-- respond to a request with one tap instead of typing a custom quote
-- every time.
create table if not exists public.artist_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.artist_rates enable row level security;

drop policy if exists "rates are publicly readable" on public.artist_rates;
create policy "rates are publicly readable"
  on public.artist_rates for select
  using (true);

drop policy if exists "artists manage their own rates" on public.artist_rates;
create policy "artists manage their own rates"
  on public.artist_rates for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== booking requests: RFQ -> quote -> accept/decline -> completed =====
-- A "proforma" is just this row's quote_amount + platform_fee_rate once
-- status = 'quoted', rendered client-side as an itemized estimate. Once
-- status = 'completed', the same row is rendered as the invoice. No
-- separate documents table — there's nothing an invoice needs that this
-- row doesn't already have.
create table if not exists public.booking_requests (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references auth.users(id) on delete cascade,
  artist_id uuid not null references auth.users(id) on delete cascade,
  event_type text not null default 'Other',
  event_date text not null default '',
  location_label text not null default '',
  details text not null default '',
  status text not null default 'requested'
    check (status in ('requested','quoted','accepted','declined','completed','cancelled')),
  quote_amount numeric(10,2),
  platform_fee_rate numeric(4,3) not null default 0.10,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.booking_requests enable row level security;

drop policy if exists "clients and artists see their own requests" on public.booking_requests;
create policy "clients and artists see their own requests"
  on public.booking_requests for select
  using (auth.uid() = client_id or auth.uid() = artist_id);

drop policy if exists "clients create requests" on public.booking_requests;
create policy "clients create requests"
  on public.booking_requests for insert
  with check (auth.uid() = client_id and client_id <> artist_id);

drop policy if exists "clients and artists can update their own requests" on public.booking_requests;
create policy "clients and artists can update their own requests"
  on public.booking_requests for update
  using (auth.uid() = client_id or auth.uid() = artist_id)
  with check (auth.uid() = client_id or auth.uid() = artist_id);

-- The policy above is row-level only (either party may touch the row).
-- Client and artist are the same Postgres role, so column-level GRANTs
-- can't tell them apart on this table the way xp_schema.sql's revoke/grant
-- split could for a single "don't let anyone touch this column" rule.
-- This trigger enforces who may change what, comparing OLD vs NEW: the
-- artist may only move status to quoted/completed and set quote_amount;
-- the client may only move status to accepted/declined/cancelled and can
-- never touch the quote itself.
create or replace function public.enforce_booking_request_edits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  new.updated_at := now();

  if caller = old.artist_id then
    if new.client_id <> old.client_id
       or new.artist_id <> old.artist_id
       or new.event_type <> old.event_type
       or new.event_date <> old.event_date
       or new.location_label <> old.location_label
       or new.details <> old.details
       or new.platform_fee_rate <> old.platform_fee_rate
    then
      raise exception 'Artists can only update status and quote_amount.';
    end if;
    if new.status is distinct from old.status then
      if new.status not in ('quoted', 'completed') then
        raise exception 'Artists can only set status to quoted or completed.';
      end if;
      if new.status = 'completed' and old.status <> 'accepted' then
        raise exception 'A request must be accepted before it can be marked completed.';
      end if;
    end if;

  elsif caller = old.client_id then
    if new.quote_amount is distinct from old.quote_amount
       or new.artist_id <> old.artist_id
       or new.event_type <> old.event_type
       or new.event_date <> old.event_date
       or new.location_label <> old.location_label
       or new.details <> old.details
       or new.platform_fee_rate <> old.platform_fee_rate
    then
      raise exception 'Clients cannot modify the quote.';
    end if;
    if new.status is distinct from old.status then
      if new.status not in ('accepted', 'declined', 'cancelled') then
        raise exception 'Clients can only accept, decline, or cancel.';
      end if;
      if new.status in ('accepted', 'declined') and old.status <> 'quoted' then
        raise exception 'A request must be quoted before it can be accepted or declined.';
      end if;
    end if;

  else
    raise exception 'Not authorized to update this request.';
  end if;

  return new;
end;
$$;

drop trigger if exists trg_enforce_booking_request_edits on public.booking_requests;
create trigger trg_enforce_booking_request_edits
  before update on public.booking_requests
  for each row execute function public.enforce_booking_request_edits();


-- Music Motel booking reviews schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql and booking_requests_schema.sql to
-- already be applied.

-- One review per completed booking, left by the client who booked it.
-- Reviews are immutable once posted (no update/delete policy granted) —
-- matches how real review systems work, and keeps this simple rather
-- than building an edit/moderation flow nobody asked for yet.
create table if not exists public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique references public.booking_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

alter table public.booking_reviews enable row level security;

drop policy if exists "reviews are publicly readable" on public.booking_reviews;
create policy "reviews are publicly readable"
  on public.booking_reviews for select
  using (true);

-- A single INSERT policy does all the enforcement here: you can only
-- review a booking where you were the client, the reviewee actually was
-- the artist on that booking, and the booking is completed. No separate
-- trigger needed since there's no UPDATE/DELETE path to guard.
drop policy if exists "clients can review their own completed bookings once" on public.booking_reviews;
create policy "clients can review their own completed bookings once"
  on public.booking_reviews for insert
  with check (
    auth.uid() = reviewer_id
    and exists (
      select 1 from public.booking_requests br
      where br.id = booking_request_id
        and br.client_id = auth.uid()
        and br.artist_id = reviewee_id
        and br.status = 'completed'
    )
  );


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


-- Music Motel: artist rate cards + booking-agent terms + richer RFQ fields
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql and booking_requests_schema.sql to
-- already be applied.

-- ===== one structured, industry-standard rate card per artist =====
-- Distinct from artist_rates (arbitrary named quick-reply presets, e.g.
-- "2hr acoustic set - $250") — this is the single standing estimate shown
-- to a client the moment they open a request, before any back-and-forth.
create table if not exists public.artist_rate_cards (
  user_id uuid primary key references auth.users(id) on delete cascade,
  pricing_basis text not null default 'gig' check (pricing_basis in ('hour','gig','set_45min')),
  rate_amount numeric(10,2),
  travel_note text not null default '',
  accommodation_required boolean not null default false,
  food_drink_required boolean not null default false,
  has_own_equipment boolean not null default true,
  equipment_note text not null default '',
  -- Null until the artist ticks through the booking-agent terms below.
  -- Gates rate-card creation/editing on the client, and is the "tick list
  -- contract" record of when they opted in.
  booking_agent_terms_accepted_at timestamptz,
  updated_at timestamptz not null default now()
);

alter table public.artist_rate_cards enable row level security;

drop policy if exists "rate cards are publicly readable" on public.artist_rate_cards;
create policy "rate cards are publicly readable"
  on public.artist_rate_cards for select
  using (true);

drop policy if exists "artists manage their own rate card" on public.artist_rate_cards;
create policy "artists manage their own rate card"
  on public.artist_rate_cards for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- ===== richer initial request: time + optional client budget =====
-- event_date/location_label/details/event_type already exist. Client sets
-- these once on insert; the trigger below (re-declared to include them)
-- keeps them immutable after that, same as the fields it already guarded.
alter table public.booking_requests add column if not exists event_time text not null default '';
alter table public.booking_requests add column if not exists budget_amount numeric(10,2);

create or replace function public.enforce_booking_request_edits()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  caller uuid := auth.uid();
begin
  new.updated_at := now();

  if caller = old.artist_id then
    if new.client_id <> old.client_id
       or new.artist_id <> old.artist_id
       or new.event_type <> old.event_type
       or new.event_date <> old.event_date
       or new.event_time <> old.event_time
       or new.location_label <> old.location_label
       or new.details <> old.details
       or new.budget_amount is distinct from old.budget_amount
       or new.platform_fee_rate <> old.platform_fee_rate
    then
      raise exception 'Artists can only update status and quote_amount.';
    end if;
    if new.status is distinct from old.status then
      if new.status not in ('quoted', 'completed') then
        raise exception 'Artists can only set status to quoted or completed.';
      end if;
      if new.status = 'completed' and old.status <> 'accepted' then
        raise exception 'A request must be accepted before it can be marked completed.';
      end if;
    end if;

  elsif caller = old.client_id then
    if new.quote_amount is distinct from old.quote_amount
       or new.artist_id <> old.artist_id
       or new.event_type <> old.event_type
       or new.event_date <> old.event_date
       or new.event_time <> old.event_time
       or new.location_label <> old.location_label
       or new.details <> old.details
       or new.budget_amount is distinct from old.budget_amount
       or new.platform_fee_rate <> old.platform_fee_rate
    then
      raise exception 'Clients cannot modify the quote.';
    end if;
    if new.status is distinct from old.status then
      if new.status not in ('accepted', 'declined', 'cancelled') then
        raise exception 'Clients can only accept, decline, or cancel.';
      end if;
      if new.status in ('accepted', 'declined') and old.status <> 'quoted' then
        raise exception 'A request must be quoted before it can be accepted or declined.';
      end if;
    end if;

  else
    raise exception 'Not authorized to update this request.';
  end if;

  return new;
end;
$$;

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
