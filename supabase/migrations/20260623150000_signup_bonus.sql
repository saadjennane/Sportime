-- Onboarding O1 — signup grant. New users already start at 1000 coins (column default);
-- on registration we add a +1000 bonus and 3 amateur tickets, once per user.
alter table public.users add column if not exists signup_bonus_granted boolean not null default false;

-- Existing registered users already had their start — never retro-grant.
update public.users set signup_bonus_granted = true
  where user_type in ('user', 'admin', 'super_admin') and signup_bonus_granted = false;

create or replace function public.complete_guest_registration(p_username text, p_display_name text, p_email text)
 returns users language plpgsql security definer set search_path to 'public'
as $function$
DECLARE
  v_updated public.users;
  v_already boolean;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  SELECT signup_bonus_granted INTO v_already FROM public.users WHERE id = auth.uid();

  UPDATE public.users
  SET
    username = COALESCE(NULLIF(trim(p_username), ''), username, public.generate_guest_username()),
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name, username),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    user_type = 'user',
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  -- Signup bonus (once): +1000 coins on top of the 1000 starting balance, + 3 amateur tickets.
  -- Wrapped so a grant failure can never break registration itself.
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
