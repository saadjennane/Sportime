-- Migration: Sync Odds from Staging to Production
-- Description: Create automatic synchronization from fb_odds (staging) to odds (production)
-- Author: Claude
-- Date: 2025-11-24

-- ============================================
-- 0. CRÉER LA TABLE ODDS SI ELLE N'EXISTE PAS
-- ============================================

-- S'assurer que la table odds existe
CREATE TABLE IF NOT EXISTS public.odds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  fixture_id UUID NOT NULL REFERENCES public.fixtures(id) ON DELETE CASCADE,
  bookmaker_name TEXT NOT NULL,
  home_win REAL,
  draw REAL,
  away_win REAL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Ajouter la contrainte unique si elle n'existe pas
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'unique_fixture_bookmaker'
  ) THEN
    ALTER TABLE public.odds
    ADD CONSTRAINT unique_fixture_bookmaker UNIQUE (fixture_id, bookmaker_name);
  END IF;
END $$;

-- Activer RLS si pas déjà fait
ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;

-- Politique de lecture publique
DROP POLICY IF EXISTS "Allow public read access for odds" ON public.odds;
CREATE POLICY "Allow public read access for odds"
  ON public.odds FOR SELECT
  USING (true);

-- Permissions
GRANT SELECT ON public.odds TO authenticated, anon;
GRANT ALL ON public.odds TO service_role;

COMMENT ON TABLE public.odds IS 'Table de production pour les cotes de paris';

-- ============================================
-- 1. FONCTION DE SYNCHRONISATION DES COTES
-- ============================================

CREATE OR REPLACE FUNCTION public.sync_fb_odds_to_odds()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_fixture_uuid UUID;
  v_existing_odds_id UUID;
BEGIN
  -- Trouver le UUID de la fixture correspondante via l'api_id
  SELECT f.id INTO v_fixture_uuid
  FROM public.fixtures f
  JOIN public.fb_fixtures ff ON ff.api_id = f.api_id
  WHERE ff.id = NEW.fixture_id;

  -- Si on ne trouve pas la fixture, skip (elle sera peut-être créée plus tard)
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

COMMENT ON FUNCTION public.sync_fb_odds_to_odds IS 'Synchronise automatiquement les odds de fb_odds vers odds lors des INSERT/UPDATE';

-- ============================================
-- 2. CRÉER LE TRIGGER
-- ============================================

DROP TRIGGER IF EXISTS trigger_sync_fb_odds_to_odds ON public.fb_odds;

CREATE TRIGGER trigger_sync_fb_odds_to_odds
  AFTER INSERT OR UPDATE ON public.fb_odds
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_fb_odds_to_odds();

COMMENT ON TRIGGER trigger_sync_fb_odds_to_odds ON public.fb_odds IS 'Trigger automatique pour synchroniser fb_odds → odds';

-- ============================================
-- 3. SYNCHRONISER LES DONNÉES EXISTANTES
-- ============================================

-- Insérer toutes les odds existantes de fb_odds dans odds
-- (en évitant les doublons)

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
WHERE NOT EXISTS (
  -- Éviter les doublons
  SELECT 1 FROM public.odds o
  WHERE o.fixture_id = f.id
    AND o.bookmaker_name = fbo.bookmaker_name
)
-- Filtrer les odds valides (non nulles)
AND fbo.home_win IS NOT NULL
AND fbo.draw IS NOT NULL
AND fbo.away_win IS NOT NULL;

-- Compter les odds synchronisées
DO $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO v_count FROM public.odds;
  RAISE NOTICE '============================================';
  RAISE NOTICE 'Odds synchronization completed!';
  RAISE NOTICE 'Total odds in production table: %', v_count;
  RAISE NOTICE '============================================';
END $$;

-- ============================================
-- 4. FONCTION HELPER POUR FORCER UNE RESYNC
-- ============================================

CREATE OR REPLACE FUNCTION public.force_resync_odds()
RETURNS TABLE(synced_count INTEGER)
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_synced INTEGER := 0;
BEGIN
  -- Supprimer toutes les odds existantes
  DELETE FROM public.odds;

  -- Réinsérer depuis fb_odds
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
  WHERE fbo.home_win IS NOT NULL
    AND fbo.draw IS NOT NULL
    AND fbo.away_win IS NOT NULL;

  GET DIAGNOSTICS v_synced = ROW_COUNT;

  RAISE NOTICE 'Force resync completed: % odds synced', v_synced;

  RETURN QUERY SELECT v_synced;
END;
$$;

COMMENT ON FUNCTION public.force_resync_odds IS 'Force une re-synchronisation complète de toutes les odds (ATTENTION: supprime et recrée)';

-- ============================================
-- 5. PERMISSIONS
-- ============================================

-- Permettre au service_role d'utiliser la fonction de resync
GRANT EXECUTE ON FUNCTION public.force_resync_odds() TO service_role;

-- Les triggers s'exécutent automatiquement avec les permissions de la fonction (SECURITY DEFINER)
