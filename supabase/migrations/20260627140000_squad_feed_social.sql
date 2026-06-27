-- Squad feed Phase 1a/1b: multi-emoji reactions, comments, and the member_joined auto-moment.
-- squad_feed / squad_feed_likes already exist (with RLS). This is additive.

-- ── Reactions: turn the binary like into a 6-emoji reaction (one per user/post) ──
alter table public.squad_feed_likes add column if not exists reaction text not null default '👍';
do $$ begin
  alter table public.squad_feed_likes add constraint squad_feed_likes_reaction_chk
    check (reaction in ('👍','🔥','😂','😮','💪','😭'));
exception when duplicate_object then null; end $$;
do $$ begin
  alter table public.squad_feed_likes add constraint squad_feed_likes_unique_user
    unique (post_id, user_id);
exception when duplicate_table then null; when duplicate_object then null; end $$;

-- ── Comments ────────────────────────────────────────────────────────────────
create table if not exists public.squad_feed_comments (
  id uuid primary key default gen_random_uuid(),
  post_id uuid not null references public.squad_feed(id) on delete cascade,
  user_id uuid not null references public.users(id) on delete cascade,
  body text not null check (char_length(body) between 1 and 500),
  created_at timestamptz not null default now()
);
create index if not exists squad_feed_comments_post on public.squad_feed_comments (post_id, created_at);
alter table public.squad_feed_comments enable row level security;

do $$ begin
  create policy "members view comments" on public.squad_feed_comments for select using (
    exists (select 1 from public.squad_feed sf
            join public.squad_members sm on sm.squad_id = sf.squad_id
            where sf.id = squad_feed_comments.post_id and sm.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "members add comments" on public.squad_feed_comments for insert with check (
    auth.uid() = user_id
    and exists (select 1 from public.squad_feed sf
                join public.squad_members sm on sm.squad_id = sf.squad_id
                where sf.id = squad_feed_comments.post_id and sm.user_id = auth.uid()));
exception when duplicate_object then null; end $$;
do $$ begin
  create policy "authors delete comments" on public.squad_feed_comments for delete using (auth.uid() = user_id);
exception when duplicate_object then null; end $$;

-- ── Extend post_type with auto-moment kinds ─────────────────────────────────
alter table public.squad_feed drop constraint if exists squad_feed_post_type_check;
alter table public.squad_feed add constraint squad_feed_post_type_check
  check (post_type = any (array[
    'celebration','announcement','game_linked',
    'member_joined','game_settled','lead_change','overtake','near_miss','bold_pick','streak'
  ]));

-- ── Auto-moment: member joined (safe, self-contained trigger) ───────────────
create or replace function public.squad_feed_on_member_joined()
returns trigger language plpgsql security definer set search_path to 'public' as $$
declare v_name text;
begin
  select coalesce(username, 'A new member') into v_name from public.users where id = new.user_id;
  insert into public.squad_feed (squad_id, user_id, post_type, content)
  values (new.squad_id, new.user_id, 'member_joined', '👋 ' || v_name || ' joined the squad');
  return new;
end $$;

drop trigger if exists trg_squad_feed_member_joined on public.squad_members;
create trigger trg_squad_feed_member_joined
  after insert on public.squad_members
  for each row execute function public.squad_feed_on_member_joined();

-- add-on to squad feed social: metadata for podium etc.
alter table public.squad_feed add column if not exists metadata jsonb not null default '{}'::jsonb;
