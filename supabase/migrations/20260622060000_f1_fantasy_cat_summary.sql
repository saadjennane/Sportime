-- Admin helper: drivers/constructors grouped by dynamic category (for the Fantasy F1 admin overview).
create or replace function public.f1_fantasy_cat_summary(p_kind text)
returns table(category text, names text)
language plpgsql security definer set search_path to 'public' as $function$
begin
  if p_kind = 'driver' then
    return query
      select d.category, string_agg(coalesce(d.last_name, d.name), ', ' order by d.rating desc nulls last)
      from public.f1_drivers d
      where d.season = (select max(season) from public.f1_drivers) and d.category is not null
      group by d.category;
  else
    return query
      select c.category, string_agg(c.name, ', ' order by c.position)
      from public.f1_constructors c
      where c.season = (select max(season) from public.f1_constructors) and c.category is not null
      group by c.category;
  end if;
end $function$;
grant execute on function public.f1_fantasy_cat_summary(text) to authenticated;
