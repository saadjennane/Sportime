-- Cancel a pending F1 bet and refund its stake (only while the market is still open).
CREATE OR REPLACE FUNCTION public.f1_cancel_bet(p_race_id bigint, p_market_key text, p_entity_id bigint, p_selection text)
RETURNS TABLE(success boolean, new_balance integer)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
declare
  v_user uuid := auth.uid();
  v_lock timestamptz; v_balance integer; v_existing public.f1_bets%rowtype;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;

  select * into v_existing from public.f1_bets
   where user_id=v_user and race_id=p_race_id and market_key=p_market_key
     and coalesce(entity_id,-1)=coalesce(p_entity_id,-1)
     and coalesce(selection,'')=coalesce(p_selection,'') for update;
  if not found then raise exception 'No bet to cancel'; end if;
  if v_existing.status <> 'pending' then raise exception 'Bet already settled'; end if;

  select locks_at into v_lock from public.f1_odds
   where race_id=p_race_id and market_key=p_market_key
     and coalesce(entity_id,-1)=coalesce(p_entity_id,-1)
     and coalesce(selection,'')=coalesce(p_selection,'');
  if v_lock is not null and v_lock <= now() then raise exception 'Market closed'; end if;

  update public.users set coins_balance = coins_balance + v_existing.stake where id=v_user returning coins_balance into v_balance;
  delete from public.f1_bets where id = v_existing.id;

  return query select true, v_balance;
end $function$;

grant execute on function public.f1_cancel_bet(bigint,text,bigint,text) to authenticated;
