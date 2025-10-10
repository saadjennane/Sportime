/*
# [Function] Create `generate_random_string` helper function
This function generates a random alphanumeric string of a specified length. It is used to create unique invite codes for leagues.

## Query Description:
This operation adds a new helper function to the `public` schema. It is a safe, non-destructive operation that does not affect any existing data. It is required for the `create_league` function to work correctly.

## Metadata:
- Schema-Category: ["Structural"]
- Impact-Level: ["Low"]
- Requires-Backup: false
- Reversible: true (The function can be dropped)

## Structure Details:
- Function: `public.generate_random_string(integer)`

## Security Implications:
- RLS Status: Not applicable
- Policy Changes: No
- Auth Requirements: None

## Performance Impact:
- Indexes: None
- Triggers: None
- Estimated Impact: Negligible. The function is only called during league creation or invite code reset.
*/
CREATE OR REPLACE FUNCTION public.generate_random_string(length integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z}';
  result text := '';
  i integer := 0;
BEGIN
  IF length &lt; 0 THEN
    RAISE EXCEPTION 'Given length cannot be less than 0';
  END IF;
  FOR i IN 1..length LOOP
    result := result || chars[1+floor(random()*(array_length(chars, 1)-1))];
  END LOOP;
  RETURN result;
END;
$$;
