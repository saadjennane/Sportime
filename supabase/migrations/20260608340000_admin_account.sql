-- Dedicated admin login (email confirmed + is_admin) for the back-office.
UPDATE auth.users SET email_confirmed_at = now()
  WHERE email = 'admin@sportime.app' AND email_confirmed_at IS NULL;
UPDATE public.users SET is_admin = true WHERE id = 'd0a89d01-5240-4fb8-8e0c-ae598b732f4b';
