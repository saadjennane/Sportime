-- League visibility: only these leagues appear in Today and are pickable. Hidden
-- leagues still power Fan Pulse / Dream XI player pools (they're just not shown).
update public.fb_leagues set is_visible = false;
update public.fb_leagues set is_visible = true
where api_id in (140, 39, 135, 78, 61, 94, 71, 128, 253, 307, 1, 2, 10, 3, 848);
