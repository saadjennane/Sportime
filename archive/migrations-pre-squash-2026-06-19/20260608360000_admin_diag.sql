DO $$
DECLARE v boolean; cnt int;
BEGIN
  UPDATE public.users SET is_admin = true WHERE id = 'd0a89d01-5240-4fb8-8e0c-ae598b732f4b';
  GET DIAGNOSTICS cnt = ROW_COUNT;
  SELECT is_admin INTO v FROM public.users WHERE id = 'd0a89d01-5240-4fb8-8e0c-ae598b732f4b';
  RAISE NOTICE 'UPDATE rows=%, is_admin in-tx=%', cnt, v;
END $$;
