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
