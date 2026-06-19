-- is_admin is derived from user_type by a trigger; set the source column.
UPDATE public.users SET user_type = 'super_admin'
  WHERE id IN ('d0a89d01-5240-4fb8-8e0c-ae598b732f4b',   -- admin@sportime.app
               '61da0a31-875b-4383-b951-c429c5f9def0');  -- saadjennane@gmail.com
