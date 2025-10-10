<![CDATA[
/*
          # [Function] public.generate_random_string
          Creates a helper function to generate a random string of a given length, used for creating unique invite codes.

          ## Query Description: This operation creates a new helper function in the public schema. It is a safe, self-contained operation with no impact on existing data. It is required for the league creation functionality to work correctly.
          
          ## Metadata:
          - Schema-Category: ["Structural"]
          - Impact-Level: ["Low"]
          - Requires-Backup: [false]
          - Reversible: [true]
          
          ## Structure Details:
          - Function: public.generate_random_string(integer)
          
          ## Security Implications:
          - RLS Status: [N/A]
          - Policy Changes: [No]
          - Auth Requirements: [None]
          
          ## Performance Impact:
          - Indexes: [N/A]
          - Triggers: [N/A]
          - Estimated Impact: [None]
          */
CREATE OR REPLACE FUNCTION public.generate_random_string(length integer)
RETURNS text
LANGUAGE plpgsql
AS $$
DECLARE
  chars text[] := '{0,1,2,3,4,5,6,7,8,9,a,b,c,d,e,f,g,h,i,j,k,l,m,n,o,p,q,r,s,t,u,v,w,x,y,z,A,B,C,D,E,F,G,H,I,J,K,L,M,N,O,P,Q,R,S,T,U,V,W,X,Y,Z}';
  result text := '';
  i integer := 0;
BEGIN
  IF length < 0 THEN
    RAISE EXCEPTION 'Given length cannot be less than 0';
  END IF;
  FOR i IN 1..length LOOP
    result := result || chars[1+floor(random()*(array_length(chars, 1)-1))];
  END LOOP;
  RETURN result;
END;
$$;
]]>
