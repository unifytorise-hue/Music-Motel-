-- Music Motel booking reviews schema
-- Run this once in Supabase Dashboard -> SQL Editor -> New query -> Run.
-- Requires music_motel_schema.sql and booking_requests_schema.sql to
-- already be applied.

-- One review per completed booking, left by the client who booked it.
-- Reviews are immutable once posted (no update/delete policy granted) —
-- matches how real review systems work, and keeps this simple rather
-- than building an edit/moderation flow nobody asked for yet.
create table public.booking_reviews (
  id uuid primary key default gen_random_uuid(),
  booking_request_id uuid not null unique references public.booking_requests(id) on delete cascade,
  reviewer_id uuid not null references auth.users(id) on delete cascade,
  reviewee_id uuid not null references auth.users(id) on delete cascade,
  rating smallint not null check (rating between 1 and 5),
  comment text not null default '',
  created_at timestamptz not null default now()
);

alter table public.booking_reviews enable row level security;

create policy "reviews are publicly readable"
  on public.booking_reviews for select
  using (true);

-- A single INSERT policy does all the enforcement here: you can only
-- review a booking where you were the client, the reviewee actually was
-- the artist on that booking, and the booking is completed. No separate
-- trigger needed since there's no UPDATE/DELETE path to guard.
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
