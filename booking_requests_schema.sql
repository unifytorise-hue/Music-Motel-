-- Music Motel quoting / RFQ / invoicing schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql to already be applied.

-- ===== artist quick-reply rate presets =====
-- Lets an artist save named prices ("2hr acoustic set - $250") so they can
-- respond to a request with one tap instead of typing a custom quote
-- every time.
create table public.artist_rates (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  label text not null,
  amount numeric(10,2) not null check (amount > 0),
  created_at timestamptz not null default now()
);

alter table public.artist_rates enable row level security;

create policy "rates are publicly readable"
  on public.artist_rates for select
  using (true);

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
create table public.booking_requests (
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

create policy "clients and artists see their own requests"
  on public.booking_requests for select
  using (auth.uid() = client_id or auth.uid() = artist_id);

create policy "clients create requests"
  on public.booking_requests for insert
  with check (auth.uid() = client_id and client_id <> artist_id);

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

create trigger trg_enforce_booking_request_edits
  before update on public.booking_requests
  for each row execute function public.enforce_booking_request_edits();
