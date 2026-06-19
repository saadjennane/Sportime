-- ============================================================================
-- Fix PGS Calculation - Option C: Formule Mixte Équilibrée
-- Corrige le calcul du PGS pour être équitable entre toutes les positions
-- Multiplicateurs: ATT ×1.0, MID ×1.5, DM ×2.0, DEF ×2.5, GK ×3.0
-- ============================================================================

-- =============================================================================
-- FUNCTION: Calculate Impact Score (REMPLACE L'ANCIENNE)
-- Adapté par position avec multiplicateurs
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_impact_score(
  p_goals INTEGER,
  p_assists INTEGER,
  p_passes_key INTEGER,
  p_dribbles_success INTEGER,
  p_tackles_total INTEGER,
  p_tackles_interceptions INTEGER,
  p_shots_on_target INTEGER,
  p_duels_won INTEGER,
  p_clean_sheets INTEGER,
  p_saves INTEGER,
  p_penalties_saved INTEGER,
  p_appearances INTEGER,
  p_position TEXT  -- Nouveau paramètre
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_position_type TEXT;
  v_raw_impact DECIMAL(10,2);
  v_impact DECIMAL(5,2);
  v_def_mult DECIMAL(3,1);
  v_cs_mult DECIMAL(3,1);
  v_saves_mult DECIMAL(3,1);
BEGIN
  -- Éviter division par zéro
  IF p_appearances = 0 THEN
    RETURN 0;
  END IF;

  -- Déterminer le type de position
  v_position_type := CASE
    WHEN p_position ILIKE '%goalkeeper%' OR p_position ILIKE '%keeper%' OR p_position = 'G' THEN 'GK'
    WHEN p_position ILIKE '%defender%' OR p_position ILIKE '%back%' OR p_position = 'D' THEN 'DEF'
    -- Milieu défensif: plus de tackles que de key passes
    WHEN (p_tackles_total + p_tackles_interceptions) > (p_passes_key * 2) THEN 'DM'
    WHEN p_position ILIKE '%midfielder%' OR p_position ILIKE '%midfield%' OR p_position = 'M' THEN 'MID'
    ELSE 'ATT'  -- Attacker/Forward/Winger (includes 'F' and 'A')
  END;

  -- Définir les multiplicateurs selon la position
  v_def_mult := CASE v_position_type
    WHEN 'GK' THEN 1.0    -- Gardiens ne font pas de tackles typiquement
    WHEN 'DEF' THEN 2.5   -- Défenseurs: bonus fort
    WHEN 'DM' THEN 2.0    -- Milieux défensifs: bonus fort
    WHEN 'MID' THEN 1.5   -- Milieux: bonus modéré
    ELSE 1.0              -- Attaquants: référence
  END;

  v_cs_mult := CASE v_position_type
    WHEN 'GK' THEN 3.0    -- Gardiens: bonus maximal
    WHEN 'DEF' THEN 2.5   -- Défenseurs: bonus très fort
    ELSE 0                -- Autres: pas de bonus clean sheet
  END;

  v_saves_mult := CASE v_position_type
    WHEN 'GK' THEN 3.0    -- Gardiens uniquement
    ELSE 0
  END;

  -- Calculer l'impact brut avec bonus position
  v_raw_impact :=
    -- Stats offensives (tous les joueurs)
    (p_goals * 3.0) +
    (p_assists * 2.0) +
    (p_passes_key * 0.15) +
    (p_shots_on_target * 0.06) +
    (p_dribbles_success * 0.05) +

    -- Stats défensives (avec multiplicateur position)
    (p_tackles_total * 0.04 * v_def_mult) +
    (p_tackles_interceptions * 0.04 * v_def_mult) +
    (p_duels_won * 0.03 * v_def_mult) +

    -- Clean sheets (défenseurs et gardiens uniquement)
    (p_clean_sheets * 0.8 * v_cs_mult) +

    -- Saves (gardiens uniquement)
    (p_saves * 0.1 * v_saves_mult) +
    (COALESCE(p_penalties_saved, 0) * 2.0 * v_saves_mult);

  -- Normaliser sur échelle 0-10 avec facteur appearances
  v_impact := LEAST(10, v_raw_impact / (p_appearances * 0.5));

  RETURN ROUND(v_impact, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Calculate PGS (REMPLACE L'ANCIENNE)
-- Formule: (rating×0.35) + (impact×0.45) + (consistency×0.20) + bonus
-- =============================================================================
CREATE OR REPLACE FUNCTION public.calculate_pgs(
  p_rating DECIMAL(3,2),
  p_impact DECIMAL(5,2),
  p_consistency DECIMAL(5,2),
  p_minutes_played INTEGER,
  p_appearances INTEGER
) RETURNS DECIMAL(5,2) AS $$
DECLARE
  v_base_pgs DECIMAL(5,2);
  v_playtime_ratio DECIMAL(5,4);
  v_playtime_bonus DECIMAL(3,2);
  v_elite_consistency_bonus DECIMAL(3,2);
  v_final_pgs DECIMAL(5,2);
BEGIN
  -- Calculer le PGS de base
  IF p_rating IS NOT NULL THEN
    -- Formule normale avec rating
    v_base_pgs := (p_rating * 0.35) + (p_impact * 0.45) + (p_consistency * 0.20);
  ELSE
    -- Si pas de rating, utiliser impact + consistency
    v_base_pgs := (p_impact * 0.65) + (p_consistency * 0.35);
  END IF;

  -- Calculer le ratio de temps de jeu (supposant 90 min par match)
  IF p_appearances = 0 THEN
    v_playtime_ratio := 0;
  ELSE
    v_playtime_ratio := p_minutes_played::DECIMAL / (p_appearances * 90.0);
  END IF;

  -- Bonus selon le temps de jeu
  IF v_playtime_ratio >= 0.90 THEN
    v_playtime_bonus := 0.8;
  ELSIF v_playtime_ratio >= 0.50 THEN
    v_playtime_bonus := 0.4;
  ELSE
    v_playtime_bonus := 0.1;
  END IF;

  -- Bonus pour consistency d'élite (≥9.0)
  IF p_consistency >= 9.0 THEN
    v_elite_consistency_bonus := 0.5;
  ELSE
    v_elite_consistency_bonus := 0;
  END IF;

  -- PGS final
  v_final_pgs := v_base_pgs + v_playtime_bonus + v_elite_consistency_bonus;

  RETURN ROUND(v_final_pgs, 2);
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Get PGS Category (REMPLACE L'ANCIENNE)
-- Catégories ajustées: Star ≥6.0, Key ≥4.5, Wild <4.5
-- =============================================================================
CREATE OR REPLACE FUNCTION public.get_pgs_category(p_pgs DECIMAL(5,2))
RETURNS TEXT AS $$
BEGIN
  IF p_pgs >= 6.0 THEN
    RETURN 'star';
  ELSIF p_pgs >= 4.5 THEN
    RETURN 'key';
  ELSE
    RETURN 'wild';
  END IF;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- =============================================================================
-- FUNCTION: Update Player Season Stats (REMPLACE L'ANCIENNE)
-- Trigger qui recalcule automatiquement impact, consistency, PGS
-- =============================================================================
CREATE OR REPLACE FUNCTION public.update_player_season_stats()
RETURNS TRIGGER AS $$
BEGIN
  -- Calculer l'impact score avec position
  NEW.impact_score := public.calculate_impact_score(
    NEW.goals,
    NEW.assists,
    NEW.passes_key,
    NEW.dribbles_success,
    NEW.tackles_total,
    NEW.tackles_interceptions,
    NEW.shots_on_target,
    NEW.duels_won,
    NEW.clean_sheets,
    NEW.saves,
    NEW.penalties_saved,
    NEW.appearances,
    COALESCE(
      (SELECT position FROM player_match_stats WHERE player_id = NEW.player_id LIMIT 1),
      'Unknown'
    )
  );

  -- Calculer le consistency score
  NEW.consistency_score := public.calculate_consistency_score(
    NEW.player_id,
    NEW.season
  );

  -- Calculer le PGS (même si rating IS NULL)
  NEW.pgs := public.calculate_pgs(
    NEW.rating,
    NEW.impact_score,
    NEW.consistency_score,
    NEW.minutes_played,
    NEW.appearances
  );

  -- Définir la catégorie
  NEW.pgs_category := public.get_pgs_category(NEW.pgs);

  -- Mettre à jour le timestamp
  NEW.updated_at := NOW();

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recréer le trigger
DROP TRIGGER IF EXISTS trigger_update_player_season_stats ON public.player_season_stats;
CREATE TRIGGER trigger_update_player_season_stats
  BEFORE INSERT OR UPDATE ON public.player_season_stats
  FOR EACH ROW
  EXECUTE FUNCTION public.update_player_season_stats();

-- =============================================================================
-- RECALCUL DE TOUS LES PGS EXISTANTS
-- Force le trigger à recalculer pour les 590 joueurs
-- =============================================================================
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  -- Mettre à jour tous les player_season_stats
  -- Le trigger recalculera automatiquement impact_score, consistency_score, pgs
  UPDATE player_season_stats SET updated_at = NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RAISE NOTICE 'PGS recalculé pour % joueurs', v_count;
END $$;

-- =============================================================================
-- VÉRIFICATION
-- =============================================================================
-- Compter les joueurs par catégorie après recalcul
SELECT
  pgs_category,
  COUNT(*) as total_players,
  ROUND(AVG(pgs), 2) as avg_pgs,
  ROUND(AVG(goals), 2) as avg_goals,
  ROUND(AVG(assists), 2) as avg_assists
FROM player_season_stats
WHERE season = 2025
GROUP BY pgs_category
ORDER BY avg_pgs DESC;

-- Top 10 joueurs par PGS
SELECT
  p.first_name || ' ' || p.last_name as player_name,
  t.name as team,
  pss.pgs,
  pss.pgs_category,
  pss.goals,
  pss.assists,
  pss.rating,
  pss.impact_score,
  pss.consistency_score
FROM player_season_stats pss
JOIN players p ON p.id = pss.player_id
JOIN teams t ON t.id = pss.team_id
WHERE pss.season = 2025
ORDER BY pss.pgs DESC NULLS LAST
LIMIT 10;

-- Vérifier les joueurs avec PGS NULL (devrait être 0 maintenant)
SELECT COUNT(*) as players_with_null_pgs
FROM player_season_stats
WHERE season = 2025 AND pgs IS NULL;

-- Message de confirmation
SELECT 'PGS calculation fixed successfully! Option C (Mixed Formula) applied.' as status;
