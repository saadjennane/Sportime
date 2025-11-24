-- Migration: Bookmaker Configuration
-- Description: Add configuration table for preferred bookmaker
-- Author: Claude
-- Date: 2025-11-24

-- ============================================
-- 0. S'ASSURER QUE LA CONTRAINTE UNIQUE EXISTE SUR ODDS
-- ============================================

-- Vérifier et créer la contrainte unique si elle n'existe pas
DO $$
BEGIN
  -- Vérifier si la contrainte existe
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_fixture_bookmaker'
      AND conrelid = 'public.odds'::regclass
  ) THEN
    -- Créer la contrainte si elle n'existe pas
    ALTER TABLE public.odds
    ADD CONSTRAINT unique_fixture_bookmaker UNIQUE (fixture_id, bookmaker_name);

    RAISE NOTICE 'Created unique constraint: unique_fixture_bookmaker';
  ELSE
    RAISE NOTICE 'Unique constraint already exists: unique_fixture_bookmaker';
  END IF;
END $$;

-- ============================================
-- 1. TABLE DE CONFIGURATION DES BOOKMAKERS
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key TEXT NOT NULL UNIQUE,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_by UUID REFERENCES auth.users(id)
);

-- Activer RLS
ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

-- Politique de lecture pour tous
DROP POLICY IF EXISTS "Allow public read access for app_config" ON public.app_config;
CREATE POLICY "Allow public read access for app_config"
  ON public.app_config FOR SELECT
  USING (true);

-- Politique d'écriture pour service_role seulement
DROP POLICY IF EXISTS "Allow service_role full access for app_config" ON public.app_config;
CREATE POLICY "Allow service_role full access for app_config"
  ON public.app_config FOR ALL
  USING (auth.role() = 'service_role');

-- Permissions
GRANT SELECT ON public.app_config TO authenticated, anon;
GRANT ALL ON public.app_config TO service_role;

COMMENT ON TABLE public.app_config IS 'Configuration globale de l''application';

-- ============================================
-- 2. INSÉRER LA CONFIGURATION PAR DÉFAUT
-- ============================================

INSERT INTO public.app_config (key, value, description)
VALUES
  ('preferred_bookmaker', '10Bet', 'Bookmaker préféré pour l''affichage des cotes')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- 3. FONCTION POUR OBTENIR LES BOOKMAKERS DISPONIBLES
-- ============================================

CREATE OR REPLACE FUNCTION public.get_available_bookmakers()
RETURNS TABLE(bookmaker_name TEXT, odds_count BIGINT, last_update TIMESTAMPTZ)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT
    fbo.bookmaker_name,
    COUNT(*)::BIGINT as odds_count,
    MAX(fbo.updated_at) as last_update
  FROM public.fb_odds fbo
  GROUP BY fbo.bookmaker_name
  ORDER BY odds_count DESC;
END;
$$;

COMMENT ON FUNCTION public.get_available_bookmakers IS 'Retourne la liste des bookmakers disponibles avec statistiques';

-- ============================================
-- 4. FONCTION POUR CHANGER LE BOOKMAKER PRÉFÉRÉ
-- ============================================

CREATE OR REPLACE FUNCTION public.set_preferred_bookmaker(
  p_bookmaker_name TEXT
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_bookmaker_exists BOOLEAN;
BEGIN
  -- Vérifier que ce bookmaker existe dans fb_odds
  SELECT EXISTS(
    SELECT 1 FROM public.fb_odds
    WHERE bookmaker_name = p_bookmaker_name
  ) INTO v_bookmaker_exists;

  IF NOT v_bookmaker_exists THEN
    RAISE EXCEPTION 'Bookmaker % not found in database', p_bookmaker_name;
  END IF;

  -- Mettre à jour la configuration
  UPDATE public.app_config
  SET value = p_bookmaker_name, updated_at = NOW()
  WHERE key = 'preferred_bookmaker';

  RAISE NOTICE 'Preferred bookmaker changed to: %', p_bookmaker_name;

  RETURN TRUE;
END;
$$;

COMMENT ON FUNCTION public.set_preferred_bookmaker IS 'Définit le bookmaker préféré dans la configuration';

-- ============================================
-- 5. FONCTION POUR SYNCHRONISER UNIQUEMENT LE BOOKMAKER PRÉFÉRÉ
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_preferred_bookmaker_odds()
RETURNS TABLE(synced_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_synced INTEGER := 0;
  v_preferred_bookmaker TEXT;
BEGIN
  -- Récupérer le bookmaker préféré
  SELECT value INTO v_preferred_bookmaker
  FROM public.app_config
  WHERE key = 'preferred_bookmaker';

  IF v_preferred_bookmaker IS NULL THEN
    RAISE EXCEPTION 'No preferred bookmaker configured';
  END IF;

  -- Supprimer les odds qui ne correspondent pas au bookmaker préféré
  DELETE FROM public.odds
  WHERE bookmaker_name != v_preferred_bookmaker;

  -- Synchroniser uniquement les odds du bookmaker préféré
  INSERT INTO public.odds (
    id,
    fixture_id,
    bookmaker_name,
    home_win,
    draw,
    away_win,
    updated_at
  )
  SELECT
    gen_random_uuid() as id,
    f.id as fixture_id,
    fbo.bookmaker_name,
    fbo.home_win::REAL,
    fbo.draw::REAL,
    fbo.away_win::REAL,
    fbo.updated_at
  FROM public.fb_odds fbo
  JOIN public.fb_fixtures ff ON fbo.fixture_id = ff.id
  JOIN public.fixtures f ON ff.api_id = f.api_id
  WHERE fbo.bookmaker_name = v_preferred_bookmaker
    AND fbo.home_win IS NOT NULL
    AND fbo.draw IS NOT NULL
    AND fbo.away_win IS NOT NULL
  ON CONFLICT (fixture_id, bookmaker_name)
  DO UPDATE SET
    home_win = EXCLUDED.home_win,
    draw = EXCLUDED.draw,
    away_win = EXCLUDED.away_win,
    updated_at = EXCLUDED.updated_at;

  GET DIAGNOSTICS v_synced = ROW_COUNT;

  RAISE NOTICE 'Synced % odds for bookmaker: %', v_synced, v_preferred_bookmaker;

  RETURN QUERY SELECT v_synced;
END;
$$;

COMMENT ON FUNCTION public.sync_preferred_bookmaker_odds IS 'Synchronise uniquement les odds du bookmaker préféré';

-- ============================================
-- 6. MODIFIER LE TRIGGER POUR UTILISER LE BOOKMAKER PRÉFÉRÉ
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_fb_odds_to_odds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixture_uuid UUID;
  v_existing_odds_id UUID;
  v_preferred_bookmaker TEXT;
BEGIN
  -- Récupérer le bookmaker préféré
  SELECT value INTO v_preferred_bookmaker
  FROM public.app_config
  WHERE key = 'preferred_bookmaker';

  -- Si ce n'est pas le bookmaker préféré, ne rien faire
  IF v_preferred_bookmaker IS NOT NULL AND NEW.bookmaker_name != v_preferred_bookmaker THEN
    RETURN NEW;
  END IF;

  -- Trouver le UUID de la fixture correspondante via l'api_id
  SELECT f.id INTO v_fixture_uuid
  FROM public.fixtures f
  JOIN public.fb_fixtures ff ON ff.api_id = f.api_id
  WHERE ff.id = NEW.fixture_id;

  -- Si on ne trouve pas la fixture, skip
  IF v_fixture_uuid IS NULL THEN
    RAISE NOTICE 'sync_fb_odds_to_odds: No matching fixture found for fb_fixture_id %', NEW.fixture_id;
    RETURN NEW;
  END IF;

  -- Vérifier si des odds existent déjà pour cette fixture et ce bookmaker
  SELECT id INTO v_existing_odds_id
  FROM public.odds
  WHERE fixture_id = v_fixture_uuid
    AND bookmaker_name = NEW.bookmaker_name;

  IF v_existing_odds_id IS NOT NULL THEN
    -- Mettre à jour les odds existantes
    UPDATE public.odds
    SET
      home_win = NEW.home_win::REAL,
      draw = NEW.draw::REAL,
      away_win = NEW.away_win::REAL,
      updated_at = NEW.updated_at
    WHERE id = v_existing_odds_id;

    RAISE NOTICE 'sync_fb_odds_to_odds: Updated odds for fixture % bookmaker %', v_fixture_uuid, NEW.bookmaker_name;
  ELSE
    -- Insérer de nouvelles odds
    INSERT INTO public.odds (
      id,
      fixture_id,
      bookmaker_name,
      home_win,
      draw,
      away_win,
      updated_at
    ) VALUES (
      gen_random_uuid(),
      v_fixture_uuid,
      NEW.bookmaker_name,
      NEW.home_win::REAL,
      NEW.draw::REAL,
      NEW.away_win::REAL,
      NEW.updated_at
    );

    RAISE NOTICE 'sync_fb_odds_to_odds: Inserted odds for fixture % bookmaker %', v_fixture_uuid, NEW.bookmaker_name;
  END IF;

  RETURN NEW;
END;
$$;

-- ============================================
-- 7. PERMISSIONS
-- ============================================

GRANT EXECUTE ON FUNCTION public.get_available_bookmakers() TO authenticated, anon;
GRANT EXECUTE ON FUNCTION public.set_preferred_bookmaker(TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.sync_preferred_bookmaker_odds() TO service_role;

-- ============================================
-- 8. SYNCHRONISER AVEC LE BOOKMAKER ACTUEL
-- ============================================

-- Nettoyer et synchroniser uniquement le bookmaker préféré
SELECT * FROM public.sync_preferred_bookmaker_odds();
