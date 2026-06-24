-- Enable RLS on server-only tables (no client access; service_role bypasses RLS so
-- edge functions/crons keep working). Fixes linter 0013_rls_disabled_in_public.
alter table public.notification_log enable row level security;
alter table public.fb_squad_sync   enable row level security;
