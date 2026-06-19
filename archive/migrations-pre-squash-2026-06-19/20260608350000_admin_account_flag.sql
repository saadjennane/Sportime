-- The profile row is created on first sign-in; set is_admin now that it exists.
UPDATE public.users SET is_admin = true WHERE id = 'd0a89d01-5240-4fb8-8e0c-ae598b732f4b';
