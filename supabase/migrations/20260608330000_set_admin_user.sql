-- Grant admin to the owner account for the back-office (is_admin() reads users.is_admin).
UPDATE public.users SET is_admin = true WHERE id = '61da0a31-875b-4383-b951-c429c5f9def0';
DO $$ BEGIN
  BEGIN UPDATE public.users SET role = 'super_admin' WHERE id = '61da0a31-875b-4383-b951-c429c5f9def0';
  EXCEPTION WHEN undefined_column THEN NULL; END;
END $$;
