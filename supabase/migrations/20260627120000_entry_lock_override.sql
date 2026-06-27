-- Per-game entry-lock override: an explicit date/time that supersedes the computed
-- "first kickoff − 15 min" rule. Null = use the automatic rule.

alter table public.challenges      add column if not exists entry_lock_at timestamptz;
alter table public.fantasy_games   add column if not exists entry_lock_at timestamptz;
alter table public.tq_competitions add column if not exists entry_lock_at timestamptz;
alter table public.f1_pred_games   add column if not exists entry_lock_at timestamptz;
alter table public.f1_duel_games   add column if not exists entry_lock_at timestamptz;
alter table public.f1_fantasy_games add column if not exists entry_lock_at timestamptz;

-- Single admin-gated setter for every game family (used on create + edit).
create or replace function public.set_entry_lock(p_kind text, p_id uuid, p_lock timestamptz)
returns void language plpgsql security definer set search_path to 'public' as $$
begin
  if public.is_admin() is not true then raise exception 'admin only'; end if;
  case p_kind
    when 'challenge'  then update public.challenges       set entry_lock_at = p_lock where id = p_id;
    when 'fantasy'    then update public.fantasy_games    set entry_lock_at = p_lock where id = p_id;
    when 'tq'         then update public.tq_competitions  set entry_lock_at = p_lock where id = p_id;
    when 'f1pred'     then update public.f1_pred_games    set entry_lock_at = p_lock where id = p_id;
    when 'f1duel'     then update public.f1_duel_games    set entry_lock_at = p_lock where id = p_id;
    when 'f1fantasy'  then update public.f1_fantasy_games set entry_lock_at = p_lock where id = p_id;
    else raise exception 'unknown kind %', p_kind;
  end case;
end $$;

grant execute on function public.set_entry_lock(text, uuid, timestamptz) to authenticated, anon, service_role;
