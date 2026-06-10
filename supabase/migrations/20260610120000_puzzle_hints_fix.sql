-- Fix array append (|| with scalar was parsed as array literal).
CREATE OR REPLACE FUNCTION public.puzzle_hints(h INTEGER, a INTEGER)
RETURNS JSONB LANGUAGE plpgsql IMMUTABLE AS $$
DECLARE arr TEXT[] := '{}';
BEGIN
  IF h + a = 0 THEN arr := array_append(arr, 'Goalless draw'); END IF;
  IF (h > 0 AND a = 0) OR (h = 0 AND a > 0) THEN arr := array_append(arr, 'Only one team scored'); END IF;
  IF h > 0 AND a > 0 THEN arr := array_append(arr, 'Both teams scored'); END IF;
  IF h = a AND h > 0 THEN arr := array_append(arr, 'A draw, but not goalless'); END IF;
  IF h + a = 1 THEN arr := array_append(arr, 'Only one goal in the whole match'); END IF;
  IF h + a >= 4 THEN arr := array_append(arr, 'Goal fest (4+ goals)'); END IF;
  IF abs(h - a) >= 3 THEN arr := array_append(arr, 'A heavy win'); END IF;
  RETURN to_jsonb(arr);
END $$;
