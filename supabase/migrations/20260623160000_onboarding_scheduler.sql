-- Onboarding push scheduler (ON-2 first pick / ON-3 coins / ON-4 join game).
-- Needs a signup timestamp + per-user state. registered_at is stamped at registration.
alter table public.users add column if not exists registered_at timestamptz;

-- Backfill ONLY real (registered) users to their creation time — guests never registered,
-- so their registered_at stays null (otherwise they'd inflate the "signups" metric).
update public.users set registered_at = coalesce(created_at, now())
  where registered_at is null and user_type in ('user', 'admin', 'super_admin');

-- Stamp registered_at on (first) registration, alongside the signup bonus.
create or replace function public.complete_guest_registration(p_username text, p_display_name text, p_email text)
 returns users language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  v_updated public.users;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Authentication required'; END IF;
  SELECT signup_bonus_granted INTO v_already FROM public.users WHERE id = auth.uid();
  UPDATE public.users SET
    username = COALESCE(NULLIF(trim(p_username), ''), username, public.generate_guest_username()),
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name, username),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    user_type = 'user',
    registered_at = COALESCE(registered_at, now()),
    updated_at = now()
  WHERE id = auth.uid() RETURNING * INTO v_updated;
  IF NOT FOUND THEN RAISE EXCEPTION 'User profile not found'; END IF;
  IF COALESCE(v_already, false) = false THEN
    BEGIN
      PERFORM public.add_coins(v_updated.id, 1000, 'initial_bonus', '{"reason":"signup_bonus"}'::jsonb);
      PERFORM public.grant_ticket(v_updated.id, 'amateur', 'signup_bonus');
      PERFORM public.grant_ticket(v_updated.id, 'amateur', 'signup_bonus');
      PERFORM public.grant_ticket(v_updated.id, 'amateur', 'signup_bonus');
      UPDATE public.users SET signup_bonus_granted = true WHERE id = v_updated.id RETURNING * INTO v_updated;
    EXCEPTION WHEN OTHERS THEN
      RAISE WARNING 'signup bonus grant failed for %: %', v_updated.id, SQLERRM;
    END;
  END IF;
  RETURN v_updated;
END;
$function$;

-- Candidates = recent signups (last 3 days) with an active push subscription, plus the
-- state the scheduler needs (hours since signup, whether they've picked / joined a game).
create or replace function public.onboarding_candidates()
returns table(user_id uuid, timezone text, hours_since_reg numeric, has_pick boolean, has_game boolean)
language sql security definer set search_path to 'public' as $$
  select u.id, u.timezone,
    extract(epoch from now() - u.registered_at) / 3600.0,
    exists(select 1 from public.match_bets b where b.user_id = u.id),
    (exists(select 1 from public.challenge_participants c where c.user_id = u.id)
      or exists(select 1 from public.tq_entries t where t.user_id = u.id)
      or exists(select 1 from public.live_game_entries l where l.user_id = u.id)
      or exists(select 1 from public.user_fantasy_teams f where f.user_id = u.id))
  from public.users u
  where u.user_type = 'user'
    and u.registered_at is not null
    and u.registered_at > now() - interval '3 days'
    and exists (select 1 from public.user_onesignal_players p where p.user_id = u.id and p.is_active);
$$;
grant execute on function public.onboarding_candidates() to service_role;
