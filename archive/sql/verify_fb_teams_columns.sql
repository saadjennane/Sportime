-- Vérifier exactement quelles colonnes existent dans fb_teams
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_schema = 'public'
  AND table_name = 'fb_teams'
ORDER BY ordinal_position;

-- Vérifier un échantillon de données avec TOUTES les colonnes
SELECT * FROM fb_teams LIMIT 3;
