-- Vérifier si la contrainte unique existe
SELECT
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as definition
FROM pg_constraint
WHERE conrelid = 'public.odds'::regclass;

-- Vérifier la structure de la table odds
\d public.odds
