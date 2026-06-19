-- is_admin() reads users.role; the dedicated admin account only had user_type set.
UPDATE public.users SET role = 'super_admin' WHERE id = 'd0a89d01-5240-4fb8-8e0c-ae598b732f4b';
