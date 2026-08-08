-- Music Motel — profile visibility + column-grant fix
-- Run once in Supabase Dashboard -> SQL Editor -> New query -> Run.
--
-- Fixes two bugs found in a full-codebase scan:
--
-- 1) profiles' SELECT policy was `using (true)` — every column of every
--    profile was readable by anyone (including anon), regardless of
--    profile_visibility/hide_exact_location/hide_rate. Those flags were
--    only ever enforced by client-side JS (window.mmCanViewProfile), which
--    filters *after* the full row already left the database. This
--    replaces it with a policy that mirrors mmCanViewProfile's own logic
--    exactly (js/icons.js) at the row level, in the database, where it
--    actually matters.
--
-- 2) profiles' column-level UPDATE grant (added in xp_schema.sql to stop
--    clients writing to `xp` directly) was never widened as new profile
--    columns were added since — availability, music taste, profile
--    template, phone, PRO membership, privacy settings themselves,
--    skills/genres/languages/gear/touring level, boost, and ID/phone
--    verification all currently fail outright with "permission denied for
--    table profiles" when a real signed-in user tries to save them.
--    Widens the grant for every column that's safe for a user to set
--    about themselves directly. The columns that assert something was
--    independently *verified* (phone_verified_at, id_verified_at and its
--    companions, boosted_until/boost_started_at/boost_amount_paid) stay
--    out of the direct grant — same reasoning as the original xp
--    protection — and get narrow SECURITY DEFINER functions instead, each
--    hardcoded to auth.uid() so there's no way to pass someone else's id.

-- ===== 1) profiles SELECT policy: respect profile_visibility =====
drop policy if exists "profiles are viewable by everyone" on public.profiles;
create policy "profiles are visible per their own privacy setting"
  on public.profiles for select
  using (
    auth.uid() = id
    or profile_visibility = 'public'
    or (
      profile_visibility = 'followers_only'
      and (
        exists (
          select 1 from public.follows f
          where f.follower_id = auth.uid() and f.following_id = profiles.id
        )
        or exists (
          select 1 from public.follows f
          where f.follower_id = profiles.id and f.following_id = auth.uid()
        )
      )
    )
  );

-- ===== 2) profiles UPDATE grant: add every column that's safe for a user
-- to set about themselves directly (self-reported preferences/info, not a
-- claim of independent verification) =====
revoke update on public.profiles from authenticated, anon;
grant update (
  account_type, name, role_label, bio, location_label, lat, lng,
  avatar_color, avatar_url, instruments, distance_unit, currency, profile_kind,
  availability_status, availability_until,
  favorite_bands, favorite_songs, want_to_see_live,
  profile_template,
  phone,
  pro_membership_org, pro_membership_number,
  profile_visibility, hide_rate, hide_exact_location,
  genres, software, languages, gear_list, touring_level,
  id_verification_consent_at
) on public.profiles to authenticated;

-- ===== 3) trust-sensitive fields: narrow SECURITY DEFINER functions
-- instead of a direct grant, so a user can only ever mark *their own*
-- phone/ID as verified or apply a boost to *their own* profile — never
-- someone else's, and never by directly claiming a value via .update() =====

create or replace function public.mark_phone_verified(p_phone text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set phone = p_phone, phone_verified_at = now()
  where id = auth.uid();
end;
$$;
revoke all on function public.mark_phone_verified(text) from public;
grant execute on function public.mark_phone_verified(text) to authenticated;

create or replace function public.mark_id_verified(p_confidence numeric, p_session_id text, p_provider text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set id_verified_at = now(),
      id_verification_confidence = p_confidence,
      id_verification_session_id = p_session_id,
      id_verification_provider = p_provider
  where id = auth.uid();
end;
$$;
revoke all on function public.mark_id_verified(numeric, text, text) from public;
grant execute on function public.mark_id_verified(numeric, text, text) to authenticated;

-- Deletion right (POPIA/GDPR/CPRA access-and-deletion, BIPA destruction) —
-- clears the verification result AND the consent record itself.
create or replace function public.clear_id_verification()
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.profiles
  set id_verified_at = null,
      id_verification_confidence = null,
      id_verification_session_id = null,
      id_verification_provider = null,
      id_verification_consent_at = null
  where id = auth.uid();
end;
$$;
revoke all on function public.clear_id_verification() from public;
grant execute on function public.clear_id_verification() to authenticated;

-- Price is looked up server-side from p_days (matching js/boost.js's
-- DURATION_PRICES exactly) rather than trusting a client-supplied amount —
-- boost purchases are simulated today (no payment gateway is connected
-- yet), but boost_amount_paid shouldn't be client-writable to an arbitrary
-- value regardless. Stacks onto the current boosted_until if it's still in
-- the future (a renewal), computed from the row's actual stored value, not
-- whatever the client last read.
create or replace function public.apply_profile_boost(p_days integer)
returns public.profiles
language plpgsql
security definer
set search_path = public
as $$
declare
  v_price numeric;
  v_current timestamptz;
  v_base timestamptz;
  v_row public.profiles;
begin
  v_price := case p_days
    when 7 then 9
    when 14 then 15
    when 30 then 25
    else null
  end;
  if v_price is null then
    raise exception 'invalid boost duration: %', p_days;
  end if;

  select boosted_until into v_current from public.profiles where id = auth.uid();
  v_base := greatest(coalesce(v_current, now()), now());

  update public.profiles
  set boosted_until = v_base + (p_days || ' days')::interval,
      boost_started_at = now(),
      boost_amount_paid = v_price
  where id = auth.uid()
  returning * into v_row;

  return v_row;
end;
$$;
revoke all on function public.apply_profile_boost(integer) from public;
grant execute on function public.apply_profile_boost(integer) to authenticated;
