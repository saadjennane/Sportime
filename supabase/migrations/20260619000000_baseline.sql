-- =====================================================
-- BASELINE — full public schema as of 2026-06-19 (squash of 250 prior migrations).
-- Generated via pg_dump --schema-only. Source migrations archived under
-- archive/migrations-pre-squash-2026-06-19/. Recorded as already-applied in
-- schema_migrations; only executes on a fresh database.
-- =====================================================

--
-- PostgreSQL database dump
--

\restrict nDQcRFHtTZIawaKFFqGfpz1BLUctfOwODBaMd1Cw8T30EbaMIwPaDmfYHu3WRup

-- Dumped from database version 17.6
-- Dumped by pg_dump version 18.4

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- Name: challenge_format_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.challenge_format_enum AS ENUM (
    'leaderboard',
    'championship',
    'elimination'
);


--
-- Name: challenge_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.challenge_status_enum AS ENUM (
    'upcoming',
    'active',
    'finished',
    'draft'
);


--
-- Name: game_type_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.game_type_enum AS ENUM (
    'betting',
    'prediction',
    'fantasy',
    'quiz'
);


--
-- Name: league_role; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.league_role AS ENUM (
    'admin',
    'member'
);


--
-- Name: match_status_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.match_status_enum AS ENUM (
    'upcoming',
    'live',
    'finished',
    'postponed',
    'cancelled'
);


--
-- Name: player_category; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.player_category AS ENUM (
    'Star',
    'Key',
    'Wild'
);


--
-- Name: spin_tier; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.spin_tier AS ENUM (
    'free',
    'amateur',
    'master',
    'apex',
    'premium'
);


--
-- Name: sport_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.sport_enum AS ENUM (
    'football',
    'basketball',
    'tennis',
    'f1',
    'nba'
);


--
-- Name: ticket_type; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.ticket_type AS ENUM (
    'amateur',
    'master',
    'apex',
    'premium'
);


--
-- Name: user_role_enum; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE public.user_role_enum AS ENUM (
    'guest',
    'user',
    'admin',
    'super_admin'
);


--
-- Name: _mp_create_entry(text, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._mp_create_entry(p_game_type text, p_game_id uuid, p_user uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_game_type = 'tournament' THEN
    INSERT INTO public.tq_entries(user_id, competition_id) VALUES(p_user, p_game_id) ON CONFLICT (user_id, competition_id) DO NOTHING;
  ELSE
    INSERT INTO public.challenge_participants(challenge_id, user_id) VALUES(p_game_id, p_user) ON CONFLICT DO NOTHING;
  END IF;
END; $$;


--
-- Name: _mp_game_tier(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._mp_game_tier(p_game_type text, p_game_id uuid) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v TEXT;
BEGIN
  IF p_game_type = 'tournament' THEN SELECT tier INTO v FROM public.tq_competitions WHERE id = p_game_id;
  ELSIF p_game_type = 'fantasy' THEN SELECT tier INTO v FROM public.fantasy_games WHERE id = p_game_id;
  ELSE SELECT rules->>'tier' INTO v FROM public.challenges WHERE id = p_game_id;
  END IF;
  RETURN v;
END; $$;


--
-- Name: _squad_admin_guard(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public._squad_admin_guard(p_actor uuid, p_squad_id uuid, p_target uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_creator UUID;
BEGIN
  IF p_actor IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_actor AND role = 'admin') THEN
    RAISE EXCEPTION 'not_admin';
  END IF;
  SELECT created_by INTO v_creator FROM public.squads WHERE id = p_squad_id;
  IF p_target = v_creator THEN RAISE EXCEPTION 'cannot_target_creator'; END IF;
END;
$$;


--
-- Name: add_coins(uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(success boolean, new_balance integer, transaction_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Validate user (must be self or admin)
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Add coins and get new balance
  UPDATE public.users
  SET coins_balance = coins_balance + p_amount
  WHERE id = p_user_id
  RETURNING coins_balance INTO v_new_balance;

  -- Log transaction
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, metadata)
  VALUES (p_user_id, p_amount, v_new_balance, p_transaction_type, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;


--
-- Name: add_xp_to_user(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.add_xp_to_user(p_user_id uuid, p_xp_amount integer) RETURNS TABLE(new_xp_total integer, new_level integer, new_level_name text, leveled_up boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_old_level INT;
  v_new_total INT;
  v_new_level INT;
  v_new_level_name TEXT;
  v_leveled_up BOOLEAN := false;
BEGIN
  -- Get current level
  SELECT current_level INTO v_old_level
  FROM public.users
  WHERE id = p_user_id;

  -- Add XP
  UPDATE public.users
  SET xp_total = xp_total + p_xp_amount
  WHERE id = p_user_id
  RETURNING xp_total INTO v_new_total;

  -- Calculate new level
  SELECT level, name INTO v_new_level, v_new_level_name
  FROM public.get_level_by_xp(v_new_total);

  -- Update level if changed
  IF v_new_level > v_old_level THEN
    v_leveled_up := true;
    UPDATE public.users
    SET current_level = v_new_level,
        level_name = v_new_level_name
    WHERE id = p_user_id;
  END IF;

  RETURN QUERY SELECT v_new_total, v_new_level, v_new_level_name, v_leveled_up;
END;
$$;


--
-- Name: FUNCTION add_xp_to_user(p_user_id uuid, p_xp_amount integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.add_xp_to_user(p_user_id uuid, p_xp_amount integer) IS 'Helper function to add XP and automatically update user level';


--
-- Name: aggregate_player_season_stats(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.aggregate_player_season_stats(p_league_id uuid, p_season integer DEFAULT (EXTRACT(year FROM CURRENT_DATE))::integer) RETURNS TABLE(players_processed integer, message text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_players_processed INTEGER := 0;
BEGIN
  -- Aggregate player_match_stats into player_season_stats
  -- Group by player, season, team, league
  INSERT INTO player_season_stats (
    player_id,
    season,
    team_id,
    league_id,
    -- Appearance Stats
    appearances,
    minutes_played,
    starting_xi,
    substitute_in,
    substitute_out,
    -- Performance Stats (rating is averaged, others are summed)
    rating,
    goals,
    assists,
    -- Detailed Stats
    shots_total,
    shots_on_target,
    passes_total,
    passes_key,
    passes_accuracy,
    tackles_total,
    tackles_interceptions,
    duels_total,
    duels_won,
    dribbles_attempts,
    dribbles_success,
    fouls_drawn,
    fouls_committed,
    -- Discipline
    yellow_cards,
    red_cards,
    -- Goalkeeper Stats
    saves,
    goals_conceded,
    clean_sheets,
    penalties_saved,
    penalties_missed
  )
  SELECT
    pms.player_id,
    p_season,
    pms.team_id,
    f.league_id,
    -- Appearance Stats
    COUNT(*) AS appearances,
    SUM(pms.minutes_played),
    COUNT(*) FILTER (WHERE pms.started = true),
    COUNT(*) FILTER (WHERE pms.substitute_in = true),
    COUNT(*) FILTER (WHERE pms.substitute_out = true),
    -- Performance Stats
    AVG(pms.rating) FILTER (WHERE pms.rating IS NOT NULL),
    SUM(pms.goals),
    SUM(pms.assists),
    -- Detailed Stats
    SUM(pms.shots_total),
    SUM(pms.shots_on_target),
    SUM(pms.passes_total),
    SUM(pms.passes_key),
    AVG(pms.passes_accuracy) FILTER (WHERE pms.passes_accuracy IS NOT NULL),
    SUM(pms.tackles_total),
    SUM(pms.tackles_interceptions),
    SUM(pms.duels_total),
    SUM(pms.duels_won),
    SUM(pms.dribbles_attempts),
    SUM(pms.dribbles_success),
    SUM(pms.fouls_drawn),
    SUM(pms.fouls_committed),
    -- Discipline
    COUNT(*) FILTER (WHERE pms.yellow_card = true),
    COUNT(*) FILTER (WHERE pms.red_card = true),
    -- Goalkeeper Stats
    SUM(pms.saves),
    SUM(pms.goals_conceded),
    COUNT(*) FILTER (WHERE pms.clean_sheet = true),
    SUM(COALESCE(pms.penalties_saved, 0)),
    SUM(COALESCE(pms.penalties_missed, 0))
  FROM player_match_stats pms
  JOIN fixtures f ON f.id = pms.fixture_id
  WHERE f.league_id = p_league_id
    AND EXTRACT(YEAR FROM f.date)::INTEGER = p_season
  GROUP BY pms.player_id, pms.team_id, f.league_id
  ON CONFLICT (player_id, season, team_id) DO UPDATE SET
    -- Update all aggregated fields
    appearances = EXCLUDED.appearances,
    minutes_played = EXCLUDED.minutes_played,
    starting_xi = EXCLUDED.starting_xi,
    substitute_in = EXCLUDED.substitute_in,
    substitute_out = EXCLUDED.substitute_out,
    rating = EXCLUDED.rating,
    goals = EXCLUDED.goals,
    assists = EXCLUDED.assists,
    shots_total = EXCLUDED.shots_total,
    shots_on_target = EXCLUDED.shots_on_target,
    passes_total = EXCLUDED.passes_total,
    passes_key = EXCLUDED.passes_key,
    passes_accuracy = EXCLUDED.passes_accuracy,
    tackles_total = EXCLUDED.tackles_total,
    tackles_interceptions = EXCLUDED.tackles_interceptions,
    duels_total = EXCLUDED.duels_total,
    duels_won = EXCLUDED.duels_won,
    dribbles_attempts = EXCLUDED.dribbles_attempts,
    dribbles_success = EXCLUDED.dribbles_success,
    fouls_drawn = EXCLUDED.fouls_drawn,
    fouls_committed = EXCLUDED.fouls_committed,
    yellow_cards = EXCLUDED.yellow_cards,
    red_cards = EXCLUDED.red_cards,
    saves = EXCLUDED.saves,
    goals_conceded = EXCLUDED.goals_conceded,
    clean_sheets = EXCLUDED.clean_sheets,
    penalties_saved = EXCLUDED.penalties_saved,
    penalties_missed = EXCLUDED.penalties_missed,
    updated_at = NOW();
  -- Note: The trigger update_player_season_stats() will automatically calculate:
  -- - impact_score
  -- - consistency_score
  -- - pgs
  -- - pgs_category

  GET DIAGNOSTICS v_players_processed = ROW_COUNT;

  RETURN QUERY SELECT
    v_players_processed,
    'Successfully aggregated stats for ' || v_players_processed || ' players in season ' || p_season;
END;
$$;


--
-- Name: FUNCTION aggregate_player_season_stats(p_league_id uuid, p_season integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.aggregate_player_season_stats(p_league_id uuid, p_season integer) IS 'Aggregates player_match_stats into player_season_stats for a given league and season.
The trigger update_player_season_stats() automatically calculates impact_score, consistency_score, pgs, and pgs_category.';


--
-- Name: auto_add_squad_creator_as_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_add_squad_creator_as_admin() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (NEW.id, NEW.created_by, 'admin');
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION auto_add_squad_creator_as_admin(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.auto_add_squad_creator_as_admin() IS 'Automatically adds the squad creator as an admin member when a squad is created.';


--
-- Name: auto_link_fixture_to_matchdays(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_link_fixture_to_matchdays() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Find challenge_matchdays that:
  -- 1. Have the same date as the fixture
  -- 2. Belong to a challenge that uses this fixture's league
  INSERT INTO matchday_fixtures (matchday_id, fixture_id)
  SELECT DISTINCT
    cm.id,
    NEW.id
  FROM challenge_matchdays cm
  JOIN challenges c ON c.id = cm.challenge_id
  JOIN challenge_leagues cl ON cl.challenge_id = c.id
  WHERE
    -- Match date (fixture date to matchday date)
    cm.date = DATE(NEW.date AT TIME ZONE 'UTC')
    -- Match league
    AND cl.league_id = NEW.league_id
    -- Challenge is active (not finished)
    AND c.status IN ('upcoming', 'active')
    -- Avoid duplicates
    AND NOT EXISTS (
      SELECT 1 FROM matchday_fixtures mf
      WHERE mf.matchday_id = cm.id AND mf.fixture_id = NEW.id
    );

  RETURN NEW;
END;
$$;


--
-- Name: auto_publish_scheduled_games(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.auto_publish_scheduled_games() RETURNS TABLE(published_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_count INTEGER := 0;
BEGIN
  -- Update all draft games where publish_date has been reached
  UPDATE public.challenges
  SET status = 'upcoming'
  WHERE status = 'draft'
    AND publish_date IS NOT NULL
    AND publish_date <= NOW();

  GET DIAGNOSTICS v_count = ROW_COUNT;

  RETURN QUERY SELECT v_count;
END;
$$;


--
-- Name: award_xp(uuid, integer, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_source_type text, p_source_id text, p_reason text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_rows INT;
BEGIN
  IF p_user_id IS NULL OR p_amount IS NULL OR p_amount <= 0 THEN RETURN; END IF;
  INSERT INTO public.xp_events (user_id, amount, source_type, source_id, reason)
  VALUES (p_user_id, p_amount, p_source_type, p_source_id, p_reason)
  ON CONFLICT (user_id, source_type, source_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  IF v_rows = 0 THEN RETURN; END IF;          -- already awarded for this action
  PERFORM public.add_xp_to_user(p_user_id, p_amount);
END;
$$;


--
-- Name: bump_content_version(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.bump_content_version() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
BEGIN
  INSERT INTO public.content_versions (key, version, updated_at)
  VALUES (TG_ARGV[0], 1, now())
  ON CONFLICT (key) DO UPDATE SET version = public.content_versions.version + 1, updated_at = now();
  RETURN NULL;
END;
$$;


--
-- Name: calculate_bet_points(text, text, jsonb, integer, boolean, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean DEFAULT false, p_booster_type text DEFAULT NULL::text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_correct BOOLEAN;
  v_odds_value NUMERIC;
  v_points INTEGER;
  v_multiplier NUMERIC;
BEGIN
  -- Check if prediction matches result
  v_correct := (p_prediction = p_result);

  -- Handle x3 booster penalty on loss
  IF NOT v_correct AND p_has_booster AND p_booster_type = 'x3' THEN
    RETURN -200;  -- x3 penalty
  END IF;

  -- Return 0 for any other incorrect prediction
  IF NOT v_correct THEN
    RETURN 0;
  END IF;

  -- Get odds value for the prediction
  v_odds_value := CASE p_prediction
    WHEN 'teamA' THEN (p_odds->>'teamA')::NUMERIC
    WHEN 'draw' THEN (p_odds->>'draw')::NUMERIC
    WHEN 'teamB' THEN (p_odds->>'teamB')::NUMERIC
    ELSE 1.0
  END;

  -- Calculate base points (gross gain: odds * amount)
  v_points := FLOOR(v_odds_value * p_amount);

  -- Apply booster multiplier if applicable
  IF p_has_booster THEN
    v_multiplier := CASE p_booster_type
      WHEN 'x2' THEN 2.0
      WHEN 'x3' THEN 3.0
      ELSE 1.0
    END;
    v_points := FLOOR(v_points * v_multiplier);
  END IF;

  RETURN v_points;
END;
$$;


--
-- Name: FUNCTION calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text) IS 'Calculates points for a challenge bet using gross gain model. Returns -200 penalty for losing x3 boosted bets, 0 for other losses, and gross gain (odds * amount * booster) for wins.';


--
-- Name: calculate_consistency_score(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_consistency_score(p_player_id uuid, p_season integer) RETURNS numeric
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_avg_rating DECIMAL(5,2);
  v_stddev DECIMAL(5,2);
  v_consistency DECIMAL(5,2);
BEGIN
  -- Get average rating and standard deviation from match stats
  SELECT
    AVG(rating),
    STDDEV(rating)
  INTO v_avg_rating, v_stddev
  FROM public.player_match_stats pms
  JOIN public.fixtures f ON f.id = pms.fixture_id
  WHERE pms.player_id = p_player_id
    AND pms.rating IS NOT NULL
    AND EXTRACT(YEAR FROM f.date) = p_season;

  -- If no data, return 0
  IF v_avg_rating IS NULL OR v_stddev IS NULL THEN
    RETURN 0;
  END IF;

  -- Consistency = 10 - (stddev * 2), clamped to 0-10
  -- Lower variance = higher consistency
  v_consistency := GREATEST(0, LEAST(10, 10 - (v_stddev * 2)));

  RETURN ROUND(v_consistency, 2);
END;
$$;


--
-- Name: calculate_fantasy_leaderboard(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_fantasy_leaderboard(p_game_id uuid, p_game_week_id uuid) RETURNS TABLE(user_id uuid, username text, avatar text, total_points numeric, booster_used integer, rank bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  WITH ranked_teams AS (
    SELECT
      uft.user_id,
      u.username,
      u.avatar_url as avatar,
      uft.total_points,
      uft.booster_used,
      RANK() OVER (ORDER BY uft.total_points DESC) as rank
    FROM user_fantasy_teams uft
    INNER JOIN users u ON u.id = uft.user_id
    WHERE uft.game_id = p_game_id AND uft.game_week_id = p_game_week_id
    ORDER BY rank
  )
  SELECT * FROM ranked_teams;
END;
$$;


--
-- Name: calculate_fantasy_status(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_fantasy_status(pgs_value numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  IF pgs_value >= 6.0 THEN
    RETURN 'Star';
  ELSIF pgs_value >= 4.5 THEN
    RETURN 'Key';
  ELSE
    RETURN 'Wild';
  END IF;
END;
$$;


--
-- Name: calculate_impact_score(integer, integer, integer, integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_shots_on_target integer, p_appearances integer) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_impact DECIMAL(5,2);
  v_per_game DECIMAL(5,2);
BEGIN
  -- Avoid division by zero
  IF p_appearances = 0 THEN
    RETURN 0;
  END IF;

  -- Calculate weighted impact per game
  v_per_game := (
    (p_goals * 1.0) +
    (p_assists * 0.7) +
    (p_passes_key * 0.3) +
    (p_dribbles_success * 0.2) +
    (p_tackles_total * 0.15) +
    (p_shots_on_target * 0.1)
  ) / p_appearances::DECIMAL;

  -- Normalize to 0-10 scale (capped at 10)
  v_impact := LEAST(10, v_per_game);

  RETURN ROUND(v_impact, 2);
END;
$$;


--
-- Name: calculate_impact_score(integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_tackles_interceptions integer, p_shots_on_target integer, p_duels_won integer, p_clean_sheets integer, p_saves integer, p_penalties_saved integer, p_appearances integer, p_position text) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: calculate_pgs(numeric, numeric, numeric, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_pgs(p_rating numeric, p_impact numeric, p_consistency numeric, p_minutes_played integer, p_appearances integer) RETURNS numeric
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: calculate_user_weekly_xp(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.calculate_user_weekly_xp(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_current_level INT;
  v_goat_bonus_active BOOLEAN;
  v_last_active_date TIMESTAMPTZ;
  v_days_active INT := 0;
  v_predictions_made INT := 0;
  v_predictions_correct INT := 0;
  v_fantasy_avg_score NUMERIC := 0;
  v_avg_win_odds NUMERIC := 1.0;
  v_badges_earned INT := 0;
  v_game_types_played INT := 0;
  v_activity_xp NUMERIC := 0;
  v_accuracy_xp NUMERIC := 0;
  v_fantasy_xp NUMERIC := 0;
  v_risk_xp NUMERIC := 0;
  v_badges_xp NUMERIC := 0;
  v_games_xp NUMERIC := 0;
  v_total_xp NUMERIC := 0;
  v_diminishing_factor NUMERIC;
  v_decay_factor NUMERIC := 0;
  v_weeks_inactive INT := 0;
  v_goat_multiplier NUMERIC := 1.0;
  v_accuracy NUMERIC := 0;
  v_week_start DATE;
BEGIN
  SELECT current_level, goat_bonus_active, last_active_date
  INTO v_current_level, v_goat_bonus_active, v_last_active_date
  FROM public.users WHERE id = p_user_id;

  IF v_last_active_date IS NOT NULL THEN
    v_weeks_inactive := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_last_active_date)) / 604800)::INT;
  END IF;
  IF v_weeks_inactive >= 2 AND v_current_level < 6 THEN
    v_decay_factor := LEAST(public.xp_coef('decay_cap', 0.30), public.xp_coef('decay_rate', 0.02) * v_weeks_inactive);
  END IF;

  v_week_start := public.get_week_start(NOW() - INTERVAL '1 week');
  SELECT
    COALESCE(days_active, 0), COALESCE(predictions_made, 0), COALESCE(predictions_correct, 0),
    COALESCE(fantasy_avg_score, 0), COALESCE(NULLIF(avg_win_odds, 0), 1.0),
    COALESCE(badges_earned, 0), COALESCE(game_types_played, 0)
  INTO
    v_days_active, v_predictions_made, v_predictions_correct,
    v_fantasy_avg_score, v_avg_win_odds, v_badges_earned, v_game_types_played
  FROM public.user_activity_logs
  WHERE user_id = p_user_id AND week_start = v_week_start;

  IF v_predictions_made > 0 THEN
    v_accuracy := (v_predictions_correct::NUMERIC / v_predictions_made) * 100;
  END IF;

  v_activity_xp := v_days_active        * public.xp_coef('activity_per_day', 50);
  v_accuracy_xp := v_accuracy           * public.xp_coef('accuracy_mult', 1.2);
  v_fantasy_xp  := v_fantasy_avg_score  * public.xp_coef('fantasy_mult', 0.5);
  v_risk_xp     := (v_avg_win_odds - 1) * public.xp_coef('risk_mult', 100);
  v_badges_xp   := v_badges_earned      * public.xp_coef('badge_xp', 150);
  v_games_xp    := v_game_types_played  * public.xp_coef('game_variety_mult', 40);

  v_diminishing_factor := 1.0 / (1.0 + public.xp_coef('diminishing_rate', 0.05) * (v_current_level - 1));
  IF v_goat_bonus_active THEN
    v_goat_multiplier := public.xp_coef('goat_multiplier', 1.05);
  END IF;

  v_total_xp := (v_activity_xp + v_accuracy_xp + v_fantasy_xp + v_risk_xp + v_badges_xp + v_games_xp)
                * v_diminishing_factor * v_goat_multiplier;
  v_total_xp := v_total_xp * (1.0 - v_decay_factor);
  RETURN GREATEST(ROUND(v_total_xp), 0)::INT;
END;
$$;


--
-- Name: FUNCTION calculate_user_weekly_xp(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.calculate_user_weekly_xp(p_user_id uuid) IS 'Calculates XP earned by a user in the past week using real activity data';


--
-- Name: cancel_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_challenge(p_challenge_id uuid) RETURNS TABLE(out_success boolean, out_message text, out_refunded_users integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_entry_cost INTEGER;
  v_refunded_count INTEGER := 0;
  v_participant RECORD;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can cancel challenges';
  END IF;

  -- Get challenge details
  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_entry_cost IS NULL THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Refund all participants
  FOR v_participant IN
    SELECT user_id FROM public.challenge_participants WHERE challenge_id = p_challenge_id
  LOOP
    -- Refund coins
    UPDATE public.users
    SET coins_balance = coins_balance + v_entry_cost
    WHERE id = v_participant.user_id;

    v_refunded_count := v_refunded_count + 1;
  END LOOP;

  -- Update challenge status to cancelled
  UPDATE public.challenges
  SET status = 'finished'::public.challenge_status_enum,
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge cancelled and participants refunded'::TEXT, v_refunded_count;
END;
$$;


--
-- Name: FUNCTION cancel_challenge(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.cancel_challenge(p_challenge_id uuid) IS 'Admin function to cancel a challenge and refund all participants';


--
-- Name: cancel_match_bet(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cancel_match_bet(p_fixture_id uuid) RETURNS TABLE(success boolean, new_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user    uuid := auth.uid();
  v_bet     public.match_bets%rowtype;
  v_balance integer;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  select * into v_bet from public.match_bets
    where user_id = v_user and fixture_id = p_fixture_id for update;
  if not found then raise exception 'Bet not found'; end if;
  if v_bet.status <> 'pending' then raise exception 'Bet already settled'; end if;

  update public.users set coins_balance = coins_balance + v_bet.amount
    where id = v_user returning coins_balance into v_balance;
  delete from public.match_bets where id = v_bet.id;

  return query select true, v_balance;
end;
$$;


--
-- Name: check_daily_streak(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_daily_streak(p_user_id uuid) RETURNS TABLE(is_available boolean, streak_day integer, is_first_time boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_streak RECORD;
  v_now TIMESTAMPTZ;
  v_current_streak_day TIMESTAMPTZ;
  v_last_claimed_streak_day TIMESTAMPTZ;
  v_days_difference INTEGER;
BEGIN
  v_now := now();

  -- Get user streak data
  SELECT * INTO v_streak
  FROM public.user_streaks
  WHERE user_id = p_user_id;

  -- If no streak exists, it's the first time
  IF v_streak IS NULL THEN
    RETURN QUERY SELECT true, 1, true;
    RETURN;
  END IF;

  -- Define "streak day": from 8:00 today to 7:59 tomorrow
  v_current_streak_day := v_now;
  IF EXTRACT(HOUR FROM v_now) < 8 THEN
    -- Before 8:00, we're still in yesterday's streak day
    v_current_streak_day := v_current_streak_day - INTERVAL '1 day';
  END IF;
  v_current_streak_day := date_trunc('day', v_current_streak_day) + INTERVAL '8 hours';

  -- Calculate last claimed streak day
  v_last_claimed_streak_day := v_streak.last_claimed_at;
  IF EXTRACT(HOUR FROM v_last_claimed_streak_day) < 8 THEN
    v_last_claimed_streak_day := v_last_claimed_streak_day - INTERVAL '1 day';
  END IF;
  v_last_claimed_streak_day := date_trunc('day', v_last_claimed_streak_day) + INTERVAL '8 hours';

  -- Calculate days difference
  v_days_difference := EXTRACT(DAY FROM v_current_streak_day - v_last_claimed_streak_day)::INTEGER;

  -- Already claimed today
  IF v_days_difference = 0 THEN
    RETURN QUERY SELECT false, 0, false;
    RETURN;
  END IF;

  -- Can claim today - streak continues
  IF v_days_difference = 1 THEN
    RETURN QUERY SELECT
      true,
      CASE WHEN v_streak.current_day = 7 THEN 1 ELSE v_streak.current_day + 1 END,
      false;
    RETURN;
  END IF;

  -- More than 1 day of inactivity - streak reset
  RETURN QUERY SELECT true, 1, false;
END;
$$;


--
-- Name: check_team_composition(uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.check_team_composition(p_starters uuid[]) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_gk INTEGER;
  v_def INTEGER;
  v_mid INTEGER;
  v_att INTEGER;
BEGIN
  IF array_length(p_starters, 1) != 7 THEN
    RETURN false;
  END IF;

  SELECT
    COUNT(*) FILTER (WHERE "position" = 'Goalkeeper'),
    COUNT(*) FILTER (WHERE "position" = 'Defender'),
    COUNT(*) FILTER (WHERE "position" = 'Midfielder'),
    COUNT(*) FILTER (WHERE "position" = 'Attacker')
  INTO v_gk, v_def, v_mid, v_att
  FROM fantasy_players
  WHERE id = ANY(p_starters);

  IF v_gk != 1 OR v_def < 2 OR v_def > 3 OR v_mid < 2 OR v_mid > 3 OR v_att < 1 OR v_att > 2 THEN
    RETURN false;
  END IF;

  RETURN true;
END;
$$;


--
-- Name: claim_daily_free_spin(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daily_free_spin(p_user_id uuid) RETURNS TABLE(success boolean, message text, spins_granted integer, next_available_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_last_claim TIMESTAMPTZ;
  v_can_claim BOOLEAN;
  v_new_streak INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get last claim time
  SELECT last_free_spin_at INTO v_last_claim
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Check if can claim (24 hours cooldown)
  v_can_claim := v_last_claim IS NULL OR (NOW() - v_last_claim) >= INTERVAL '24 hours';

  IF NOT v_can_claim THEN
    RETURN QUERY SELECT
      false,
      'Daily free spin already claimed. Try again later.',
      0::INTEGER,
      v_last_claim + INTERVAL '24 hours';
    RETURN;
  END IF;

  -- Update streak
  IF v_last_claim IS NULL OR (NOW() - v_last_claim) > INTERVAL '48 hours' THEN
    v_new_streak := 1;
  ELSE
    SELECT free_spin_streak + 1 INTO v_new_streak
    FROM public.user_spin_states
    WHERE user_id = p_user_id;
  END IF;

  -- Grant free spin and update state
  UPDATE public.user_spin_states
  SET
    available_spins = available_spins || jsonb_build_object('free',
      COALESCE((available_spins->>'free')::INTEGER, 0) + 1
    ),
    last_free_spin_at = NOW(),
    free_spin_streak = v_new_streak,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN QUERY SELECT
    true,
    'Free spin granted! Current streak: ' || v_new_streak::TEXT,
    1::INTEGER,
    NOW() + INTERVAL '24 hours';
END;
$$;


--
-- Name: FUNCTION claim_daily_free_spin(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.claim_daily_free_spin(p_user_id uuid) IS 'Claims daily free spin with 24h cooldown';


--
-- Name: claim_daily_streak(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.claim_daily_streak(p_user_id uuid) RETURNS TABLE(success boolean, streak_day integer, reward_type text, reward_amount integer, new_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_check RECORD;
  v_new_day INTEGER;
  v_reward_coins INTEGER;
  v_reward_ticket TEXT;
  v_new_balance INTEGER;
  v_add_result RECORD;
BEGIN
  -- Check if user can claim
  SELECT * INTO v_check FROM public.check_daily_streak(p_user_id);

  IF NOT v_check.is_available THEN
    RAISE EXCEPTION 'Streak not available to claim';
  END IF;

  v_new_day := v_check.streak_day;

  -- Determine reward based on day
  CASE v_new_day
    WHEN 1 THEN v_reward_coins := 100;
    WHEN 2 THEN v_reward_coins := 200;
    WHEN 3 THEN v_reward_coins := 300;
    WHEN 4, 5, 6 THEN v_reward_coins := 500;
    WHEN 7 THEN v_reward_ticket := 'rookie';
  END CASE;

  -- Update or insert streak record
  INSERT INTO public.user_streaks (user_id, current_day, last_claimed_at)
  VALUES (p_user_id, v_new_day, now())
  ON CONFLICT (user_id) DO UPDATE
  SET
    current_day = v_new_day,
    last_claimed_at = now(),
    updated_at = now();

  -- Grant coin reward
  IF v_reward_coins IS NOT NULL THEN
    -- Use add_coins RPC to log transaction
    SELECT * INTO v_add_result
    FROM public.add_coins(
      p_user_id,
      v_reward_coins,
      'daily_streak',
      jsonb_build_object('streak_day', v_new_day)
    );

    RETURN QUERY SELECT
      true,
      v_new_day,
      'coins'::TEXT,
      v_reward_coins,
      v_add_result.new_balance;
    RETURN;
  END IF;

  -- Grant ticket reward (Day 7)
  IF v_reward_ticket IS NOT NULL THEN
    -- Insert ticket into user_tickets table
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    VALUES (
      p_user_id,
      v_reward_ticket,
      now() + INTERVAL '30 days'
    );

    -- Get current balance
    SELECT coins_balance INTO v_new_balance
    FROM public.users
    WHERE id = p_user_id;

    RETURN QUERY SELECT
      true,
      v_new_day,
      'ticket'::TEXT,
      0,
      v_new_balance;
    RETURN;
  END IF;
END;
$$;


--
-- Name: clean_expired_multipliers(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.clean_expired_multipliers(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_multipliers JSONB;
  v_clean_multipliers JSONB := '{}'::jsonb;
  v_key TEXT;
  v_value JSONB;
  v_expires_at TIMESTAMPTZ;
BEGIN
  -- Get current multipliers
  SELECT adaptive_multipliers INTO v_current_multipliers
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Return empty if no multipliers
  IF v_current_multipliers IS NULL OR v_current_multipliers = '{}'::jsonb THEN
    RETURN '{}'::jsonb;
  END IF;

  -- Filter out expired entries
  FOR v_key, v_value IN SELECT * FROM jsonb_each(v_current_multipliers)
  LOOP
    v_expires_at := (v_value->>'expiresAt')::TIMESTAMPTZ;
    IF v_expires_at > NOW() THEN
      v_clean_multipliers := v_clean_multipliers || jsonb_build_object(v_key, v_value);
    END IF;
  END LOOP;

  -- Update and return
  UPDATE public.user_spin_states
  SET
    adaptive_multipliers = v_clean_multipliers,
    updated_at = NOW()
  WHERE user_id = p_user_id;

  RETURN v_clean_multipliers;
END;
$$;


--
-- Name: FUNCTION clean_expired_multipliers(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.clean_expired_multipliers(p_user_id uuid) IS 'Removes expired adaptive multipliers';


--
-- Name: cleanup_expired_tickets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.cleanup_expired_tickets() RETURNS TABLE(expired_count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_expired_tickets RECORD;
  v_count BIGINT := 0;
BEGIN
  -- Log all expired tickets to transactions
  FOR v_expired_tickets IN
    SELECT id, user_id, ticket_type
    FROM public.user_tickets
    WHERE is_used = false
      AND expires_at <= now()
  LOOP
    INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type)
    VALUES (v_expired_tickets.user_id, v_expired_tickets.id, v_expired_tickets.ticket_type, 'expired');

    v_count := v_count + 1;
  END LOOP;

  RETURN QUERY SELECT v_count;
END;
$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id uuid NOT NULL,
    email text,
    username text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    coins_balance integer DEFAULT 1000 NOT NULL,
    profile_picture_url text,
    level text DEFAULT 'Amateur'::text NOT NULL,
    xp integer DEFAULT 0 NOT NULL,
    favorite_team_id uuid,
    is_subscribed boolean DEFAULT false NOT NULL,
    is_admin boolean DEFAULT false,
    xp_total integer DEFAULT 0 NOT NULL,
    current_level integer DEFAULT 1 NOT NULL,
    level_name text DEFAULT 'Rookie'::text NOT NULL,
    last_active_date timestamp with time zone,
    goat_bonus_active boolean DEFAULT false NOT NULL,
    role text DEFAULT 'user'::text,
    display_name text,
    user_type public.user_role_enum DEFAULT 'guest'::public.user_role_enum NOT NULL,
    favorite_club text,
    favorite_national_team text,
    is_super_admin boolean DEFAULT false NOT NULL,
    last_active_at timestamp with time zone,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    badges_cache jsonb DEFAULT '[]'::jsonb,
    timezone text,
    CONSTRAINT check_valid_role CHECK ((role = ANY (ARRAY['user'::text, 'admin'::text, 'super_admin'::text])))
);


--
-- Name: TABLE users; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.users IS 'Public user profiles, linked to Supabase auth.';


--
-- Name: COLUMN users.role; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.role IS 'User role: user (default), admin (read-only admin panel), super_admin (full config access)';


--
-- Name: COLUMN users.timezone; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.users.timezone IS 'User timezone (auto-detected from browser if NULL). Example: Europe/Paris, America/New_York, Africa/Casablanca';


--
-- Name: complete_guest_registration(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.complete_guest_registration(p_username text, p_display_name text, p_email text) RETURNS public.users
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_updated public.users;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  UPDATE public.users
  SET
    username = COALESCE(NULLIF(trim(p_username), ''), username, public.generate_guest_username()),
    display_name = COALESCE(NULLIF(trim(p_display_name), ''), display_name, username),
    email = COALESCE(NULLIF(trim(p_email), ''), email),
    user_type = 'user',
    updated_at = now()
  WHERE id = auth.uid()
  RETURNING * INTO v_updated;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User profile not found';
  END IF;

  RETURN v_updated;
END;
$$;


--
-- Name: compute_lf_crowd_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_lf_crowd_stats(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_players INT; v_top NUMERIC; v_winner JSONB; v_most JSONB; v_cap JSONB; v_gk JSONB; v_pot INT;
BEGIN
  SELECT pot_amount INTO v_pot FROM lf_games WHERE id = p_game_id;
  SELECT count(*), COALESCE(max(score), 0) INTO v_players, v_top FROM lf_teams WHERE game_id = p_game_id;
  IF COALESCE(v_players,0) = 0 THEN RETURN jsonb_build_object('players', 0); END IF;
  SELECT jsonb_build_object('username', COALESCE(pr.username, 'Player'), 'score', t.score)
  INTO v_winner FROM lf_teams t LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.game_id = p_game_id ORDER BY t.score DESC NULLS LAST LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'pct', round(100.0 * count(*) / v_players))
  INTO v_most FROM lf_team_players tp JOIN lf_teams t ON t.id = tp.team_id JOIN players pl ON pl.id = tp.player_id
  WHERE t.game_id = p_game_id AND tp.active GROUP BY pl.id, pl.name ORDER BY count(*) DESC LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'pct', round(100.0 * count(*) / v_players))
  INTO v_cap FROM lf_teams t JOIN players pl ON pl.id = t.captain_player_id
  WHERE t.game_id = p_game_id AND t.captain_player_id IS NOT NULL GROUP BY pl.id, pl.name ORDER BY count(*) DESC LIMIT 1;
  SELECT jsonb_build_object('name', pl.name, 'mult', gu.mult,
    'pct', round(100.0 * COALESCE((SELECT count(*) FROM lf_team_players tp2 JOIN lf_teams t2 ON t2.id = tp2.team_id
              WHERE t2.game_id = p_game_id AND tp2.player_id = gu.pid AND tp2.active), 0) / v_players))
  INTO v_gk FROM (
    SELECT key::uuid AS pid, value::numeric AS mult FROM lf_games g, jsonb_each_text(g.gk_underdog)
    WHERE g.id = p_game_id ORDER BY value::numeric DESC LIMIT 1) gu
  JOIN players pl ON pl.id = gu.pid;
  RETURN jsonb_build_object('players', v_players, 'top_score', v_top, 'winner', v_winner,
    'most_picked', v_most, 'best_captain', v_cap, 'gk_underdog', v_gk, 'pot', COALESCE(v_pot, 0));
END $$;


--
-- Name: compute_lp_crowd_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_lp_crowd_stats(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE gh INT; ga INT; v_total INT; v_correct INT; v_exact INT; v_top INT; v_preds JSONB;
BEGIN
  SELECT f.goals_home, f.goals_away INTO gh, ga
  FROM live_games g JOIN fb_fixtures f ON f.id = g.fixture_id WHERE g.id = p_game_id;
  IF gh IS NULL OR ga IS NULL THEN RETURN NULL; END IF;
  SELECT count(*),
    count(*) FILTER (WHERE sign((predicted_score->>'home')::int - (predicted_score->>'away')::int) = sign(gh - ga)),
    count(*) FILTER (WHERE (predicted_score->>'home')::int = gh AND (predicted_score->>'away')::int = ga),
    COALESCE(max(total_points), 0)
  INTO v_total, v_correct, v_exact, v_top
  FROM live_game_entries WHERE game_id = p_game_id AND predicted_score IS NOT NULL;
  IF COALESCE(v_total,0) = 0 THEN RETURN jsonb_build_object('players', 0); END IF;
  SELECT jsonb_agg(x) INTO v_preds FROM (
    SELECT jsonb_build_object(
      'score', (predicted_score->>'home') || '-' || (predicted_score->>'away'),
      'pct', round(100.0 * count(*) / v_total)) AS x
    FROM live_game_entries WHERE game_id = p_game_id AND predicted_score IS NOT NULL
    GROUP BY (predicted_score->>'home'), (predicted_score->>'away')
    ORDER BY count(*) DESC LIMIT 3) t;
  RETURN jsonb_build_object(
    'players', v_total,
    'correct_winner_pct', round(100.0 * v_correct / v_total),
    'exact_score_pct', round(100.0 * v_exact / v_total),
    'actual_score', jsonb_build_object('home', gh, 'away', ga),
    'top_predictions', COALESCE(v_preds, '[]'::jsonb),
    'top_score', v_top);
END $$;


--
-- Name: compute_mr_crowd_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.compute_mr_crowd_stats(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entered INT; v_survived INT; v_pot INT; v_winners JSONB; v_peak JSONB;
BEGIN
  SELECT pot_amount INTO v_pot FROM mr_games WHERE id = p_game_id;
  SELECT count(*), count(*) FILTER (WHERE is_winner) INTO v_entered, v_survived
  FROM mr_participants WHERE game_id = p_game_id;
  IF COALESCE(v_entered,0) = 0 THEN RETURN jsonb_build_object('entered', 0); END IF;
  SELECT jsonb_agg(jsonb_build_object('username', COALESCE(pr.username, 'Player'), 'prize', p.prize_amount))
  INTO v_winners FROM mr_participants p LEFT JOIN profiles pr ON pr.id = p.user_id
  WHERE p.game_id = p_game_id AND p.is_winner;
  SELECT jsonb_build_object('seq', eliminated_question_seq, 'count', count(*))
  INTO v_peak FROM mr_participants
  WHERE game_id = p_game_id AND eliminated_question_seq IS NOT NULL
  GROUP BY eliminated_question_seq ORDER BY count(*) DESC LIMIT 1;
  RETURN jsonb_build_object('entered', v_entered, 'survived', v_survived,
    'survived_pct', round(100.0 * v_survived / v_entered), 'pot', COALESCE(v_pot, 0),
    'winners', COALESCE(v_winners, '[]'::jsonb), 'elimination_peak', v_peak);
END $$;


--
-- Name: create_challenge(text, text, text, text, text, timestamp with time zone, timestamp with time zone, integer, jsonb, jsonb, text, jsonb, jsonb, uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_challenge(p_name text, p_description text DEFAULT NULL::text, p_game_type text DEFAULT 'betting'::text, p_format text DEFAULT 'leaderboard'::text, p_sport text DEFAULT 'football'::text, p_start_date timestamp with time zone DEFAULT now(), p_end_date timestamp with time zone DEFAULT (now() + '7 days'::interval), p_entry_cost integer DEFAULT 0, p_prizes jsonb DEFAULT '[]'::jsonb, p_rules jsonb DEFAULT '{}'::jsonb, p_status text DEFAULT 'upcoming'::text, p_entry_conditions jsonb DEFAULT '{}'::jsonb, p_configs jsonb DEFAULT '[]'::jsonb, p_league_ids uuid[] DEFAULT ARRAY[]::uuid[], p_match_ids uuid[] DEFAULT ARRAY[]::uuid[]) RETURNS TABLE(out_challenge_id uuid, out_success boolean, out_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_challenge_id UUID;
  v_league_id UUID;
  v_match_id UUID;
  v_config JSONB;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can create challenges';
  END IF;

  -- Create challenge
  INSERT INTO public.challenges (
    name,
    description,
    game_type,
    format,
    sport,
    start_date,
    end_date,
    entry_cost,
    prizes,
    rules,
    status,
    entry_conditions
  ) VALUES (
    p_name,
    p_description,
    p_game_type::public.game_type_enum,
    p_format::public.challenge_format_enum,
    p_sport::public.sport_enum,
    p_start_date,
    p_end_date,
    p_entry_cost,
    p_prizes,
    p_rules,
    p_status::public.challenge_status_enum,
    p_entry_conditions
  )
  RETURNING id INTO v_challenge_id;

  -- Add challenge configs
  IF jsonb_array_length(p_configs) > 0 THEN
    FOR v_config IN SELECT * FROM jsonb_array_elements(p_configs)
    LOOP
      INSERT INTO public.challenge_configs (
        challenge_id,
        config_type,
        config_data
      ) VALUES (
        v_challenge_id,
        v_config->>'config_type',
        v_config->'config_data'
      )
      ON CONFLICT (challenge_id, config_type) DO UPDATE
      SET config_data = EXCLUDED.config_data;
    END LOOP;
  END IF;

  -- Link leagues
  IF array_length(p_league_ids, 1) > 0 THEN
    FOREACH v_league_id IN ARRAY p_league_ids
    LOOP
      INSERT INTO public.challenge_leagues (challenge_id, league_id)
      VALUES (v_challenge_id, v_league_id)
      ON CONFLICT (challenge_id, league_id) DO NOTHING;
    END LOOP;
  END IF;

  -- Link matches
  IF array_length(p_match_ids, 1) > 0 THEN
    FOREACH v_match_id IN ARRAY p_match_ids
    LOOP
      INSERT INTO public.challenge_matches (challenge_id, match_id)
      VALUES (v_challenge_id, v_match_id)
      ON CONFLICT (challenge_id, match_id) DO NOTHING;
    END LOOP;
  END IF;

  RETURN QUERY SELECT
    v_challenge_id,
    TRUE,
    'Challenge created successfully'::TEXT;
END;
$$;


--
-- Name: FUNCTION create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) IS 'Admin function to create a new challenge with configs, leagues, and matches';


--
-- Name: create_default_notification_preferences(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_default_notification_preferences() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION create_default_notification_preferences(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_default_notification_preferences() IS 'Automatically creates default notification preferences when a new user is created.';


--
-- Name: create_league(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_league(p_name text, p_description text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    new_league_id uuid;
    new_invite_code text;
BEGIN
    -- Generate a unique invite code
    new_invite_code := public.generate_random_string(8);
    WHILE EXISTS (SELECT 1 FROM public.leagues WHERE leagues.invite_code = new_invite_code) LOOP
        new_invite_code := public.generate_random_string(8);
    END LOOP;

    -- Insert the new league
    INSERT INTO public.leagues (name, description, invite_code, created_by)
    VALUES (p_name, p_description, new_invite_code, auth.uid())
    RETURNING leagues.id INTO new_league_id;

    -- Insert the creator as an admin member.
    -- ON CONFLICT ensures that if the user is already a member (e.g., due to a race condition or a stray trigger),
    -- the query will not fail. This is the key fix.
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (new_league_id, auth.uid(), 'admin')
    ON CONFLICT (league_id, user_id) DO NOTHING;

    -- Return just the ID of the new league.
    RETURN new_league_id;
END;
$$;


--
-- Name: create_notification(uuid, text, text, text, text, text, jsonb, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text DEFAULT NULL::text, p_action_link text DEFAULT NULL::text, p_metadata jsonb DEFAULT '{}'::jsonb, p_onesignal_notification_id text DEFAULT NULL::text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_notification_id UUID;
BEGIN
  INSERT INTO public.notifications (
    user_id,
    type,
    title,
    message,
    action_label,
    action_link,
    metadata,
    onesignal_notification_id
  ) VALUES (
    p_user_id,
    p_type,
    p_title,
    p_message,
    p_action_label,
    p_action_link,
    p_metadata,
    p_onesignal_notification_id
  )
  RETURNING id INTO v_notification_id;

  RETURN v_notification_id;
END;
$$;


--
-- Name: FUNCTION create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text) IS 'Helper function to create a notification. Can be called from edge functions or database triggers.';


--
-- Name: generate_invite_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_invite_code() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; -- Removed confusing chars: I, O, 0, 1
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..8 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: squads; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squads (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    image_url text,
    invite_code text DEFAULT public.generate_invite_code() NOT NULL,
    created_by uuid NOT NULL,
    season_start_date timestamp with time zone,
    season_end_date timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squads_description_check CHECK ((char_length(description) <= 500)),
    CONSTRAINT squads_name_check CHECK (((char_length(name) >= 2) AND (char_length(name) <= 50))),
    CONSTRAINT valid_season_dates CHECK (((season_start_date IS NULL) OR (season_end_date IS NULL) OR (season_end_date > season_start_date)))
);


--
-- Name: TABLE squads; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squads IS 'User-created social groups for competing in challenges together. Not to be confused with leagues table (football competitions).';


--
-- Name: create_squad(uuid, text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.create_squad(p_user_id uuid, p_name text, p_description text DEFAULT NULL::text, p_image_url text DEFAULT NULL::text) RETURNS public.squads
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_squad public.squads;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF length(trim(COALESCE(p_name, ''))) < 2 THEN RAISE EXCEPTION 'name_too_short'; END IF;
  INSERT INTO public.squads (name, description, image_url, created_by)
  VALUES (trim(p_name), NULLIF(trim(COALESCE(p_description, '')), ''), NULLIF(p_image_url, ''), p_user_id)
  RETURNING * INTO v_squad;
  RETURN v_squad;
END;
$$;


--
-- Name: deduct_coins(uuid, integer, text, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.deduct_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb DEFAULT '{}'::jsonb) RETURNS TABLE(success boolean, new_balance integer, transaction_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
  v_transaction_id UUID;
BEGIN
  -- Validate user (must be self or admin)
  IF p_user_id IS DISTINCT FROM auth.uid() AND NOT public.is_admin() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;

  -- Validate amount
  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Amount must be positive';
  END IF;

  -- Check balance and deduct
  SELECT coins_balance INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id
  FOR UPDATE;

  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'INSUFFICIENT_COINS';
  END IF;

  UPDATE public.users
  SET coins_balance = coins_balance - p_amount
  WHERE id = p_user_id
  RETURNING coins_balance INTO v_new_balance;

  -- Log transaction (negative amount)
  INSERT INTO public.coin_transactions (user_id, amount, balance_after, transaction_type, metadata)
  VALUES (p_user_id, -p_amount, v_new_balance, p_transaction_type, p_metadata)
  RETURNING id INTO v_transaction_id;

  RETURN QUERY SELECT true, v_new_balance, v_transaction_id;
END;
$$;


--
-- Name: delete_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.delete_challenge(p_challenge_id uuid) RETURNS TABLE(out_success boolean, out_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can delete challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT;
    RETURN;
  END IF;

  -- Delete challenge (CASCADE will handle related records)
  DELETE FROM public.challenges WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge deleted successfully'::TEXT;
END;
$$;


--
-- Name: FUNCTION delete_challenge(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.delete_challenge(p_challenge_id uuid) IS 'Admin function to delete a challenge (CASCADE handles related records)';


--
-- Name: distribute_challenge_prizes(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.distribute_challenge_prizes(p_challenge_id uuid) RETURNS TABLE(out_user_id uuid, out_rank integer, out_rewards_distributed jsonb, out_success boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_challenge RECORD;
  v_participant RECORD;
  v_prize_tier JSONB;
  v_reward JSONB;
  v_total_participants INTEGER;
  v_qualifies BOOLEAN;
  v_distributed_rewards JSONB;
  v_reward_success BOOLEAN;
BEGIN
  -- Get challenge details
  SELECT * INTO v_challenge
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF v_challenge IS NULL THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  -- Get total participants count
  SELECT COUNT(*) INTO v_total_participants
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id;

  -- Loop through all participants
  FOR v_participant IN
    SELECT *
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
    ORDER BY rank ASC
  LOOP
    -- Skip if already has rewards
    IF v_participant.reward IS NOT NULL THEN
      CONTINUE;
    END IF;

    v_distributed_rewards := '[]'::JSONB;

    -- Check each prize tier in the challenge
    IF v_challenge.prizes IS NOT NULL THEN
      FOR v_prize_tier IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_challenge.prizes)
      LOOP
        -- Check if participant qualifies for this tier
        v_qualifies := public.participant_qualifies_for_reward(
          v_participant.rank,
          v_total_participants,
          v_prize_tier->>'positionType',
          (v_prize_tier->>'start')::INTEGER,
          CASE WHEN v_prize_tier->>'end' IS NOT NULL
            THEN (v_prize_tier->>'end')::INTEGER
            ELSE NULL
          END
        );

        IF v_qualifies THEN
          -- Distribute each reward in this tier
          FOR v_reward IN SELECT * FROM JSONB_ARRAY_ELEMENTS(v_prize_tier->'rewards')
          LOOP
            -- Distribute the reward
            v_reward_success := public.distribute_reward_to_user(
              v_participant.user_id,
              v_reward->>'type',
              COALESCE((v_reward->>'value')::INTEGER, 0),
              v_reward->>'tier'
            );

            -- Add to distributed rewards list
            IF v_reward_success THEN
              v_distributed_rewards := v_distributed_rewards || JSONB_BUILD_ARRAY(v_reward);
            END IF;
          END LOOP;

          -- Only apply first matching tier (prevent double rewards)
          EXIT;
        END IF;
      END LOOP;
    END IF;

    -- Update participant with distributed rewards
    UPDATE public.challenge_participants
    SET reward = v_distributed_rewards
    WHERE id = v_participant.id;

    -- Return result for this participant
    RETURN QUERY SELECT
      v_participant.user_id,
      v_participant.rank,
      v_distributed_rewards,
      TRUE;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION distribute_challenge_prizes(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.distribute_challenge_prizes(p_challenge_id uuid) IS 'Distributes all prizes for a challenge based on final rankings';


--
-- Name: distribute_reward_to_user(uuid, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward jsonb, p_game_type text DEFAULT NULL::text, p_game_id uuid DEFAULT NULL::uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_type TEXT := p_reward->>'type';
  v_value INT := COALESCE((p_reward->>'value')::INT, 0);
  v_tier TEXT := COALESCE(NULLIF(p_reward->>'tier',''), 'amateur');
  v_qty INT := GREATEST(1, COALESCE((p_reward->>'quantity')::INT, 1));
  v_status TEXT := 'fulfilled';
  v_days INT; i INT;
BEGIN
  CASE v_type
    WHEN 'coins' THEN PERFORM public.add_coins(p_user_id, v_value*v_qty, 'challenge_reward', jsonb_build_object('game_type',p_game_type,'game_id',p_game_id));
    WHEN 'xp' THEN BEGIN INSERT INTO public.activity_log(user_id,action_type,xp_gained,metadata) VALUES(p_user_id,'challenge_reward',v_value*v_qty,jsonb_build_object('game_id',p_game_id)); EXCEPTION WHEN OTHERS THEN NULL; END;
    WHEN 'ticket' THEN FOR i IN 1..v_qty LOOP PERFORM public.grant_ticket(p_user_id, v_tier::public.ticket_type, 'game_reward'); END LOOP;
    WHEN 'spin' THEN PERFORM public.grant_spin(p_user_id, v_tier, v_qty);
    WHEN 'masterpass' THEN
      FOR i IN 1..v_qty LOOP INSERT INTO public.user_masterpasses(user_id, tier, source) VALUES(p_user_id, v_tier, COALESCE(p_game_type,'reward')); END LOOP;
    WHEN 'premium_3d','premium_7d','premium' THEN
      v_days := (CASE v_type WHEN 'premium_3d' THEN 3 WHEN 'premium_7d' THEN 7 ELSE GREATEST(1,v_value) END)*v_qty;
      UPDATE public.users SET premium_expires_at = GREATEST(COALESCE(premium_expires_at,now()),now()) + (v_days||' days')::INTERVAL WHERE id=p_user_id;
    ELSE v_status := 'pending';
  END CASE;
  INSERT INTO public.reward_fulfillments(user_id,game_type,game_id,reward_type,value,name,tier,quantity,status)
  VALUES(p_user_id,p_game_type,p_game_id,v_type,v_value,p_reward->>'name',v_tier,v_qty,v_status);
END;
$$;


--
-- Name: distribute_reward_to_user(uuid, text, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text DEFAULT NULL::text) RETURNS boolean
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_success BOOLEAN := FALSE;
BEGIN
  CASE p_reward_type
    WHEN 'coins' THEN
      -- Add coins to user balance
      UPDATE public.users
      SET coins_balance = coins_balance + p_reward_value
      WHERE id = p_user_id;
      v_success := TRUE;

    WHEN 'ticket' THEN
      -- Grant ticket (tier specified in p_reward_tier: rookie/amateur/master/apex)
      INSERT INTO public.user_tickets (user_id, ticket_type, expires_at, is_used)
      VALUES (
        p_user_id,
        COALESCE(p_reward_tier, 'rookie'),
        NOW() + INTERVAL '30 days',
        FALSE
      );
      v_success := TRUE;

    WHEN 'xp' THEN
      -- Grant XP (using existing XP system)
      INSERT INTO public.activity_log (user_id, activity_type, xp_earned, activity_metadata)
      VALUES (
        p_user_id,
        'challenge_reward',
        p_reward_value,
        JSONB_BUILD_OBJECT('source', 'prize_distribution')
      );
      v_success := TRUE;

    WHEN 'spin' THEN
      -- Grant free spins (stored in user metadata or separate table)
      -- TODO: Implement spin system if needed
      v_success := TRUE;

    WHEN 'premium_3d' THEN
      -- Grant 3 days of premium
      UPDATE public.users
      SET
        is_subscriber = TRUE,
        subscription_expires_at = GREATEST(
          COALESCE(subscription_expires_at, NOW()),
          NOW()
        ) + INTERVAL '3 days'
      WHERE id = p_user_id;
      v_success := TRUE;

    WHEN 'premium_7d' THEN
      -- Grant 7 days of premium
      UPDATE public.users
      SET
        is_subscriber = TRUE,
        subscription_expires_at = GREATEST(
          COALESCE(subscription_expires_at, NOW()),
          NOW()
        ) + INTERVAL '7 days'
      WHERE id = p_user_id;
      v_success := TRUE;

    ELSE
      -- For giftcard, masterpass, custom: just record in reward column
      v_success := TRUE;
  END CASE;

  RETURN v_success;
END;
$$;


--
-- Name: FUNCTION distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text) IS 'Distributes a single reward (coins, ticket, XP, etc.) to a user';


--
-- Name: edit_live_prediction(uuid, uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture_id UUID;
  v_fix_status TEXT;
  v_date TIMESTAMPTZ;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_home < 0 OR p_away < 0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_game_entries
                 WHERE live_game_id = p_game_id AND user_id = p_user_id AND predicted_score IS NOT NULL) THEN
    RAISE EXCEPTION 'no_prediction';
  END IF;

  SELECT fixture_id INTO v_fixture_id FROM public.live_games WHERE id = p_game_id;
  SELECT status, date INTO v_fix_status, v_date FROM public.fb_fixtures WHERE id = v_fixture_id;
  -- Allowed only while the match is live (started, not finished/cancelled).
  IF v_date IS NULL OR v_date > now() THEN RAISE EXCEPTION 'match_not_started'; END IF;
  IF v_fix_status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD') THEN
    RAISE EXCEPTION 'match_over';
  END IF;

  UPDATE public.live_game_entries
  SET predicted_score = jsonb_build_object('home', p_home, 'away', p_away),
      midtime_edit = true
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
END;
$$;


--
-- Name: end_of_season_reset(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.end_of_season_reset() RETURNS TABLE(users_processed integer, goats_awarded integer, season_name text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_season RECORD;
  v_next_season RECORD;
  v_users_processed INT := 0;
  v_goats_awarded INT := 0;
  v_user RECORD;
BEGIN
  -- Get current active season
  SELECT * INTO v_current_season
  FROM public.seasons
  WHERE is_active = true
  LIMIT 1;

  IF v_current_season.id IS NULL THEN
    RAISE EXCEPTION 'No active season found';
  END IF;

  -- Process all users
  FOR v_user IN
    SELECT id, xp_total, current_level, level_name, goat_bonus_active
    FROM public.users
  LOOP
    -- Archive current season data
    INSERT INTO public.season_logs (
      user_id,
      season_id,
      xp_final,
      level_final,
      goat_earned,
      created_at
    )
    VALUES (
      v_user.id,
      v_current_season.id,
      v_user.xp_total,
      v_user.level_name,
      v_user.current_level = 6, -- GOAT level
      NOW()
    );

    -- Check if user reached GOAT (level 6)
    IF v_user.current_level = 6 THEN
      v_goats_awarded := v_goats_awarded + 1;

      -- Award GOAT badge (assuming badge named 'GOAT' exists)
      INSERT INTO public.user_badges (user_id, badge_id, season_id, earned_at)
      SELECT v_user.id, b.id, v_current_season.id, NOW()
      FROM public.badges b
      WHERE b.name = 'GOAT'
      ON CONFLICT DO NOTHING;

      -- Reset GOAT users to Rising Star (level 2) with bonus active
      UPDATE public.users
      SET
        xp_total = 0,
        current_level = 2,
        level_name = 'Rising Star',
        goat_bonus_active = true,
        updated_at = NOW()
      WHERE id = v_user.id;
    ELSE
      -- Reset non-GOAT users to Rising Star without bonus
      UPDATE public.users
      SET
        xp_total = 0,
        current_level = 2,
        level_name = 'Rising Star',
        goat_bonus_active = false,
        updated_at = NOW()
      WHERE id = v_user.id;
    END IF;

    v_users_processed := v_users_processed + 1;
  END LOOP;

  -- Deactivate current season
  UPDATE public.seasons
  SET is_active = false
  WHERE id = v_current_season.id;

  -- Activate next season (if exists) - Fixed syntax
  SELECT * INTO v_next_season
  FROM public.seasons
  WHERE start_date > v_current_season.end_date
  ORDER BY start_date ASC
  LIMIT 1;

  IF v_next_season.id IS NOT NULL THEN
    UPDATE public.seasons
    SET is_active = true
    WHERE id = v_next_season.id;
  END IF;

  -- Return summary
  RETURN QUERY SELECT
    v_users_processed,
    v_goats_awarded,
    v_current_season.name;
END;
$$;


--
-- Name: FUNCTION end_of_season_reset(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.end_of_season_reset() IS 'Handles end-of-season processing: archives data, awards GOAT badges, resets XP';


--
-- Name: extract_first_initial(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_first_initial(name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT LOWER(LEFT(TRIM(normalize_name(name)), 1));
$$;


--
-- Name: extract_last_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.extract_last_name(name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
  SELECT (regexp_matches(remove_name_suffixes(normalize_name(name)), '(\S+)$'))[1];
$_$;


--
-- Name: finalize_betting_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_betting_challenge(p_challenge_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status TEXT;
  v_distributed BOOLEAN;
  v_prizes JSONB;
  v_total INTEGER;
  v_tier JSONB;
  v_ptype TEXT;
  v_start NUMERIC;
  v_end NUMERIC;
  v_lo INTEGER;
  v_hi INTEGER;
  v_participant RECORD;
  v_reward JSONB;
BEGIN
  SELECT status, prizes_distributed, prizes
    INTO v_status, v_distributed, v_prizes
  FROM public.challenges
  WHERE id = p_challenge_id;

  IF NOT FOUND THEN RETURN; END IF;

  -- Always refresh final ranks
  PERFORM public.update_challenge_rankings(p_challenge_id);

  -- Distribute prizes once
  IF NOT v_distributed AND jsonb_typeof(v_prizes) = 'array' THEN
    SELECT COUNT(*) INTO v_total
    FROM public.challenge_participants WHERE challenge_id = p_challenge_id;

    FOR v_tier IN SELECT * FROM jsonb_array_elements(v_prizes)
    LOOP
      v_ptype := COALESCE(v_tier->>'positionType', v_tier->>'position_type', 'rank');
      v_start := COALESCE((v_tier->>'start')::NUMERIC, 1);
      v_end   := COALESCE((v_tier->>'end')::NUMERIC, (v_tier->>'range_end')::NUMERIC, v_start);

      IF v_ptype = 'percent' THEN
        v_lo := GREATEST(1, CEIL(v_start / 100.0 * v_total)::INT);
        v_hi := GREATEST(v_lo, CEIL(v_end / 100.0 * v_total)::INT);
      ELSE
        v_lo := GREATEST(1, v_start::INT);
        v_hi := GREATEST(v_lo, v_end::INT);
      END IF;

      FOR v_participant IN
        SELECT user_id FROM public.challenge_participants
        WHERE challenge_id = p_challenge_id AND rank BETWEEN v_lo AND v_hi
      LOOP
        IF jsonb_typeof(v_tier->'rewards') = 'array' THEN
          FOR v_reward IN SELECT * FROM jsonb_array_elements(v_tier->'rewards')
          LOOP
            BEGIN
              PERFORM public.distribute_reward_to_user(v_participant.user_id, v_reward);
            EXCEPTION WHEN OTHERS THEN
              RAISE NOTICE 'Prize distribution failed for user % : %', v_participant.user_id, SQLERRM;
            END;
          END LOOP;
        END IF;
      END LOOP;
    END LOOP;
  END IF;

  UPDATE public.challenges
  SET status = 'finished', prizes_distributed = true
  WHERE id = p_challenge_id;
END;
$$;


--
-- Name: finalize_challenge(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_challenge(p_challenge_id uuid) RETURNS TABLE(out_success boolean, out_message text, out_total_participants integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_participant_count INTEGER;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can finalize challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT, 0;
    RETURN;
  END IF;

  -- Count participants
  SELECT COUNT(*) INTO v_participant_count
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id;

  -- Update challenge status to finished
  UPDATE public.challenges
  SET status = 'finished'::public.challenge_status_enum,
      updated_at = NOW()
  WHERE id = p_challenge_id;

  RETURN QUERY SELECT TRUE, 'Challenge finalized'::TEXT, v_participant_count;
END;
$$;


--
-- Name: FUNCTION finalize_challenge(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.finalize_challenge(p_challenge_id uuid) IS 'Admin function to mark a challenge as finished';


--
-- Name: finalize_due_challenges(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.finalize_due_challenges() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID;
  v_count INTEGER := 0;
BEGIN
  FOR v_id IN
    SELECT id FROM public.challenges
    WHERE status <> 'finished'
      AND end_date IS NOT NULL
      AND now() >= end_date
  LOOP
    PERFORM public.finalize_betting_challenge(v_id);  -- generic: ranks + prizes + status
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;


--
-- Name: force_resync_odds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.force_resync_odds() RETURNS TABLE(synced_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION force_resync_odds(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.force_resync_odds() IS 'Force une re-synchronisation complète de toutes les odds (ATTENTION: supprime et recrée)';


--
-- Name: freeze_params(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.freeze_params(p_user uuid, p_base_every integer, p_base_max integer) RETURNS TABLE(free_every integer, free_max integer)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT
    CASE WHEN s.sub THEN public.premium_cfg_int('freeze_every_days', 3) ELSE p_base_every END,
    CASE WHEN s.sub THEN public.premium_cfg_int('freeze_max', 6)        ELSE p_base_max   END
  FROM (SELECT COALESCE((SELECT is_subscriber FROM public.profiles WHERE id = p_user), false) AS sub) s;
$$;


--
-- Name: funzone_generate_horizon(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.funzone_generate_horizon() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_base text := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/';
  v_hdr  jsonb := jsonb_build_object(
    'Content-Type', 'application/json',
    'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ');
  v_date text := (CURRENT_DATE + 30)::text;   -- generate the day that will be "today" in 30 days
  v_lvl  text;
  v_ho   int;
BEGIN
  -- Football Connections (single 'daily' level)
  PERFORM net.http_post(url := v_base || 'generate-connections', headers := v_hdr,
    body := jsonb_build_object('count', 1, 'start_date', v_date));

  -- Box2Box grid + Rapid Fire (easy / medium / hard)
  FOREACH v_lvl IN ARRAY ARRAY['easy','medium','hard'] LOOP
    PERFORM net.http_post(url := v_base || 'generate-grid', headers := v_hdr,
      body := jsonb_build_object('count', 1, 'start_date', v_date, 'level', v_lvl));
    PERFORM net.http_post(url := v_base || 'generate-rapid', headers := v_hdr,
      body := jsonb_build_object('count', 1, 'start_date', v_date, 'level', v_lvl));
  END LOOP;

  -- Guess the Lineup (scope 'big' only — 'all' has no source data; holes 1 = no-prefs
  -- default, 3/6/11 = the difficulties offered in the picker)
  FOREACH v_ho IN ARRAY ARRAY[1, 3, 6, 11] LOOP
    PERFORM net.http_post(url := v_base || 'generate-lineup-puzzle', headers := v_hdr,
      body := jsonb_build_object('scope', 'big', 'holes', v_ho, 'count', 1, 'start_date', v_date, 'rounds', 5));
  END LOOP;
END;
$$;


--
-- Name: gb_distribute_rewards(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.gb_distribute_rewards(p_type text, p_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rewards JSONB;
  v_done    BOOLEAN;
  v_total   INT;
  v_tier    JSONB;
  v_reward  JSONB;
  v_ptype   TEXT; v_start NUMERIC; v_end NUMERIC; v_lo INT; v_hi INT;
  v_user    UUID;
  v_granted INT := 0;
BEGIN
  -- 1) Resolve rewards + the already-distributed flag.
  IF p_type = 'tq' THEN
    SELECT rewards_json, rewards_distributed INTO v_rewards, v_done FROM public.tq_competitions WHERE id = p_id;
  ELSIF p_type IN ('betting','prediction') THEN
    SELECT prizes, prizes_distributed INTO v_rewards, v_done FROM public.challenges WHERE id = p_id;
  ELSIF p_type = 'fantasy' THEN
    SELECT prizes, rewards_distributed INTO v_rewards, v_done FROM public.fantasy_games WHERE id = p_id;
  ELSE
    RETURN jsonb_build_object('ok', false, 'error', 'unknown game type');
  END IF;

  IF v_done THEN RETURN jsonb_build_object('ok', true, 'skipped', 'already distributed'); END IF;
  IF v_rewards IS NULL OR jsonb_typeof(v_rewards) <> 'array' OR jsonb_array_length(v_rewards) = 0 THEN
    RETURN jsonb_build_object('ok', false, 'error', 'no reward pack assigned');
  END IF;

  -- 2) Build the ranked winner set into a temp table (user_id, rank).
  CREATE TEMP TABLE _ranked (user_id UUID, rank INT) ON COMMIT DROP;
  IF p_type = 'tq' THEN
    INSERT INTO _ranked SELECT user_id, rank FROM public.tq_leaderboard WHERE competition_id = p_id AND rank IS NOT NULL;
  ELSIF p_type IN ('betting','prediction') THEN
    INSERT INTO _ranked SELECT user_id, rank FROM public.challenge_participants WHERE challenge_id = p_id AND rank IS NOT NULL;
  ELSE -- fantasy: aggregate points across the game's gameweeks
    INSERT INTO _ranked
      SELECT user_id, RANK() OVER (ORDER BY SUM(total_points) DESC)::INT
      FROM public.fantasy_leaderboard WHERE game_id = p_id GROUP BY user_id;
  END IF;
  SELECT count(*) INTO v_total FROM _ranked;
  IF v_total = 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no ranked players'); END IF;

  -- 3) Apply each bracket → winners → grant each reward.
  FOR v_tier IN SELECT * FROM jsonb_array_elements(v_rewards) LOOP
    v_ptype := COALESCE(v_tier->>'positionType', 'rank');
    v_start := COALESCE((v_tier->>'start')::NUMERIC, 1);
    v_end   := COALESCE((v_tier->>'end')::NUMERIC, v_start);
    IF v_ptype = 'participation' THEN
      v_lo := 1; v_hi := v_total;
    ELSIF v_ptype = 'percent' THEN
      v_lo := GREATEST(1, CEIL(v_start / 100.0 * v_total)::INT);
      v_hi := GREATEST(v_lo, CEIL(v_end / 100.0 * v_total)::INT);
    ELSE -- rank | range
      v_lo := GREATEST(1, v_start::INT);
      v_hi := GREATEST(v_lo, v_end::INT);
    END IF;

    FOR v_user IN SELECT user_id FROM _ranked WHERE rank BETWEEN v_lo AND v_hi LOOP
      IF jsonb_typeof(v_tier->'rewards') = 'array' THEN
        FOR v_reward IN SELECT * FROM jsonb_array_elements(v_tier->'rewards') LOOP
          BEGIN
            PERFORM public.distribute_reward_to_user(v_user, v_reward, p_type, p_id);
            v_granted := v_granted + 1;
          EXCEPTION WHEN OTHERS THEN
            RAISE NOTICE 'grant failed for % : %', v_user, SQLERRM;
          END;
        END LOOP;
      END IF;
    END LOOP;
  END LOOP;

  -- 4) Mark distributed.
  IF p_type = 'tq' THEN
    UPDATE public.tq_competitions SET rewards_distributed = true, status = 'resolved' WHERE id = p_id;
  ELSIF p_type IN ('betting','prediction') THEN
    UPDATE public.challenges SET prizes_distributed = true, status = 'finished' WHERE id = p_id;
  ELSE
    UPDATE public.fantasy_games SET rewards_distributed = true, status = 'Finished' WHERE id = p_id;
  END IF;

  RETURN jsonb_build_object('ok', true, 'players', v_total, 'grants', v_granted);
END;
$$;


--
-- Name: generate_friend_code(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_friend_code() RETURNS character varying
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  chars VARCHAR(36) := 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  result VARCHAR(10) := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * 36 + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$;


--
-- Name: generate_guest_username(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_guest_username() RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  adjectives TEXT[] := ARRAY['Amateur', 'Hobbyist', 'Recruit', 'FreeAgent', 'DraftPick'];
  candidate TEXT;
  tries INTEGER := 0;
BEGIN
  LOOP
    candidate :=
      adjectives[1 + floor(random() * array_length(adjectives, 1))::INT]
      || lpad((floor(random() * 9000) + 1000)::TEXT, 4, '0');

    EXIT WHEN NOT EXISTS (
      SELECT 1 FROM public.users WHERE username = candidate
    ) OR tries > 10;

    tries := tries + 1;
  END LOOP;

  IF candidate IS NULL THEN
    candidate := 'Recruit' || floor(extract(epoch FROM now()));
  END IF;

  RETURN candidate;
END;
$$;


--
-- Name: generate_random_string(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_random_string(length integer) RETURNS text
    LANGUAGE plpgsql
    SET search_path TO 'public'
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


--
-- Name: get_available_bookmakers(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_bookmakers() RETURNS TABLE(bookmaker_name text, odds_count bigint, last_update timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION get_available_bookmakers(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_available_bookmakers() IS 'Retourne la liste des bookmakers disponibles avec statistiques';


--
-- Name: get_available_fantasy_players(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_available_fantasy_players(p_game_week_id uuid DEFAULT NULL::uuid) RETURNS TABLE(id uuid, api_player_id integer, name text, photo text, "position" text, eligible_positions text[], status text, fatigue integer, team_name text, team_logo text, birthdate date, pgs numeric)
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH lg AS (
    SELECT COALESCE(
      (SELECT fg.league_id FROM public.fantasy_game_weeks gw
         JOIN public.fantasy_games fg ON fg.id = gw.fantasy_game_id WHERE gw.id = p_game_week_id),
      (SELECT flp2.league_id FROM public.fantasy_league_players flp2
        GROUP BY flp2.league_id ORDER BY count(*) DESC LIMIT 1)
    ) AS league_id
  ),
  pos_counts AS (
    SELECT pms.player_id,
      CASE upper(pms.position)
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' WHEN 'F' THEN 'Attacker' END AS pos_full,
      count(*) AS cnt
    FROM public.player_match_stats pms
    WHERE upper(pms.position) IN ('G', 'D', 'M', 'F')
      AND COALESCE(pms.minutes_played, 0) > 0
    GROUP BY pms.player_id, 2
  ),
  pos_total AS (
    SELECT player_id, sum(cnt) AS total,
           (array_agg(pos_full ORDER BY cnt DESC))[1] AS primary_pos
    FROM pos_counts GROUP BY player_id
  ),
  pos_final AS (
    SELECT pt.player_id, pt.primary_pos,
      (SELECT array_agg(pc.pos_full ORDER BY pc.cnt DESC)
         FROM pos_counts pc
        WHERE pc.player_id = pt.player_id
          AND pc.cnt >= GREATEST(2, ceil(0.20 * pt.total))
          AND pc.pos_full = ANY(
            CASE pt.primary_pos
              WHEN 'Goalkeeper' THEN ARRAY['Goalkeeper']
              WHEN 'Defender'   THEN ARRAY['Defender', 'Midfielder']
              WHEN 'Midfielder' THEN ARRAY['Defender', 'Midfielder', 'Attacker']
              WHEN 'Attacker'   THEN ARRAY['Midfielder', 'Attacker']
              ELSE ARRAY[pt.primary_pos]
            END
          )) AS eligible
    FROM pos_total pt
  )
  SELECT
    p.id, p.api_id,
    NULLIF(trim(COALESCE(p.first_name, '') || ' ' || COALESCE(p.last_name, '')), ''),
    p.photo_url,
    COALESCE(pf.primary_pos,
      CASE upper(substr(COALESCE(p."position", 'M'), 1, 1))
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' ELSE 'Attacker' END) AS position,
    COALESCE(pf.eligible, ARRAY[
      CASE upper(substr(COALESCE(p."position", 'M'), 1, 1))
        WHEN 'G' THEN 'Goalkeeper' WHEN 'D' THEN 'Defender'
        WHEN 'M' THEN 'Midfielder' ELSE 'Attacker' END]) AS eligible_positions,
    flp.status, 100, tm.name, tm.logo_url, p.birthdate, flp.pgs
  FROM public.fantasy_league_players flp
  JOIN public.players p ON p.id = flp.player_id
  CROSS JOIN lg
  LEFT JOIN pos_final pf ON pf.player_id = p.id
  LEFT JOIN LATERAL (
    SELECT t.name, t.logo_url
    FROM public.player_match_stats pms
    JOIN public.fb_teams t ON t.id = pms.team_id
    WHERE pms.player_id = p.id
    GROUP BY t.name, t.logo_url ORDER BY count(*) DESC LIMIT 1
  ) tm ON true
  WHERE flp.league_id = lg.league_id
    AND COALESCE(flp.is_available, true) = true
  ORDER BY flp.pgs DESC NULLS LAST;
$$;


--
-- Name: get_coin_balance(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_coin_balance(p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT coins_balance INTO v_balance
  FROM public.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_balance, 0);
END;
$$;


--
-- Name: get_fantasy_gameweek_player_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fantasy_gameweek_player_stats(p_game_week_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_league UUID;
  v_start TIMESTAMPTZ;
  v_end TIMESTAMPTZ;
  v_result JSONB;
BEGIN
  SELECT fg.league_id, gw.start_date, gw.end_date
    INTO v_league, v_start, v_end
  FROM public.fantasy_game_weeks gw
  JOIN public.fantasy_games fg ON fg.id = gw.fantasy_game_id
  WHERE gw.id = p_game_week_id;

  IF v_league IS NULL THEN RETURN '{}'::jsonb; END IF;

  SELECT jsonb_object_agg(player_id, stats) INTO v_result FROM (
    SELECT DISTINCT ON (pms.player_id)
      pms.player_id,
      jsonb_build_object(
        'minutes_played', COALESCE(pms.minutes_played, 0),
        'goals', COALESCE(pms.goals, 0),
        'assists', COALESCE(pms.assists, 0),
        'clean_sheet', COALESCE(pms.clean_sheet, false),
        'shots_on_target', COALESCE(pms.shots_on_target, 0),
        'saves', COALESCE(pms.saves, 0),
        'penalties_scored', 0,
        'penalties_missed', COALESCE(pms.penalties_missed, 0),
        'yellow_cards', CASE WHEN pms.yellow_card THEN 1 ELSE 0 END,
        'red_cards', CASE WHEN pms.red_card THEN 1 ELSE 0 END,
        'goals_conceded', COALESCE(pms.goals_conceded, 0),
        'interceptions', COALESCE(pms.interceptions, 0),
        'tackles', COALESCE(pms.tackles_total, 0),
        'duels_won', COALESCE(pms.duels_won, 0),
        'duels_lost', GREATEST(0, COALESCE(pms.duels_total, 0) - COALESCE(pms.duels_won, 0)),
        'dribbles_succeeded', COALESCE(pms.dribbles_success, 0),
        'fouls_committed', COALESCE(pms.fouls_committed, 0),
        'fouls_suffered', COALESCE(pms.fouls_drawn, 0),
        'penalties_saved', COALESCE(pms.penalties_saved, 0),
        'rating', COALESCE(pms.rating, 0)
      ) AS stats
    FROM public.player_match_stats pms
    JOIN public.fixtures f ON f.id = pms.fixture_id
    WHERE f.league_id = v_league
      AND f.date >= v_start AND f.date <= v_end
    ORDER BY pms.player_id, f.date DESC
  ) s;

  RETURN COALESCE(v_result, '{}'::jsonb);
END;
$$;


--
-- Name: get_fantasy_player_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_fantasy_player_stats(p_player_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH recent AS (
    SELECT pms.minutes_played, pms.rating, pms.position, pms.goals, pms.assists,
           pms.clean_sheet, pms.tackles_total, pms.passes_key, pms.dribbles_success,
           pms.shots_on_target, pms.yellow_card, pms.red_card, f.date AS fixture_date
    FROM public.player_match_stats pms
    JOIN public.fixtures f ON f.id = pms.fixture_id
    WHERE pms.player_id = p_player_id
    ORDER BY f.date DESC
    LIMIT 10
  )
  SELECT jsonb_build_object(
    'recent', COALESCE((
      SELECT jsonb_agg(jsonb_build_object(
        'date', fixture_date, 'rating', rating,
        'position', CASE upper(position)
          WHEN 'G' THEN 'GK' WHEN 'D' THEN 'DEF' WHEN 'M' THEN 'MID' WHEN 'F' THEN 'ATT' ELSE position END,
        'goals', goals, 'assists', assists, 'minutes', minutes_played
      ) ORDER BY fixture_date DESC) FROM recent), '[]'::jsonb),
    'totals', (SELECT jsonb_build_object(
        'matches', count(*),
        'minutes', COALESCE(sum(minutes_played), 0),
        'goals', COALESCE(sum(goals), 0),
        'assists', COALESCE(sum(assists), 0),
        'clean_sheets', COALESCE(sum(CASE WHEN clean_sheet THEN 1 ELSE 0 END), 0),
        'tackles', COALESCE(sum(tackles_total), 0),
        'key_passes', COALESCE(sum(passes_key), 0),
        'dribbles', COALESCE(sum(dribbles_success), 0),
        'shots_on_target', COALESCE(sum(shots_on_target), 0),
        'yellow', COALESCE(sum(CASE WHEN yellow_card THEN 1 ELSE 0 END), 0),
        'red', COALESCE(sum(CASE WHEN red_card THEN 1 ELSE 0 END), 0),
        'avg_rating', ROUND(AVG(NULLIF(rating, 0))::numeric, 2)
      ) FROM recent)
  );
$$;


--
-- Name: get_level_by_xp(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_level_by_xp(p_xp_total integer) RETURNS TABLE(level integer, name text, xp_required integer)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT lc.level, lc.name, lc.xp_required
  FROM public.levels_config lc
  WHERE lc.xp_required <= p_xp_total
  ORDER BY lc.xp_required DESC
  LIMIT 1;
END;
$$;


--
-- Name: FUNCTION get_level_by_xp(p_xp_total integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_level_by_xp(p_xp_total integer) IS 'Helper function to determine user level based on XP total';


--
-- Name: get_live_game_state(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_live_game_state(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_game JSONB;
  v_entries JSONB;
BEGIN
  SELECT jsonb_build_object(
    'id', lg.id,
    'mode', lg.mode,
    'status', lg.status,
    'entry_cost', lg.entry_cost,
    'fixture', jsonb_build_object(
      'id', f.id,
      'date', f.date,
      'status', f.status,
      'goals_home', f.goals_home,
      'goals_away', f.goals_away,
      'home', jsonb_build_object('name', ht.name, 'logo', ht.logo_url),
      'away', jsonb_build_object('name', at.name, 'logo', at.logo_url)
    )
  )
  INTO v_game
  FROM public.live_games lg
  JOIN public.fb_fixtures f ON f.id = lg.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
  WHERE lg.id = p_game_id;

  IF v_game IS NULL THEN RETURN NULL; END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id,
    'user_id', e.user_id,
    'predicted_score', e.predicted_score,
    'bonus_questions', e.bonus_questions,
    'bonus_answers', e.bonus_answers,
    'midtime_edit', e.midtime_edit,
    'total_points', e.total_points,
    'goal_diff_error', e.goal_diff_error,
    'rank', e.rank,
    'submitted_at', e.submitted_at,
    'username', COALESCE(p.display_name, p.username),
    'is_subscriber', COALESCE(p.is_subscriber, false)
  ) ORDER BY e.total_points DESC NULLS LAST, e.goal_diff_error ASC NULLS LAST), '[]'::jsonb)
  INTO v_entries
  FROM public.live_game_entries e
  LEFT JOIN public.profiles p ON p.id = e.user_id
  WHERE e.live_game_id = p_game_id;

  RETURN jsonb_build_object('game', v_game, 'entries', v_entries);
END;
$$;


--
-- Name: get_matches(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_matches(p_date text DEFAULT NULL::text) RETURNS TABLE(id bigint, kickoff_at timestamp with time zone, status text, home_goals integer, away_goals integer, has_lineup boolean, league_name text, league_logo text, home_team_name text, home_team_logo text, away_team_name text, away_team_logo text, home_win double precision, draw double precision, away_win double precision)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
begin
    return query
    select
        f.id,
        f.date as kickoff_at,
        f.status,
        f.goals_home as home_goals,
        f.goals_away as away_goals,
        f.has_lineup,
        l.name as league_name,
        l.logo as league_logo,
        ht.name as home_team_name,
        ht.logo as home_team_logo,
        at.name as away_team_name,
        at.logo as away_team_logo,
        o.home_win,
        o.draw,
        o.away_win
    from
        football.fixtures f
    left join
        football.leagues l on f.league_id = l.id
    left join
        football.teams ht on f.home_team_id = ht.id
    left join
        football.teams at on f.away_team_id = at.id
    left join
        football.odds o on f.id = o.fixture_id
    where
        (p_date is null or f.date::date = p_date::date);
end;
$$;


--
-- Name: get_notification_preferences(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_notification_preferences(p_user_id uuid) RETURNS TABLE(gameplay_enabled boolean, league_enabled boolean, squad_enabled boolean, premium_enabled boolean, reminder_enabled boolean, system_enabled boolean, push_enabled boolean, in_app_enabled boolean, email_enabled boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    np.gameplay_enabled,
    np.league_enabled,
    np.squad_enabled,
    np.premium_enabled,
    np.reminder_enabled,
    np.system_enabled,
    np.push_enabled,
    np.in_app_enabled,
    np.email_enabled
  FROM public.notification_preferences np
  WHERE np.user_id = p_user_id;
END;
$$;


--
-- Name: FUNCTION get_notification_preferences(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_notification_preferences(p_user_id uuid) IS 'Retrieves notification preferences for a specific user.';


--
-- Name: get_or_create_matchday_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_or_create_matchday_participant(p_matchday_id uuid, p_user_id uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_participant_id UUID;
BEGIN
    -- Try to get existing participant
    SELECT id INTO v_participant_id
    FROM public.matchday_participants
    WHERE matchday_id = p_matchday_id AND user_id = p_user_id;

    -- If not found, create it
    IF v_participant_id IS NULL THEN
        INSERT INTO public.matchday_participants (matchday_id, user_id)
        VALUES (p_matchday_id, p_user_id)
        RETURNING id INTO v_participant_id;
    END IF;

    RETURN v_participant_id;
END;
$$;


--
-- Name: get_pgs_category(numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_pgs_category(p_pgs numeric) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_pgs >= 6.0 THEN
    RETURN 'star';
  ELSIF p_pgs >= 4.5 THEN
    RETURN 'key';
  ELSE
    RETURN 'wild';
  END IF;
END;
$$;


--
-- Name: get_player_transfer_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_player_transfer_history(p_player_id uuid, p_season integer) RETURNS TABLE(team_id uuid, team_name text, goals integer, assists integer, appearances integer, minutes_played integer, rating numeric, pgs numeric, pgs_category text)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    pss.team_id,
    t.name as team_name,
    pss.goals,
    pss.assists,
    pss.appearances,
    pss.minutes_played,
    pss.rating,
    pss.pgs,
    pss.pgs_category
  FROM player_season_stats pss
  JOIN teams t ON t.id = pss.team_id
  WHERE pss.player_id = p_player_id
    AND pss.season = p_season
  ORDER BY pss.updated_at ASC;
END;
$$;


--
-- Name: get_prediction_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_prediction_stats(p_user_id uuid DEFAULT NULL::uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user UUID := COALESCE(p_user_id, auth.uid());
  v_total INT; v_correct INT;
  v_l30_total INT; v_l30_correct INT;
  v_streak INT;
  v_by JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;

  -- Overall (settled predictions only)
  SELECT count(*) FILTER (WHERE is_correct IS NOT NULL),
         count(*) FILTER (WHERE is_correct)
    INTO v_total, v_correct
  FROM public.swipe_predictions WHERE user_id = v_user;

  -- Last 30 days
  SELECT count(*) FILTER (WHERE is_correct IS NOT NULL),
         count(*) FILTER (WHERE is_correct)
    INTO v_l30_total, v_l30_correct
  FROM public.swipe_predictions
  WHERE user_id = v_user AND created_at >= now() - interval '30 days';

  -- By pick type
  SELECT jsonb_object_agg(prediction, jsonb_build_object('total', t, 'correct', c))
    INTO v_by
  FROM (
    SELECT prediction,
           count(*) FILTER (WHERE is_correct IS NOT NULL) AS t,
           count(*) FILTER (WHERE is_correct) AS c
    FROM public.swipe_predictions
    WHERE user_id = v_user
    GROUP BY prediction
  ) s;

  -- Current streak = consecutive correct from the most recent settled predictions.
  SELECT count(*) INTO v_streak FROM (
    SELECT sum(CASE WHEN is_correct THEN 0 ELSE 1 END)
             OVER (ORDER BY created_at DESC) AS grp
    FROM public.swipe_predictions
    WHERE user_id = v_user AND is_correct IS NOT NULL
  ) q WHERE grp = 0;

  RETURN jsonb_build_object(
    'ok', true,
    'total', COALESCE(v_total, 0),
    'correct', COALESCE(v_correct, 0),
    'accuracy_pct', CASE WHEN COALESCE(v_total, 0) > 0 THEN round(100.0 * v_correct / v_total) ELSE 0 END,
    'by_type', COALESCE(v_by, '{}'::jsonb),
    'last30', jsonb_build_object(
      'total', COALESCE(v_l30_total, 0),
      'correct', COALESCE(v_l30_correct, 0),
      'accuracy_pct', CASE WHEN COALESCE(v_l30_total, 0) > 0 THEN round(100.0 * v_l30_correct / v_l30_total) ELSE 0 END),
    'current_streak', COALESCE(v_streak, 0)
  );
END $$;


--
-- Name: get_recent_fixture_changes(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_recent_fixture_changes(p_days_back integer DEFAULT 7) RETURNS TABLE(sync_date timestamp with time zone, sync_type text, fixture_id text, old_date text, new_date text, home_team text, away_team text, league text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    l.created_at as sync_date,
    l.sync_type,
    (change->>'fixture_id')::TEXT,
    (change->>'old_date')::TEXT,
    (change->>'new_date')::TEXT,
    (change->>'home_team')::TEXT,
    (change->>'away_team')::TEXT,
    (change->>'league')::TEXT
  FROM public.fixture_sync_log l,
       jsonb_array_elements(COALESCE(l.schedule_changes, '[]'::jsonb)) AS change
  WHERE l.created_at >= NOW() - (p_days_back || ' days')::INTERVAL
  ORDER BY l.created_at DESC;
END;
$$;


--
-- Name: FUNCTION get_recent_fixture_changes(p_days_back integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_recent_fixture_changes(p_days_back integer) IS 'Récupère tous les changements de calendrier des N derniers jours';


--
-- Name: get_spin_history(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_spin_history(p_user_id uuid, p_limit integer DEFAULT 10) RETURNS TABLE(id uuid, tier public.spin_tier, reward_id text, reward_label text, reward_category text, reward_value text, was_pity boolean, final_chances jsonb, created_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    sh.id,
    sh.tier,
    sh.reward_id,
    sh.reward_label,
    sh.reward_category,
    sh.reward_value,
    sh.was_pity,
    sh.final_chances,
    sh.created_at
  FROM public.spin_history sh
  WHERE sh.user_id = p_user_id
  ORDER BY sh.created_at DESC
  LIMIT p_limit;
END;
$$;


--
-- Name: FUNCTION get_spin_history(p_user_id uuid, p_limit integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_spin_history(p_user_id uuid, p_limit integer) IS 'Retrieves spin history for a user with limit';


--
-- Name: get_squad_live_games(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_squad_live_games(p_squad_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', lg.id,
    'status', lg.status,
    'home_team', COALESCE(ht.name, 'TBD'),
    'away_team', COALESCE(at.name, 'TBD'),
    'players', COALESCE(pc.cnt, 0)
  ) ORDER BY lg.created_at DESC), '[]'::jsonb)
  FROM public.squad_games sg
  JOIN public.live_games lg ON lg.id = sg.game_id
  LEFT JOIN public.fb_fixtures f ON f.id = lg.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
  LEFT JOIN (
    SELECT live_game_id, count(*) AS cnt FROM public.live_game_entries GROUP BY live_game_id
  ) pc ON pc.live_game_id = lg.id
  WHERE sg.squad_id = p_squad_id AND sg.game_type = 'live';
$$;


--
-- Name: get_ticket_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ticket_counts(p_user_id uuid) RETURNS TABLE(ticket_type public.ticket_type, count bigint)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.ticket_type,
    COUNT(*) as count
  FROM public.user_tickets t
  WHERE t.user_id = p_user_id
    AND t.is_used = false
    AND t.expires_at > now()
  GROUP BY t.ticket_type;
END;
$$;


--
-- Name: get_ticket_rules(public.ticket_type); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_ticket_rules(p_ticket_type public.ticket_type) RETURNS TABLE(tier public.ticket_type, expiry_days integer, max_quantity integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    p_ticket_type as tier,
    CASE p_ticket_type
      WHEN 'amateur' THEN 30
      WHEN 'master' THEN 45
      WHEN 'apex' THEN 60
    END as expiry_days,
    CASE p_ticket_type
      WHEN 'amateur' THEN 5
      WHEN 'master' THEN 3
      WHEN 'apex' THEN 2
    END as max_quantity;
END;
$$;


--
-- Name: get_top_players_by_pgs(integer, uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_top_players_by_pgs(p_season integer, p_league_id uuid DEFAULT NULL::uuid, p_limit integer DEFAULT 10) RETURNS TABLE(player_id uuid, player_name text, team_name text, goals integer, assists integer, appearances integer, rating numeric, pgs numeric, pgs_category text, impact_score numeric, consistency_score numeric, is_transferred boolean, teams_count integer)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    psc.player_id,
    p.first_name || ' ' || p.last_name as player_name,
    t.name as team_name,
    psc.goals,
    psc.assists,
    psc.appearances,
    psc.rating,
    psc.pgs,
    psc.pgs_category,
    psc.impact_score,
    psc.consistency_score,
    psc.is_transferred,
    psc.teams_count
  FROM player_season_stats_combined psc
  JOIN players p ON p.id = psc.player_id
  JOIN teams t ON t.id = psc.team_id
  WHERE psc.season = p_season
    AND (p_league_id IS NULL OR psc.league_id = p_league_id)
  ORDER BY psc.pgs DESC NULLS LAST
  LIMIT p_limit;
END;
$$;


--
-- Name: get_user_fantasy_team_with_players(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_fantasy_team_with_players(p_user_id uuid, p_game_week_id uuid) RETURNS TABLE(team_id uuid, game_id uuid, starters jsonb, substitutes jsonb, captain jsonb, booster_used integer, total_points numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    uft.id as team_id, uft.game_id,
    (SELECT jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status", 'fatigue', fp.fatigue, 'team_name', fp.team_name, 'team_logo', fp.team_logo, 'pgs', fp.pgs))
     FROM fantasy_players fp WHERE fp.id = ANY(uft.starters)) as starters,
    (SELECT jsonb_agg(jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status", 'fatigue', fp.fatigue, 'team_name', fp.team_name, 'team_logo', fp.team_logo, 'pgs', fp.pgs))
     FROM fantasy_players fp WHERE fp.id = ANY(uft.substitutes)) as substitutes,
    (SELECT jsonb_build_object('id', fp.id, 'name', fp.name, 'photo', fp.photo, 'position', fp."position", 'status', fp."status")
     FROM fantasy_players fp WHERE fp.id = uft.captain_id) as captain,
    uft.booster_used,
    uft.total_points
  FROM user_fantasy_teams uft
  WHERE uft.user_id = p_user_id AND uft.game_week_id = p_game_week_id;
END;
$$;


--
-- Name: get_user_leagues(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_leagues() RETURNS SETOF uuid
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select league_id from league_members where user_id = auth.uid();
$$;


--
-- Name: get_user_live_game_limits(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_live_game_limits(p_user_id uuid) RETURNS TABLE(slots_used integer, slots_max integer, entry_max integer, level_name text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    (SELECT COUNT(*)::INTEGER FROM live_game_entries lge
     JOIN live_games lg ON lge.live_game_id = lg.id
     WHERE lge.user_id = p_user_id AND lg.status = 'live') as slots_used,
    5 as slots_max,
    10000 as entry_max,
    'default'::TEXT as level_name;
END;
$$;


--
-- Name: get_user_live_games(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_live_games(p_user_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_result JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT COALESCE(jsonb_agg(g ORDER BY (g->'fixture'->>'date')), '[]'::jsonb) INTO v_result
  FROM (
    SELECT jsonb_build_object(
      'id', lg.id,
      'mode', lg.mode,
      'status', lg.status,
      'fixture_id', lg.fixture_id,
      'predicted_score', e.predicted_score,
      'total_points', e.total_points,
      'fixture', jsonb_build_object(
        'date', f.date,
        'status', f.status,
        'goals_home', f.goals_home,
        'goals_away', f.goals_away,
        'home', jsonb_build_object('name', ht.name, 'logo', ht.logo_url),
        'away', jsonb_build_object('name', at.name, 'logo', at.logo_url)
      )
    ) AS g
    FROM public.live_game_entries e
    JOIN public.live_games lg ON lg.id = e.live_game_id
    JOIN public.fb_fixtures f ON f.id = lg.fixture_id
    LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
    LEFT JOIN public.fb_teams at ON at.id = f.away_team_id
    WHERE e.user_id = p_user_id AND lg.status IN ('upcoming', 'live')
  ) s;

  RETURN v_result;
END;
$$;


--
-- Name: get_user_profile_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_profile_stats(p_user_id uuid) RETURNS TABLE(username text, predictions_total bigint, predictions_correct bigint, hot_performance_index numeric, best_hpi numeric, best_hpi_date date, streak bigint, average_bet_coins numeric, risk_index numeric, games_played bigint, gold_podiums bigint, silver_podiums bigint, bronze_podiums bigint, trophies bigint, badge_count bigint, badge_names text[], most_played_league text, most_played_team text, favorite_game_type text, last_10_days_accuracy numeric)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    ups.username,
    ups.predictions_total,
    ups.predictions_correct,
    ups.hot_performance_index,
    ups.best_hpi,
    ups.best_hpi_date,
    ups.streak,
    ups.average_bet_coins,
    ups.risk_index,
    ups.games_played,
    ups.gold_podiums,
    ups.silver_podiums,
    ups.bronze_podiums,
    ups.trophies,
    ups.badge_count,
    ups.badge_names,
    ups.most_played_league,
    ups.most_played_team,
    ups.favorite_game_type,
    ups.last_10_days_accuracy
  FROM public.user_profile_stats ups
  WHERE ups.user_id = p_user_id;
END;
$$;


--
-- Name: get_user_progression_summary(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_progression_summary(p_user_id uuid) RETURNS TABLE(xp_total integer, current_level integer, level_name text, xp_to_next_level integer, progress_percentage numeric, goat_bonus_active boolean, weeks_inactive integer, will_decay boolean)
    LANGUAGE plpgsql STABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user RECORD;
  v_next_level_xp INT;
  v_current_level_xp INT;
  v_weeks_inactive INT := 0;
BEGIN
  -- Get user data
  SELECT u.xp_total, u.current_level, u.level_name, u.goat_bonus_active, u.last_active_date
  INTO v_user
  FROM public.users u
  WHERE u.id = p_user_id;

  -- Calculate weeks inactive
  IF v_user.last_active_date IS NOT NULL THEN
    v_weeks_inactive := FLOOR(EXTRACT(EPOCH FROM (NOW() - v_user.last_active_date)) / 604800)::INT;
  END IF;

  -- Get current level threshold
  SELECT xp_required INTO v_current_level_xp
  FROM public.levels_config
  WHERE level = v_user.current_level;

  -- Get next level threshold
  SELECT xp_required INTO v_next_level_xp
  FROM public.levels_config
  WHERE level = v_user.current_level + 1;

  -- If already at max level (GOAT), next level is same
  IF v_next_level_xp IS NULL THEN
    v_next_level_xp := v_current_level_xp;
  END IF;

  RETURN QUERY SELECT
    v_user.xp_total,
    v_user.current_level,
    v_user.level_name,
    GREATEST(v_next_level_xp - v_user.xp_total, 0)::INT AS xp_to_next_level,
    CASE
      WHEN v_next_level_xp = v_current_level_xp THEN 100.0 -- Already max level
      ELSE ((v_user.xp_total - v_current_level_xp)::NUMERIC / (v_next_level_xp - v_current_level_xp) * 100)
    END AS progress_percentage,
    v_user.goat_bonus_active,
    v_weeks_inactive,
    (v_weeks_inactive >= 2 AND v_user.current_level < 6) AS will_decay;
END;
$$;


--
-- Name: FUNCTION get_user_progression_summary(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.get_user_progression_summary(p_user_id uuid) IS 'Returns complete progression status for a user including decay warnings';


--
-- Name: get_user_role(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_role() RETURNS text
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN (
    SELECT role FROM public.users
    WHERE id = auth.uid()
  );
END;
$$;


--
-- Name: get_user_spin_state(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_spin_state(p_user_id uuid) RETURNS TABLE(out_user_id uuid, out_pity_counter integer, out_adaptive_multipliers jsonb, out_available_spins jsonb, out_last_free_spin_at timestamp with time zone, out_free_spin_streak integer, out_updated_at timestamp with time zone)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN QUERY
  SELECT
    uss.user_id,
    uss.pity_counter,
    uss.adaptive_multipliers,
    uss.available_spins,
    uss.last_free_spin_at,
    uss.free_spin_streak,
    uss.updated_at
  FROM public.user_spin_states uss
  WHERE uss.user_id = p_user_id;
END;
$$;


--
-- Name: get_user_squad_ids(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_squad_ids(p_user_id uuid) RETURNS SETOF uuid
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT squad_id FROM public.squad_members WHERE user_id = p_user_id;
$$;


--
-- Name: get_user_tickets(uuid, public.ticket_type, boolean, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_user_tickets(p_user_id uuid, p_ticket_type public.ticket_type DEFAULT NULL::public.ticket_type, p_include_expired boolean DEFAULT false, p_include_used boolean DEFAULT false) RETURNS TABLE(id uuid, ticket_type public.ticket_type, is_used boolean, used_at timestamp with time zone, used_for_challenge_id uuid, expires_at timestamp with time zone, granted_reason text, created_at timestamp with time zone, is_expired boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN QUERY
  SELECT
    t.id,
    t.ticket_type,
    t.is_used,
    t.used_at,
    t.used_for_challenge_id,
    t.expires_at,
    t.granted_reason,
    t.created_at,
    (t.expires_at <= now()) as is_expired
  FROM public.user_tickets t
  WHERE t.user_id = p_user_id
    AND (p_ticket_type IS NULL OR t.ticket_type = p_ticket_type)
    AND (p_include_used OR t.is_used = false)
    AND (p_include_expired OR t.expires_at > now())
  ORDER BY t.created_at DESC;
END;
$$;


--
-- Name: get_week_start(timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.get_week_start(p_date timestamp with time zone DEFAULT now()) RETURNS date
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Get Monday of the week for the given date
  RETURN DATE(date_trunc('week', p_date));
END;
$$;


--
-- Name: grant_spin(uuid, text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_spin(p_user_id uuid, p_tier text, p_quantity integer DEFAULT 1) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_current_spins JSONB;
  v_tier_spins INTEGER;
BEGIN
  -- Validate tier
  IF p_tier NOT IN ('free', 'amateur', 'master', 'apex', 'premium') THEN
    RAISE EXCEPTION 'Invalid spin tier: %. Must be one of: free, amateur, master, apex, premium', p_tier;
  END IF;

  -- Initialize user_spin_states if it doesn't exist
  INSERT INTO public.user_spin_states (user_id, available_spins)
  VALUES (
    p_user_id,
    jsonb_build_object(
      'free', 0,
      'amateur', 0,
      'master', 0,
      'apex', 0,
      'premium', 0
    )
  )
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current available_spins
  SELECT available_spins INTO v_current_spins
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Get current count for this tier
  v_tier_spins := COALESCE((v_current_spins->>p_tier)::INTEGER, 0);

  -- Increment by quantity
  v_tier_spins := v_tier_spins + p_quantity;

  -- Update available_spins with new count
  UPDATE public.user_spin_states
  SET available_spins = jsonb_set(
    available_spins,
    ARRAY[p_tier],
    to_jsonb(v_tier_spins)
  )
  WHERE user_id = p_user_id;

  RETURN TRUE;
END;
$$;


--
-- Name: FUNCTION grant_spin(p_user_id uuid, p_tier text, p_quantity integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.grant_spin(p_user_id uuid, p_tier text, p_quantity integer) IS 'Grants spins to a user for a specific tier. Initializes user_spin_states if needed. Supports tiers: free, amateur, master, apex, premium.';


--
-- Name: grant_ticket(uuid, public.ticket_type, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.grant_ticket(p_user_id uuid, p_ticket_type public.ticket_type, p_granted_reason text DEFAULT 'reward'::text) RETURNS TABLE(ticket_id uuid, success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rules RECORD;
  v_current_count INTEGER;
  v_expiry_date TIMESTAMPTZ;
  v_new_ticket_id UUID;
BEGIN
  -- Get ticket rules
  SELECT * INTO v_rules FROM public.get_ticket_rules(p_ticket_type);

  -- Count current unused, non-expired tickets of this type
  SELECT COUNT(*) INTO v_current_count
  FROM public.user_tickets
  WHERE user_id = p_user_id
    AND ticket_type = p_ticket_type
    AND is_used = false
    AND expires_at > now();

  -- Check if user has reached max quantity
  IF v_current_count >= v_rules.max_quantity THEN
    RETURN QUERY SELECT NULL::UUID, false, format('Maximum %s tickets (%s) already owned', p_ticket_type, v_rules.max_quantity);
    RETURN;
  END IF;

  -- Calculate expiry date
  v_expiry_date := now() + (v_rules.expiry_days || ' days')::INTERVAL;

  -- Insert the new ticket
  INSERT INTO public.user_tickets (user_id, ticket_type, expires_at, granted_reason)
  VALUES (p_user_id, p_ticket_type, v_expiry_date, p_granted_reason)
  RETURNING id INTO v_new_ticket_id;

  -- Log the transaction
  INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type, granted_reason)
  VALUES (p_user_id, v_new_ticket_id, p_ticket_type, 'granted', p_granted_reason);

  -- Return success
  RETURN QUERY SELECT v_new_ticket_id, true, format('%s ticket granted, expires in %s days', p_ticket_type, v_rules.expiry_days);
END;
$$;


--
-- Name: handle_new_league(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_league() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Only create a league member if created_by is provided
  -- This allows API imports to create leagues without a user
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.league_members (league_id, user_id, role)
    VALUES (NEW.id, NEW.created_by, 'admin');
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION handle_new_league(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.handle_new_league() IS 'Automatically adds the league creator as an admin member.
Skips member creation for API imports where created_by is NULL.';


--
-- Name: handle_new_user(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_new_user() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$;


--
-- Name: handle_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.handle_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$;


--
-- Name: initialize_spin_state(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.initialize_spin_state() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  INSERT INTO public.user_spin_states (user_id)
  VALUES (NEW.id)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;


--
-- Name: is_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role IN ('admin', 'super_admin')
  );
END;
$$;


--
-- Name: is_league_member(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_league_member(p_league_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  select exists (
    select 1
    from public.league_members
    where league_id = p_league_id and user_id = p_user_id
  );
$$;


--
-- Name: is_squad_admin(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_squad_admin(p_squad_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.squad_members
    WHERE squad_id = p_squad_id
      AND user_id = p_user_id
      AND role = 'admin'
  );
$$;


--
-- Name: is_super_admin(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.is_super_admin() RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid()
    AND role = 'super_admin'
  );
END;
$$;


--
-- Name: join_betting_challenge(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_betting_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid DEFAULT NULL::uuid) RETURNS TABLE(already_joined boolean, coins_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct_result RECORD;
  v_cfg JSONB;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
  v_resolved_ticket UUID := NULL;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  SELECT c.entry_cost INTO v_entry_cost FROM public.challenges c WHERE c.id = p_challenge_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Challenge not found';
  END IF;

  SELECT cc.config_data INTO v_cfg
  FROM public.challenge_configs cc
  WHERE cc.challenge_id = p_challenge_id
  LIMIT 1;

  v_min_level := COALESCE(v_cfg->>'minimum_level', 'Rookie');
  v_req_badges := COALESCE(v_cfg->'required_badges', '[]'::jsonb);
  v_req_sub := COALESCE((v_cfg->>'requires_subscription')::boolean, false);
  v_tier := lower(COALESCE(v_cfg->>'tier', 'amateur'));

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN
        RAISE EXCEPTION 'missing_badge';
      END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN
          RAISE EXCEPTION 'ticket_expired';
        END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN
          RAISE EXCEPTION 'ticket_wrong_tier';
        END IF;
      ELSE
        -- Auto-pick a valid ticket: tier-specific first, then the universal 'premium' one.
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id
          AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false
          AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST
        LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;

      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      v_resolved_ticket := v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct_result
      FROM public.deduct_coins(
        p_user_id, v_entry_cost, 'challenge_entry',
        jsonb_build_object('challenge_id', p_challenge_id)
      );
      v_balance := v_deduct_result.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_method, v_resolved_ticket)
  ON CONFLICT (challenge_id, user_id) DO UPDATE
  SET entry_method = EXCLUDED.entry_method,
      ticket_id = COALESCE(EXCLUDED.ticket_id, public.challenge_entries.ticket_id),
      updated_at = now();

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$;


--
-- Name: join_fantasy_game(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid DEFAULT NULL::uuid) RETURNS TABLE(already_joined boolean, coins_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_entry_cost INTEGER;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct RECORD;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN RAISE EXCEPTION 'Invalid entry method %', p_method; END IF;

  SELECT COALESCE(fg.entry_cost, 0), COALESCE(fg.minimum_level, 'Rookie'),
         COALESCE(to_jsonb(fg.required_badges), '[]'::jsonb),
         COALESCE(fg.requires_subscription, false), lower(COALESCE(fg.tier, 'amateur'))
    INTO v_entry_cost, v_min_level, v_req_badges, v_req_sub, v_tier
  FROM public.fantasy_games fg WHERE fg.id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Fantasy game not found'; END IF;

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_game_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN RAISE EXCEPTION 'missing_badge'; END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN RAISE EXCEPTION 'ticket_expired'; END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN RAISE EXCEPTION 'ticket_wrong_tier'; END IF;
      ELSE
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;
      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct
      FROM public.deduct_coins(p_user_id, v_entry_cost, 'fantasy_entry',
        jsonb_build_object('game_id', p_game_id));
      v_balance := v_deduct.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$;


--
-- Name: join_live_game(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_live_game(p_game_id uuid, p_user_id uuid) RETURNS TABLE(entry_id uuid, already_joined boolean)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_mode TEXT;
  v_cost INTEGER;
  v_status TEXT;
  v_fixture_id UUID;
  v_fix_status TEXT;
  v_existing UUID;
  v_new UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT mode, COALESCE(entry_cost, 0), status, fixture_id
    INTO v_mode, v_cost, v_status, v_fixture_id
  FROM public.live_games WHERE id = p_game_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'game_not_found'; END IF;
  IF v_status IN ('finished', 'cancelled') THEN RAISE EXCEPTION 'game_over'; END IF;

  SELECT status INTO v_fix_status FROM public.fb_fixtures WHERE id = v_fixture_id;
  IF v_fix_status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD') THEN
    RAISE EXCEPTION 'match_over';
  END IF;

  SELECT id INTO v_existing FROM public.live_game_entries
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
  IF FOUND THEN
    entry_id := v_existing; already_joined := true; RETURN NEXT; RETURN;
  END IF;

  IF v_mode = 'ranked' AND v_cost > 0 THEN
    PERFORM public.deduct_coins(p_user_id, v_cost, 'live_game_entry',
      jsonb_build_object('live_game_id', p_game_id));
  END IF;

  INSERT INTO public.live_game_entries (live_game_id, user_id)
  VALUES (p_game_id, p_user_id)
  RETURNING id INTO v_new;

  entry_id := v_new; already_joined := false; RETURN NEXT;
END;
$$;


--
-- Name: join_squad(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_squad(p_user_id uuid, p_invite_code text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_squad_id UUID;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  SELECT id INTO v_squad_id FROM public.squads WHERE invite_code = upper(trim(p_invite_code));
  IF v_squad_id IS NULL THEN RAISE EXCEPTION 'invalid_code'; END IF;
  IF EXISTS (SELECT 1 FROM public.squad_blocks WHERE squad_id = v_squad_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'blocked';
  END IF;
  INSERT INTO public.squad_members (squad_id, user_id, role)
  VALUES (v_squad_id, p_user_id, 'member')
  ON CONFLICT (squad_id, user_id) DO NOTHING;
  RETURN v_squad_id;
END;
$$;


--
-- Name: join_swipe_challenge(uuid, uuid, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid DEFAULT NULL::uuid) RETURNS TABLE(already_joined boolean, coins_balance integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_entry_cost INTEGER;
  v_rows BIGINT;
  v_balance INTEGER;
  v_deduct_result RECORD;
  v_cfg JSONB;
  v_min_level TEXT;
  v_req_badges JSONB;
  v_req_sub BOOLEAN;
  v_tier TEXT;
  v_level TEXT;
  v_is_sub BOOLEAN;
  v_badges JSONB;
  v_req TEXT;
  v_ticket RECORD;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'Unauthorized';
  END IF;
  IF p_method NOT IN ('coins', 'ticket') THEN
    RAISE EXCEPTION 'Invalid entry method %', p_method;
  END IF;

  SELECT c.entry_cost INTO v_entry_cost FROM public.challenges c WHERE c.id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;

  SELECT cc.config_data INTO v_cfg
  FROM public.challenge_configs cc WHERE cc.challenge_id = p_challenge_id LIMIT 1;
  v_min_level := COALESCE(v_cfg->>'minimum_level', 'Rookie');
  v_req_badges := COALESCE(v_cfg->'required_badges', '[]'::jsonb);
  v_req_sub := COALESCE((v_cfg->>'requires_subscription')::boolean, false);
  v_tier := lower(COALESCE(v_cfg->>'tier', 'amateur'));

  SELECT p.level, p.is_subscriber, to_jsonb(p.badges)
    INTO v_level, v_is_sub, v_badges
  FROM public.profiles p WHERE p.id = p_user_id;
  v_badges := COALESCE(v_badges, '[]'::jsonb);

  INSERT INTO public.challenge_participants (challenge_id, user_id)
  VALUES (p_challenge_id, p_user_id)
  ON CONFLICT (challenge_id, user_id) DO NOTHING;
  GET DIAGNOSTICS v_rows = ROW_COUNT;
  already_joined := v_rows = 0;

  IF NOT already_joined THEN
    IF public.user_level_rank(v_level) < public.user_level_rank(v_min_level) THEN
      RAISE EXCEPTION 'level_too_low';
    END IF;
    IF v_req_sub AND NOT COALESCE(v_is_sub, false) THEN
      RAISE EXCEPTION 'subscription_required';
    END IF;
    FOR v_req IN SELECT jsonb_array_elements_text(v_req_badges) LOOP
      IF NOT (v_badges ? v_req) THEN RAISE EXCEPTION 'missing_badge'; END IF;
    END LOOP;

    IF p_method = 'ticket' THEN
      IF p_ticket_id IS NOT NULL THEN
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.id = p_ticket_id AND t.user_id = p_user_id;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
        IF v_ticket.is_used THEN RAISE EXCEPTION 'ticket_used'; END IF;
        IF v_ticket.expires_at IS NOT NULL AND v_ticket.expires_at < now() THEN
          RAISE EXCEPTION 'ticket_expired';
        END IF;
        IF lower(v_ticket.ticket_type) NOT IN (v_tier, 'premium') THEN RAISE EXCEPTION 'ticket_wrong_tier'; END IF;
      ELSE
        SELECT * INTO v_ticket FROM public.user_tickets t
        WHERE t.user_id = p_user_id AND lower(t.ticket_type) IN (v_tier, 'premium')
          AND t.is_used = false AND (t.expires_at IS NULL OR t.expires_at >= now())
        ORDER BY (lower(t.ticket_type) = 'premium'), t.expires_at ASC NULLS LAST LIMIT 1;
        IF NOT FOUND THEN RAISE EXCEPTION 'ticket_invalid'; END IF;
      END IF;
      UPDATE public.user_tickets SET is_used = true, used_at = now() WHERE id = v_ticket.id;
      SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
    ELSE
      SELECT * INTO v_deduct_result
      FROM public.deduct_coins(
        p_user_id, v_entry_cost, 'challenge_entry',
        jsonb_build_object('challenge_id', p_challenge_id)
      );
      v_balance := v_deduct_result.new_balance;
    END IF;
  ELSE
    SELECT u.coins_balance INTO v_balance FROM public.users u WHERE u.id = p_user_id;
  END IF;

  coins_balance := v_balance;
  RETURN NEXT;
END;
$$;


--
-- Name: lf_get_game(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_get_game(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_game public.lf_games; v_cfg public.lf_config; v_team public.lf_teams;
BEGIN
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_game FROM public.lf_games WHERE fixture_id=p_fixture_id;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'game', NULL); END IF;
  SELECT * INTO v_team FROM public.lf_teams WHERE game_id=v_game.id AND user_id=v_user;
  RETURN jsonb_build_object('ok', true,
    'config', jsonb_build_object('captain_multiplier', v_cfg.captain_multiplier, 'max_transfers', v_cfg.max_transfers, 'outfield_per_team', v_cfg.outfield_per_team),
    'game', jsonb_build_object('id', v_game.id, 'status', v_game.status, 'lock_at', v_game.lock_at, 'gk_underdog', v_game.gk_underdog),
    'pool', (SELECT COALESCE(jsonb_agg(jsonb_build_object('player_id', player_id, 'name', name, 'photo', photo, 'pos', position, 'side', side, 'shirt', shirt_no, 'available', available, 'on_pitch', on_pitch) ORDER BY side, CASE position WHEN 'GK' THEN 0 WHEN 'D' THEN 1 WHEN 'M' THEN 2 ELSE 3 END), '[]'::jsonb)
             FROM public.lf_game_players WHERE game_id=v_game.id),
    'my_team', CASE WHEN v_team.id IS NULL THEN NULL ELSE jsonb_build_object(
        'id', v_team.id, 'captain', v_team.captain_player_id, 'transfers_used', v_team.transfers_used, 'score', v_team.score, 'rank', v_team.rank,
        'players', (SELECT jsonb_agg(jsonb_build_object('player_id', player_id, 'pos', position, 'side', side, 'is_captain', is_captain)) FROM public.lf_team_players WHERE team_id=v_team.id AND active)
      ) END,
    'leaderboard', (SELECT COALESCE(jsonb_agg(jsonb_build_object('rank', rank, 'score', score, 'is_me', user_id=v_user) ORDER BY score DESC), '[]'::jsonb)
                    FROM (SELECT * FROM public.lf_teams WHERE game_id=v_game.id ORDER BY score DESC LIMIT 50) z),
    'total_players', (SELECT count(*) FROM public.lf_teams WHERE game_id=v_game.id)
  );
END $$;


--
-- Name: lf_lock(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_lock(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_total INT; gk RECORD; v_pct NUMERIC; v_min_pct NUMERIC; v_tiers JSONB; v_map JSONB := '{}'::jsonb; tier JSONB; v_mult NUMERIC;
BEGIN
  SELECT gk_underdog_tiers INTO v_tiers FROM public.lf_config WHERE id=1;
  SELECT count(*) INTO v_total FROM public.lf_teams WHERE game_id=p_game_id;
  IF v_total = 0 THEN UPDATE public.lf_games SET status='locked' WHERE id=p_game_id; RETURN jsonb_build_object('ok', true, 'note', 'no_teams'); END IF;
  -- min pick% among picked GKs = the underdog
  SELECT min(pct) INTO v_min_pct FROM (
    SELECT 100.0 * count(*) / v_total pct FROM public.lf_team_players WHERE team_id IN (SELECT id FROM public.lf_teams WHERE game_id=p_game_id) AND position='GK' AND active GROUP BY player_id
  ) z;
  FOR gk IN SELECT player_id, 100.0 * count(*) / v_total AS pct FROM public.lf_team_players
            WHERE team_id IN (SELECT id FROM public.lf_teams WHERE game_id=p_game_id) AND position='GK' AND active GROUP BY player_id LOOP
    v_mult := 1.0;
    IF gk.pct = v_min_pct AND gk.pct < 50 THEN   -- the underdog (and not a majority/tie at >=50)
      FOR tier IN SELECT * FROM jsonb_array_elements(v_tiers) ORDER BY (value->>'max_pct')::numeric LOOP
        IF gk.pct <= (tier->>'max_pct')::numeric THEN v_mult := (tier->>'mult')::numeric; EXIT; END IF;
      END LOOP;
    END IF;
    v_map := v_map || jsonb_build_object(gk.player_id::text, v_mult);
  END LOOP;
  UPDATE public.lf_games SET status='locked', gk_underdog=v_map WHERE id=p_game_id;
  UPDATE public.lf_teams SET locked=true WHERE game_id=p_game_id;
  RETURN jsonb_build_object('ok', true, 'gk_underdog', v_map);
END $$;


--
-- Name: lf_notify_me(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_notify_me(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  INSERT INTO public.lf_notify (user_id, fixture_id) VALUES (v_user, p_fixture_id) ON CONFLICT (user_id, fixture_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true);
END $$;


--
-- Name: lf_player_points(uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_player_points(p_game_id uuid, p_player_id uuid, p_pos text) RETURNS numeric
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_fix RECORD; v_gp RECORD; st RECORD; sc JSONB; s JSONB; opp INT; pts NUMERIC := 0; mins INT;
BEGIN
  SELECT scoring INTO sc FROM public.lf_config WHERE id=1;
  s := sc->p_pos; IF s IS NULL THEN RETURN 0; END IF;
  SELECT f.* INTO v_fix FROM public.lf_games g JOIN public.fb_fixtures f ON f.id=g.fixture_id WHERE g.id=p_game_id;
  SELECT side INTO v_gp FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_player_id;
  SELECT * INTO st FROM public.player_match_stats WHERE fixture_id=v_fix.id AND player_id=p_player_id;
  IF st IS NULL THEN RETURN 0; END IF;
  opp := CASE WHEN v_gp.side='home' THEN COALESCE(v_fix.goals_away,0) ELSE COALESCE(v_fix.goals_home,0) END;
  mins := COALESCE(st.minutes_played,0);

  pts := pts + COALESCE(st.goals,0)   * COALESCE((s->>'goal')::numeric,0);
  pts := pts + COALESCE(st.assists,0) * COALESCE((s->>'assist')::numeric,0);
  IF p_pos IN ('D','M','A') THEN pts := pts + COALESCE(st.shots_on_target,0) * COALESCE((s->>'shot_on_target')::numeric,0); END IF;
  IF p_pos = 'D' THEN
    pts := pts + COALESCE(st.tackles_total,0) * COALESCE((s->>'tackle')::numeric,0);
    pts := pts + COALESCE(st.tackles_interceptions,0) * COALESCE((s->>'interception')::numeric,0);
    IF opp >= 2 THEN pts := pts + (opp-1) * COALESCE((s->>'conceded_per_from_2')::numeric,0); END IF;
  END IF;
  IF p_pos IN ('M','A') THEN pts := pts + COALESCE(st.fouls_drawn,0) * COALESCE((s->>'foul_drawn')::numeric,0); END IF;
  IF p_pos = 'GK' THEN
    pts := pts + COALESCE(st.saves,0) * COALESCE((s->>'save')::numeric,0);
    IF COALESCE(st.saves,0) >= 3 THEN pts := pts + COALESCE((s->>'save_bonus_3plus')::numeric,0); END IF;
    pts := pts + opp * COALESCE((s->>'conceded')::numeric,0);
  END IF;
  IF p_pos IN ('GK','D') AND opp = 0 AND mins >= 60 THEN pts := pts + COALESCE((s->>'clean_sheet')::numeric,0); END IF;
  IF st.yellow_card THEN pts := pts + COALESCE((s->>'yellow')::numeric,0); END IF;
  IF st.red_card THEN pts := pts + COALESCE((s->>'red')::numeric,0); END IF;
  RETURN pts;
END $$;


--
-- Name: lf_recalc(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_recalc(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cfg public.lf_config; t RECORD; tp RECORD; v_score NUMERIC; v_mult NUMERIC; v_gk JSONB;
BEGIN
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT gk_underdog INTO v_gk FROM public.lf_games WHERE id=p_game_id;
  FOR t IN SELECT * FROM public.lf_teams WHERE game_id=p_game_id LOOP
    v_score := 0;
    FOR tp IN SELECT * FROM public.lf_team_players WHERE team_id=t.id AND active LOOP
      v_mult := 1;
      IF tp.is_captain THEN v_mult := v_mult * v_cfg.captain_multiplier; END IF;
      IF tp.position='GK' AND v_gk ? tp.player_id::text THEN v_mult := v_mult * (v_gk->>tp.player_id::text)::numeric; END IF;
      v_score := v_score + public.lf_player_points(p_game_id, tp.player_id, tp.position) * v_mult;
    END LOOP;
    UPDATE public.lf_teams SET score = v_score WHERE id=t.id;
  END LOOP;
  -- ranks
  WITH r AS (SELECT id, rank() OVER (ORDER BY score DESC) rk FROM public.lf_teams WHERE game_id=p_game_id)
  UPDATE public.lf_teams t SET rank = r.rk FROM r WHERE t.id=r.id;
  RETURN jsonb_build_object('ok', true, 'teams', (SELECT count(*) FROM public.lf_teams WHERE game_id=p_game_id));
END $$;


--
-- Name: lf_resolve_pot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_resolve_pot(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_league UUID; v_home UUID; v_away UUID; r RECORD;
BEGIN
  SELECT league_id, home_team_id, away_team_id INTO v_league, v_home, v_away FROM public.fb_fixtures WHERE id=p_fixture_id;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='match' AND fixture_id=p_fixture_id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='team' AND team_id IN (v_home,v_away) LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='league' AND league_id=v_league LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND game='live_fantasy' AND scope='global' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  RETURN jsonb_build_object('pot_profile_id', null);
END; $$;


--
-- Name: lf_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_results(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM lf_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'settled' THEN
    v_stats := compute_lf_crowd_stats(g.id);
    UPDATE lf_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', t.user_id, 'username', COALESCE(pr.username, 'Player'),
    'score', t.score, 'rank', t.rank, 'is_me', t.user_id = v_uid)
    ORDER BY t.rank NULLS LAST, t.score DESC NULLS LAST)
  INTO v_lb FROM lf_teams t LEFT JOIN profiles pr ON pr.id = t.user_id
  WHERE t.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'live_fantasy', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM lf_teams WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;


--
-- Name: lf_save_team(uuid, uuid, uuid[], uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_save_team(p_game_id uuid, p_gk uuid, p_outfield uuid[], p_captain uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_game public.lf_games; v_cfg public.lf_config; v_team_id UUID;
  v_nd INT; v_nm INT; v_na INT; v_home INT; v_away INT; v_all UUID[]; pid UUID; v_pos TEXT; v_side TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_game FROM public.lf_games WHERE id=p_game_id;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_game'); END IF;
  IF v_game.status NOT IN ('upcoming','open') THEN RETURN jsonb_build_object('ok', false, 'error', 'locked'); END IF;
  IF array_length(p_outfield,1) <> 6 THEN RETURN jsonb_build_object('ok', false, 'error', 'need_6_outfield'); END IF;
  -- GK valid
  PERFORM 1 FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_gk AND position='GK';
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_gk'); END IF;
  -- outfield counts by position + side
  SELECT count(*) FILTER (WHERE position='D'), count(*) FILTER (WHERE position='M'), count(*) FILTER (WHERE position='A'),
         count(*) FILTER (WHERE side='home'), count(*) FILTER (WHERE side='away')
    INTO v_nd, v_nm, v_na, v_home, v_away
  FROM public.lf_game_players WHERE game_id=p_game_id AND player_id = ANY(p_outfield) AND position IN ('D','M','A');
  IF (v_nd + v_nm + v_na) <> 6 THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid_outfield'); END IF;
  IF v_nd <> 2 OR v_nm <> 2 OR v_na <> 2 THEN RETURN jsonb_build_object('ok', false, 'error', 'need_2_2_2'); END IF;
  IF v_home <> v_cfg.outfield_per_team OR v_away <> v_cfg.outfield_per_team THEN RETURN jsonb_build_object('ok', false, 'error', 'need_3_each_side'); END IF;
  v_all := p_outfield || p_gk;
  IF NOT (p_captain = ANY(v_all)) THEN RETURN jsonb_build_object('ok', false, 'error', 'bad_captain'); END IF;

  INSERT INTO public.lf_teams (game_id, user_id, captain_player_id) VALUES (p_game_id, v_user, p_captain)
  ON CONFLICT (game_id, user_id) DO UPDATE SET captain_player_id=p_captain RETURNING id INTO v_team_id;
  DELETE FROM public.lf_team_players WHERE team_id=v_team_id;
  FOREACH pid IN ARRAY v_all LOOP
    SELECT position, side INTO v_pos, v_side FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=pid;
    INSERT INTO public.lf_team_players (team_id, player_id, position, side, is_captain) VALUES (v_team_id, pid, v_pos, v_side, pid=p_captain);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'team_id', v_team_id);
END $$;


--
-- Name: lf_settle(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_settle(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_g public.lf_games; v_count INT; v_pot INT := 0; v_profile public.mr_pot_profiles; v_assign JSONB; v_split JSONB; sp JSONB; v_amt INT; v_n INT; w RECORD;
BEGIN
  SELECT * INTO v_g FROM public.lf_games WHERE id=p_game_id;
  IF v_g.id IS NULL OR v_g.status='settled' THEN RETURN jsonb_build_object('ok',true,'already',true); END IF;
  PERFORM public.lf_recalc(p_game_id);
  SELECT count(*) INTO v_count FROM public.lf_teams WHERE game_id=p_game_id;

  v_assign := public.lf_resolve_pot(v_g.fixture_id);
  IF (v_assign->>'pot_profile_id') IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.mr_pot_profiles WHERE id=(v_assign->>'pot_profile_id')::uuid;
    IF (v_assign->>'override_amount') IS NOT NULL THEN v_pot := (v_assign->>'override_amount')::int;
    ELSIF v_profile.type='fixed' THEN v_pot := COALESCE(v_profile.fixed_amount,0);
    ELSIF v_profile.type='progressive' THEN
      SELECT COALESCE((t->>'amount')::int,0) INTO v_pot FROM jsonb_array_elements(v_profile.tiers) t
      WHERE v_count >= (t->>'min')::int AND (t->>'max' IS NULL OR v_count <= (t->>'max')::int) LIMIT 1;
    ELSIF v_profile.type='funded' THEN
      v_pot := FLOOR(v_count * COALESCE(v_profile.entry_cost,0) * COALESCE(v_profile.redistribution_pct,100) / 100.0);
    END IF;
  END IF;

  -- distribute by reward split (each rank's pct shared among ties)
  SELECT reward_split INTO v_split FROM public.lf_config WHERE id=1;
  IF v_pot > 0 THEN
    FOR sp IN SELECT * FROM jsonb_array_elements(v_split) LOOP
      SELECT count(*) INTO v_n FROM public.lf_teams WHERE game_id=p_game_id AND rank=(sp->>'rank')::int;
      IF v_n > 0 THEN
        v_amt := FLOOR(v_pot * (sp->>'pct')::numeric / 100.0 / v_n);
        FOR w IN SELECT * FROM public.lf_teams WHERE game_id=p_game_id AND rank=(sp->>'rank')::int LOOP
          PERFORM public.add_coins(w.user_id, v_amt, 'live_fantasy', jsonb_build_object('lf_game',p_game_id,'rank',w.rank));
        END LOOP;
      END IF;
    END LOOP;
  END IF;

  UPDATE public.lf_games SET status='settled', settled_at=now(), pot_amount=v_pot, pot_profile_id=(v_assign->>'pot_profile_id')::uuid WHERE id=p_game_id;
  RETURN jsonb_build_object('ok',true,'pot',v_pot,'teams',v_count);
END; $$;


--
-- Name: lf_sync_pool(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_sync_pool(p_game_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE v_fix RECORD; st RECORD; v_side TEXT; v_pos TEXT;
BEGIN
  SELECT f.id AS fid, f.home_team_id, f.away_team_id INTO v_fix
  FROM public.lf_games g JOIN public.fb_fixtures f ON f.id=g.fixture_id WHERE g.id=p_game_id;
  IF v_fix.fid IS NULL THEN RETURN; END IF;
  FOR st IN
    SELECT pms.player_id, pms.api_id, pms.team_id, pms.position, pms.minutes_played, pms.substitute_out, pl.name, pl.photo
    FROM public.player_match_stats pms JOIN public.players pl ON pl.id=pms.player_id
    WHERE pms.fixture_id=v_fix.fid
  LOOP
    v_side := CASE WHEN st.team_id=v_fix.home_team_id THEN 'home' WHEN st.team_id=v_fix.away_team_id THEN 'away' ELSE NULL END;
    CONTINUE WHEN v_side IS NULL;
    v_pos := CASE WHEN st.position ~* '(goal|keeper|^g$)' THEN 'GK'
                  WHEN st.position ~* '(def|back|^d$)' THEN 'D'
                  WHEN st.position ~* '(mid|^m$)' THEN 'M'
                  WHEN st.position ~* '(att|forw|strik|wing|^f$)' THEN 'A' ELSE 'M' END;
    IF COALESCE(st.minutes_played,0) > 0 THEN
      INSERT INTO public.lf_game_players (game_id, player_id, api_id, team_id, side, position, name, photo, is_starter, available, on_pitch)
      VALUES (p_game_id, st.player_id, st.api_id, st.team_id, v_side, v_pos, st.name, st.photo, false, true, true)
      ON CONFLICT (game_id, player_id) DO NOTHING;
    END IF;
    IF st.substitute_out THEN
      UPDATE public.lf_game_players SET available=false, on_pitch=false WHERE game_id=p_game_id AND player_id=st.player_id;
    END IF;
  END LOOP;
END $_$;


--
-- Name: lf_tick(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_tick(p_game_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_g public.lf_games; v_status TEXT;
BEGIN
  SELECT * INTO v_g FROM public.lf_games WHERE id=p_game_id;
  IF v_g.status='settled' THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.fb_fixtures WHERE id=v_g.fixture_id;
  IF v_g.status IN ('open','upcoming') AND v_status IN ('1H','LIVE','HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.lf_lock(p_game_id);
  END IF;
  IF v_status IN ('1H','LIVE','HT','2H','ET','BT','P') THEN
    UPDATE public.lf_games SET status='live' WHERE id=p_game_id AND status<>'live';
    PERFORM public.lf_sync_pool(p_game_id);
    PERFORM public.lf_recalc(p_game_id);
  ELSIF v_status IN ('FT','AET','PEN') THEN
    PERFORM public.lf_sync_pool(p_game_id);
    PERFORM public.lf_settle(p_game_id);
  END IF;
END $$;


--
-- Name: lf_tick_all(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_tick_all() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g UUID;
BEGIN
  FOR g IN SELECT id FROM public.lf_games WHERE status <> 'settled' LOOP PERFORM public.lf_tick(g); END LOOP;
END; $$;


--
-- Name: lf_transfer(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lf_transfer(p_game_id uuid, p_out uuid, p_in uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_cfg public.lf_config; v_team public.lf_teams; v_out RECORD; v_in RECORD; v_was_cap BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.lf_config WHERE id=1;
  SELECT * INTO v_team FROM public.lf_teams WHERE game_id=p_game_id AND user_id=v_user;
  IF v_team.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_team'); END IF;
  IF v_team.transfers_used >= v_cfg.max_transfers THEN RETURN jsonb_build_object('ok', false, 'error', 'no_transfers_left'); END IF;
  SELECT * INTO v_out FROM public.lf_team_players WHERE team_id=v_team.id AND player_id=p_out AND active;
  IF v_out.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_in_team'); END IF;
  SELECT position, side, available INTO v_in FROM public.lf_game_players WHERE game_id=p_game_id AND player_id=p_in;
  IF v_in.position IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_in_pool'); END IF;
  IF NOT v_in.available THEN RETURN jsonb_build_object('ok', false, 'error', 'player_unavailable'); END IF;
  IF v_in.position <> v_out.position OR v_in.side <> v_out.side THEN RETURN jsonb_build_object('ok', false, 'error', 'must_match_pos_side'); END IF;
  IF EXISTS (SELECT 1 FROM public.lf_team_players WHERE team_id=v_team.id AND player_id=p_in AND active) THEN RETURN jsonb_build_object('ok', false, 'error', 'already_in_team'); END IF;
  v_was_cap := v_out.is_captain;
  UPDATE public.lf_team_players SET active=false WHERE id=v_out.id;
  INSERT INTO public.lf_team_players (team_id, player_id, position, side, is_captain) VALUES (v_team.id, p_in, v_in.position, v_in.side, v_was_cap);
  UPDATE public.lf_teams SET transfers_used = transfers_used + 1, captain_player_id = CASE WHEN v_was_cap THEN p_in ELSE captain_player_id END WHERE id=v_team.id;
  RETURN jsonb_build_object('ok', true, 'transfers_left', v_cfg.max_transfers - v_team.transfers_used - 1);
END $$;


--
-- Name: link_game_to_squads(uuid, uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.link_game_to_squads(p_user_id uuid, p_game_id uuid, p_game_type text, p_squad_ids uuid[]) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_squad UUID; v_count INTEGER := 0;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  FOREACH v_squad IN ARRAY p_squad_ids LOOP
    IF EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = v_squad AND m.user_id = p_user_id) THEN
      INSERT INTO public.squad_games (squad_id, game_id, game_type, linked_by)
      VALUES (v_squad, p_game_id, COALESCE(p_game_type, 'betting'), p_user_id)
      ON CONFLICT (squad_id, game_id) DO NOTHING;
      IF FOUND THEN v_count := v_count + 1; END IF;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;


--
-- Name: live_bonus_correct(text, jsonb, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.live_bonus_correct(p_key text, p_pred jsonb, p_gh integer, p_ga integer) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ph INTEGER := COALESCE((p_pred->>'home')::int, 0);
  v_pa INTEGER := COALESCE((p_pred->>'away')::int, 0);
BEGIN
  CASE p_key
    WHEN 'btts'   THEN RETURN CASE WHEN p_gh > 0 AND p_ga > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'over25' THEN RETURN CASE WHEN p_gh + p_ga >= 3 THEN 'yes' ELSE 'no' END;
    WHEN 'nil_nil' THEN RETURN CASE WHEN p_gh = 0 AND p_ga = 0 THEN 'yes' ELSE 'no' END;
    -- Clean sheet for the team the player predicted to win
    WHEN 'clean_sheet_winner' THEN
      IF v_ph > v_pa THEN RETURN CASE WHEN p_ga = 0 THEN 'yes' ELSE 'no' END;
      ELSIF v_pa > v_ph THEN RETURN CASE WHEN p_gh = 0 THEN 'yes' ELSE 'no' END;
      ELSE RETURN 'no'; END IF;
    ELSE RETURN NULL;
  END CASE;
END;
$$;


--
-- Name: live_bonus_subpool(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.live_bonus_subpool(sit text) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE sit
    WHEN 'goalless' THEN
      ARRAY['possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most']
    WHEN 'clean_sheet' THEN
      ARRAY['possession_most','both_carded','cards_4plus','cards_most','red_card','first_goal_1h','corners_9plus','corners_most']
    ELSE
      ARRAY['first_scorer','first_goal_1h','possession_most','both_carded','cards_4plus','cards_most','red_card','corners_9plus','corners_most']
  END;
$$;


--
-- Name: live_results_index(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.live_results_index(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_lp JSONB; v_mr JSONB; v_lf JSONB;
BEGIN
  SELECT jsonb_build_object('game_type','live_prediction','status',lg.status,
    'players',(SELECT count(*) FROM live_game_entries WHERE game_id = lg.id))
  INTO v_lp FROM live_games lg WHERE lg.fixture_id = p_fixture_id ORDER BY lg.created_at DESC LIMIT 1;
  SELECT jsonb_build_object('game_type','match_royale','status',mg.status,
    'players',(SELECT count(*) FROM mr_participants WHERE game_id = mg.id),
    'winners',(SELECT count(*) FROM mr_participants WHERE game_id = mg.id AND is_winner))
  INTO v_mr FROM mr_games mg WHERE mg.fixture_id = p_fixture_id ORDER BY mg.created_at DESC LIMIT 1;
  SELECT jsonb_build_object('game_type','live_fantasy','status',lf.status,
    'players',(SELECT count(*) FROM lf_teams WHERE game_id = lf.id))
  INTO v_lf FROM lf_games lf WHERE lf.fixture_id = p_fixture_id ORDER BY lf.created_at DESC LIMIT 1;
  RETURN jsonb_build_object('fixture_id', p_fixture_id,
    'games', jsonb_strip_nulls(jsonb_build_object('live_prediction', v_lp, 'match_royale', v_mr, 'live_fantasy', v_lf)));
END $$;


--
-- Name: live_situation(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.live_situation(h integer, a integer) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE WHEN h = 0 AND a = 0 THEN 'goalless'
              WHEN h = 0 OR a = 0 THEN 'clean_sheet'
              ELSE 'both_score' END;
$$;


--
-- Name: lp_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.lp_results(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM live_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'finished' THEN
    v_stats := compute_lp_crowd_stats(g.id);
    UPDATE live_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', e.user_id, 'username', COALESCE(pr.username, 'Player'),
    'points', e.total_points, 'rank', e.rank,
    'predicted_score', e.predicted_score, 'is_me', e.user_id = v_uid)
    ORDER BY e.rank NULLS LAST, e.total_points DESC)
  INTO v_lb FROM live_game_entries e LEFT JOIN profiles pr ON pr.id = e.user_id
  WHERE e.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'live_prediction', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM live_game_entries WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;


--
-- Name: match_bet_limit_for_level(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_bet_limit_for_level(p_level text) RETURNS integer
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
declare
  v text := lower(trim(coalesce(p_level, '')));
begin
  if v = '' then return 500; end if;
  case v
    when 'rookie'        then return 500;
    when 'rising star'   then return 1000;
    when 'rising_star'   then return 1000;
    when 'pro'           then return 2000;
    when 'elite'         then return 5000;
    when 'expert'        then return 5000;
    when 'legend'        then return 15000;
    when 'master'        then return 40000;
    when 'goat'          then return null; -- unlimited
    else return 500;
  end case;
end;
$$;


--
-- Name: match_players_by_name(text[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.match_players_by_name(p_names text[]) RETURNS TABLE(original_name text, player_id uuid, player_name text, photo_url text, team_id uuid, team_name text)
    LANGUAGE sql
    SET search_path TO 'public'
    AS $$
  WITH input_names AS (
    SELECT unnest(p_names) AS orig
  ),
  candidates AS (
    SELECT
      i.orig,
      p.id AS player_id,
      p.name AS player_name,
      p.photo AS photo_url,
      pta.team_id,
      t.name AS team_name,
      CASE
        WHEN normalize_name(p.name) = normalize_name(i.orig) THEN 100
        WHEN extract_last_name(p.name) = extract_last_name(i.orig)
         AND extract_first_initial(p.name) = extract_first_initial(i.orig) THEN 90
        WHEN extract_last_name(p.name) = extract_last_name(i.orig) THEN 80
        ELSE 0
      END AS match_score
    FROM input_names i
    JOIN fb_players p ON extract_last_name(p.name) = extract_last_name(i.orig)
    LEFT JOIN fb_player_team_association pta ON pta.player_id = p.id AND pta.end_date IS NULL
    LEFT JOIN fb_teams t ON t.id = pta.team_id
    WHERE extract_last_name(p.name) IS NOT NULL
  )
  SELECT DISTINCT ON (orig)
    orig AS original_name,
    player_id,
    player_name,
    photo_url,
    team_id,
    team_name
  FROM candidates
  WHERE match_score >= 80
  ORDER BY orig, match_score DESC, team_id NULLS LAST;
$$;


--
-- Name: FUNCTION match_players_by_name(p_names text[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.match_players_by_name(p_names text[]) IS 'Finds players by normalized name, returns photo and team info';


--
-- Name: mr_answer(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_answer(p_question_id uuid, p_option text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_q public.mr_questions; v_g public.mr_games;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_q FROM public.mr_questions WHERE id = p_question_id;
  IF v_q.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','question not found'); END IF;
  SELECT * INTO v_g FROM public.mr_games WHERE id = v_q.game_id;
  IF NOT EXISTS (SELECT 1 FROM public.mr_participants WHERE game_id=v_g.id AND user_id=v_user) THEN
    RETURN jsonb_build_object('ok',false,'error','not_joined'); END IF;
  -- pre_match answerable while 'open'; half_time answerable while 'half_time'
  IF NOT ((v_q.phase='pre_match' AND v_g.status='open') OR (v_q.phase='half_time' AND v_g.status='half_time')) THEN
    RETURN jsonb_build_object('ok',false,'error','locked'); END IF;
  INSERT INTO public.mr_answers (question_id, game_id, user_id, option_key)
  VALUES (p_question_id, v_g.id, v_user, p_option)
  ON CONFLICT (question_id, user_id) DO UPDATE SET option_key = EXCLUDED.option_key, answered_at = now();
  RETURN jsonb_build_object('ok',true);
END; $$;


--
-- Name: mr_autocreate_games(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_autocreate_games() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE f RECORD; n INTEGER := 0;
BEGIN
  FOR f IN
    SELECT fx.id, fx.league_id, ht.name AS h, at2.name AS a
    FROM public.fb_fixtures fx
    LEFT JOIN public.fb_teams ht  ON ht.id  = fx.home_team_id
    LEFT JOIN public.fb_teams at2 ON at2.id = fx.away_team_id
    WHERE fx.date BETWEEN now() AND now() + INTERVAL '60 minutes'
      AND COALESCE(fx.status,'NS') = 'NS'
      AND NOT EXISTS (SELECT 1 FROM public.mr_games g WHERE g.fixture_id = fx.id)
      AND (
        EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='fixture' AND a.target_id=fx.id AND a.enabled)
        OR (EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='league' AND a.target_id=fx.league_id AND a.enabled)
            AND NOT EXISTS (SELECT 1 FROM public.mr_activation a WHERE a.scope='fixture' AND a.target_id=fx.id AND NOT a.enabled))
      )
  LOOP
    BEGIN
      PERFORM public.mr_create_game(f.id, COALESCE(f.h,'Home') || ' vs ' || COALESCE(f.a,'Away'));
      n := n + 1;
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'autocreate % failed: %', f.id, SQLERRM; END;
  END LOOP;
  RETURN n;
END $$;


--
-- Name: mr_create_game(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_create_game(p_fixture_id uuid, p_name text) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_id UUID; v_cfg public.mr_config; v_pot JSONB; v_profile UUID; v_amount INT; v_entry INT := 0; v_api BIGINT;
BEGIN
  SELECT * INTO v_cfg FROM public.mr_config WHERE id = 1;
  SELECT api_id INTO v_api FROM public.fb_fixtures WHERE id = p_fixture_id;
  v_pot := public.mr_resolve_pot(p_fixture_id);
  v_profile := NULLIF(v_pot->>'pot_profile_id','')::UUID;
  IF v_profile IS NOT NULL THEN
    SELECT CASE WHEN type='fixed' THEN COALESCE((v_pot->>'override_amount')::INT, fixed_amount) ELSE NULL END,
           CASE WHEN type='funded' THEN entry_cost ELSE 0 END
    INTO v_amount, v_entry FROM public.mr_pot_profiles WHERE id = v_profile;
  ELSIF (v_pot->>'override_amount') IS NOT NULL THEN
    v_amount := (v_pot->>'override_amount')::INT;
  END IF;

  INSERT INTO public.mr_games (fixture_id, api_fixture_id, name, status, hearts, lives_per_player, entry_cost, pot_profile_id, pot_amount, tier)
  VALUES (p_fixture_id, v_api, p_name, 'open', v_cfg.hearts, v_cfg.hearts, COALESCE(v_entry,0), v_profile, v_amount,
          COALESCE((SELECT rules->>'tier' FROM public.challenges WHERE false),'amateur'))
  RETURNING id INTO v_id;

  PERFORM public.mr_gen_questions(v_id, 'pre_match', 1, v_cfg.questions_pre, 1);
  IF v_cfg.tie_break_enabled THEN
    INSERT INTO public.mr_questions (game_id, seq, kind, prompt, options, status, phase, answer_type, catalog_key, half, is_tie_break)
    VALUES (v_id, 100, 'tie_break', 'At least one goal in the match?',
            jsonb_build_array(jsonb_build_object('key','yes','label','Yes'), jsonb_build_object('key','no','label','No')),
            'open', 'pre_match', 'yesno', 'tie_break', NULL, true);
  END IF;
  RETURN v_id;
END; $$;


--
-- Name: mr_finalize(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_finalize(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_g public.mr_games; v_count INT; v_pot INT := 0; v_profile public.mr_pot_profiles;
  v_had_goal BOOLEAN; v_winners UUID[]; v_last_seq INT; v_tb_key TEXT; v_share INT; w UUID;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  IF v_g.status = 'finished' THEN RETURN jsonb_build_object('ok',true,'already',true); END IF;
  SELECT count(*) INTO v_count FROM public.mr_participants WHERE game_id=p_game_id;

  -- pot amount
  IF v_g.pot_profile_id IS NOT NULL THEN
    SELECT * INTO v_profile FROM public.mr_pot_profiles WHERE id=v_g.pot_profile_id;
    IF v_profile.type='fixed' THEN v_pot := COALESCE(v_g.pot_amount, v_profile.fixed_amount, 0);
    ELSIF v_profile.type='progressive' THEN
      SELECT COALESCE((t->>'amount')::INT,0) INTO v_pot FROM jsonb_array_elements(v_profile.tiers) t
      WHERE v_count >= (t->>'min')::INT AND (t->>'max' IS NULL OR v_count <= (t->>'max')::INT) LIMIT 1;
    ELSIF v_profile.type='funded' THEN
      v_pot := FLOOR(v_count * COALESCE(v_profile.entry_cost,0) * COALESCE(v_profile.redistribution_pct,100) / 100.0);
    END IF;
  ELSE v_pot := COALESCE(v_g.pot_amount, 0);
  END IF;

  -- winners: survivors, else tie-break of the last eliminated group
  SELECT array_agg(user_id) INTO v_winners FROM public.mr_participants WHERE game_id=p_game_id AND status='alive';
  IF v_winners IS NULL THEN
    SELECT max(eliminated_question_seq) INTO v_last_seq FROM public.mr_participants WHERE game_id=p_game_id;
    SELECT EXISTS (SELECT 1 FROM public.fb_fixture_events WHERE api_fixture_id=v_g.api_fixture_id AND type='Goal') INTO v_had_goal;
    v_tb_key := CASE WHEN v_had_goal THEN 'yes' ELSE 'no' END;
    SELECT array_agg(p.user_id) INTO v_winners
    FROM public.mr_participants p
    JOIN public.mr_questions tq ON tq.game_id=p_game_id AND tq.is_tie_break
    JOIN public.mr_answers a ON a.question_id=tq.id AND a.user_id=p.user_id
    WHERE p.game_id=p_game_id AND p.eliminated_question_seq=v_last_seq AND a.option_key=v_tb_key;
  END IF;

  -- pay out (equal split)
  IF v_winners IS NOT NULL AND array_length(v_winners,1) > 0 AND v_pot > 0 THEN
    v_share := FLOOR(v_pot / array_length(v_winners,1));
    FOREACH w IN ARRAY v_winners LOOP
      UPDATE public.mr_participants SET is_winner=true, prize_amount=v_share WHERE game_id=p_game_id AND user_id=w;
      PERFORM public.add_coins(w, v_share, 'challenge_reward', jsonb_build_object('match_royale',p_game_id));
    END LOOP;
  END IF;

  UPDATE public.mr_games SET status='finished', pot_amount=v_pot, updated_at=now() WHERE id=p_game_id;
  RETURN jsonb_build_object('ok',true,'pot',v_pot,'winners',COALESCE(array_length(v_winners,1),0));
END; $$;


--
-- Name: mr_game_counts(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_game_counts(p_game_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT jsonb_build_object(
    'total', (SELECT count(*) FROM public.mr_participants WHERE game_id = p_game_id),
    'alive', (SELECT count(*) FROM public.mr_participants WHERE game_id = p_game_id AND status = 'alive')
  );
$$;


--
-- Name: mr_gen_questions(uuid, text, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_gen_questions(p_game_id uuid, p_phase text, p_half integer, p_count integer, p_start_seq integer) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture UUID; v_home TEXT; v_away TEXT; v_seq INT := p_start_seq; c RECORD; v_opts JSONB;
BEGIN
  SELECT g.fixture_id INTO v_fixture FROM public.mr_games g WHERE g.id = p_game_id;
  SELECT ht.name, at2.name INTO v_home, v_away
  FROM public.fb_fixtures f
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  WHERE f.id = v_fixture;

  FOR c IN SELECT * FROM public.mr_event_catalog WHERE is_active ORDER BY random() LIMIT p_count LOOP
    v_opts := CASE WHEN c.answer_type = 'team'
      THEN jsonb_build_array(jsonb_build_object('key','home','label',COALESCE(v_home,'Home')), jsonb_build_object('key','away','label',COALESCE(v_away,'Away')))
      ELSE jsonb_build_array(jsonb_build_object('key','yes','label','Yes'), jsonb_build_object('key','no','label','No')) END;
    INSERT INTO public.mr_questions (game_id, seq, kind, prompt, options, status, phase, answer_type, catalog_key, half)
    VALUES (p_game_id, v_seq, c.key, c.label, v_opts, 'open', p_phase, c.answer_type, c.key, p_half);
    v_seq := v_seq + 1;
  END LOOP;
END; $$;


--
-- Name: mr_join(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_join(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_g public.mr_games; v_bal INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  IF v_g.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','game not found'); END IF;
  IF v_g.status <> 'open' THEN RETURN jsonb_build_object('ok',false,'error','entries closed'); END IF;
  IF EXISTS (SELECT 1 FROM public.mr_participants WHERE game_id=p_game_id AND user_id=v_user) THEN
    RETURN jsonb_build_object('ok',true,'already',true); END IF;
  IF COALESCE(v_g.entry_cost,0) > 0 THEN
    SELECT coins_balance INTO v_bal FROM public.users WHERE id=v_user;
    IF COALESCE(v_bal,0) < v_g.entry_cost THEN RETURN jsonb_build_object('ok',false,'error','insufficient_coins'); END IF;
    PERFORM public.deduct_coins(v_user, v_g.entry_cost, 'match_royale_entry', jsonb_build_object('game_id',p_game_id));
  END IF;
  INSERT INTO public.mr_participants (game_id, user_id, lives) VALUES (p_game_id, v_user, v_g.hearts);
  RETURN jsonb_build_object('ok',true,'hearts',v_g.hearts);
END; $$;


--
-- Name: mr_question_stats(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_question_stats(p_question_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(jsonb_object_agg(option_key, c), '{}'::jsonb)
  FROM (SELECT option_key, count(*) c FROM public.mr_answers WHERE question_id = p_question_id GROUP BY option_key) s;
$$;


--
-- Name: mr_resolve(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_resolve(p_game_id uuid, p_force_end boolean DEFAULT false) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_g public.mr_games; v_api BIGINT; v_home BIGINT; v_away BIGINT;
  q RECORD; v_correct TEXT; v_src TEXT; v_filter TEXT; vh INT; va INT; bh INT; ba INT;
  v_lo INT; v_hi INT; v_found BOOLEAN; p RECORD;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id = p_game_id;
  SELECT ht.api_id, at2.api_id INTO v_home, v_away
  FROM public.fb_fixtures f LEFT JOIN public.fb_teams ht ON ht.id=f.home_team_id LEFT JOIN public.fb_teams at2 ON at2.id=f.away_team_id
  WHERE f.id = v_g.fixture_id;
  v_api := v_g.api_fixture_id;

  FOR q IN SELECT * FROM public.mr_questions WHERE game_id=p_game_id AND status='open' AND NOT is_tie_break
    AND ( (phase='pre_match' AND v_g.status IN ('first_half','half_time','second_half','finished'))
       OR (phase='half_time' AND v_g.status IN ('second_half','finished')) )
  LOOP
    v_correct := NULL;
    SELECT source_key, detail_filter INTO v_src, v_filter FROM public.mr_event_catalog WHERE key=q.catalog_key;
    IF q.answer_type = 'team' THEN
      bh := COALESCE((q.baseline->>'home')::INT,0); ba := COALESCE((q.baseline->>'away')::INT,0);
      SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_home AND stat_type=v_src),0),
             COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_away AND stat_type=v_src),0)
      INTO vh, va;
      IF (vh > bh) AND (va = ba) THEN v_correct := 'home';
      ELSIF (va > ba) AND (vh = bh) THEN v_correct := 'away';
      ELSIF (vh > bh) AND (va > ba) THEN
        IF p_force_end THEN UPDATE public.mr_questions SET status='void', resolved_at=now() WHERE id=q.id; CONTINUE; END IF;
      END IF;
      IF v_correct IS NULL AND p_force_end THEN UPDATE public.mr_questions SET status='void', resolved_at=now() WHERE id=q.id; CONTINUE; END IF;
    ELSE -- yesno via event in the half range
      IF q.half = 1 THEN v_lo := 0; v_hi := 45; ELSE v_lo := 46; v_hi := 200; END IF;
      SELECT EXISTS (SELECT 1 FROM public.fb_fixture_events WHERE api_fixture_id=v_api AND type=v_src
        AND (v_filter IS NULL OR detail ILIKE '%'||v_filter||'%') AND elapsed BETWEEN v_lo AND v_hi) INTO v_found;
      IF v_found THEN v_correct := 'yes';
      ELSIF p_force_end THEN v_correct := 'no';
      END IF;
    END IF;

    IF v_correct IS NULL THEN CONTINUE; END IF; -- still undetermined

    -- resolve + apply hearts
    UPDATE public.mr_questions SET status='resolved', correct_key=v_correct, resolved_at=now() WHERE id=q.id;
    UPDATE public.mr_answers SET is_correct = (option_key = v_correct) WHERE question_id=q.id;
    FOR p IN SELECT * FROM public.mr_participants WHERE game_id=p_game_id AND status='alive' LOOP
      IF NOT EXISTS (SELECT 1 FROM public.mr_answers WHERE question_id=q.id AND user_id=p.user_id AND option_key=v_correct) THEN
        UPDATE public.mr_participants SET lives = lives - 1,
          status = CASE WHEN lives - 1 <= 0 THEN 'eliminated' ELSE 'alive' END,
          eliminated_at = CASE WHEN lives - 1 <= 0 THEN now() ELSE eliminated_at END,
          eliminated_question_seq = CASE WHEN lives - 1 <= 0 THEN q.seq ELSE eliminated_question_seq END
        WHERE id = p.id;
      END IF;
    END LOOP;
  END LOOP;
END; $$;


--
-- Name: mr_resolve_pot(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_resolve_pot(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_league UUID; v_home UUID; v_away UUID; r RECORD;
BEGIN
  SELECT league_id, home_team_id, away_team_id INTO v_league, v_home, v_away FROM public.fb_fixtures WHERE id = p_fixture_id;
  -- match
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='match' AND fixture_id=p_fixture_id LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','match','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- team
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='team' AND team_id IN (v_home, v_away) LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','team','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- league
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='league' AND league_id=v_league LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','league','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  -- global
  SELECT * INTO r FROM public.mr_pot_assignments WHERE is_active AND scope='global' LIMIT 1;
  IF FOUND THEN RETURN jsonb_build_object('scope','global','pot_profile_id',r.pot_profile_id,'override_amount',r.override_amount); END IF;
  RETURN jsonb_build_object('scope', null);
END; $$;


--
-- Name: mr_results(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_results(p_fixture_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g RECORD; v_stats JSONB; v_lb JSONB; v_uid UUID := auth.uid();
BEGIN
  SELECT * INTO g FROM mr_games WHERE fixture_id = p_fixture_id ORDER BY created_at DESC LIMIT 1;
  IF g.id IS NULL THEN RETURN NULL; END IF;
  v_stats := g.crowd_stats;
  IF v_stats IS NULL AND g.status = 'finished' THEN
    v_stats := compute_mr_crowd_stats(g.id);
    UPDATE mr_games SET crowd_stats = v_stats WHERE id = g.id;
  END IF;
  SELECT jsonb_agg(jsonb_build_object(
    'user_id', p.user_id, 'username', COALESCE(pr.username, 'Player'),
    'is_winner', p.is_winner, 'lives', p.lives, 'status', p.status,
    'eliminated_seq', p.eliminated_question_seq, 'prize', p.prize_amount,
    'is_me', p.user_id = v_uid)
    ORDER BY p.is_winner DESC, p.eliminated_question_seq DESC NULLS FIRST, p.eliminated_at DESC NULLS FIRST)
  INTO v_lb FROM mr_participants p LEFT JOIN profiles pr ON pr.id = p.user_id
  WHERE p.game_id = g.id;
  RETURN jsonb_build_object('game_type', 'match_royale', 'game_id', g.id,
    'status', g.status, 'crowd_stats', v_stats,
    'i_played', EXISTS(SELECT 1 FROM mr_participants WHERE game_id = g.id AND user_id = v_uid),
    'leaderboard', COALESCE(v_lb, '[]'::jsonb));
END $$;


--
-- Name: mr_snapshot_baselines(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_snapshot_baselines(p_game_id uuid, p_phase text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_api BIGINT; v_home BIGINT; v_away BIGINT; q RECORD; vh INT; va INT;
BEGIN
  SELECT g.api_fixture_id, ht.api_id, at2.api_id INTO v_api, v_home, v_away
  FROM public.mr_games g
  JOIN public.fb_fixtures f ON f.id = g.fixture_id
  LEFT JOIN public.fb_teams ht ON ht.id = f.home_team_id
  LEFT JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  WHERE g.id = p_game_id;
  FOR q IN SELECT * FROM public.mr_questions WHERE game_id=p_game_id AND phase=p_phase AND answer_type='team' AND NOT is_tie_break LOOP
    SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_home AND stat_type=public.mr_source_key(q.catalog_key)),0) INTO vh;
    SELECT COALESCE((SELECT stat_value::INT FROM public.fb_fixture_statistics WHERE api_fixture_id=v_api AND team_api_id=v_away AND stat_type=public.mr_source_key(q.catalog_key)),0) INTO va;
    UPDATE public.mr_questions SET baseline = jsonb_build_object('home',vh,'away',va) WHERE id=q.id;
  END LOOP;
END; $$;


--
-- Name: mr_source_key(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_source_key(p_catalog_key text) RETURNS text
    LANGUAGE sql STABLE
    AS $$ SELECT source_key FROM public.mr_event_catalog WHERE key = p_catalog_key $$;


--
-- Name: mr_tick(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_tick(p_game_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_g public.mr_games; v_status TEXT;
BEGIN
  SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  IF v_g.status IN ('finished','cancelled') THEN RETURN; END IF;
  SELECT status INTO v_status FROM public.fb_fixtures WHERE id=v_g.fixture_id;

  -- open -> first_half (kickoff): lock pre-match, snapshot baselines
  IF v_g.status='open' AND v_status IN ('1H','LIVE','HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_snapshot_baselines(p_game_id,'pre_match');
    UPDATE public.mr_games SET status='first_half', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- first_half -> half_time (HT): resolve half 1, generate half-time questions
  IF v_g.status='first_half' AND v_status IN ('HT','2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_resolve(p_game_id, true);
    IF NOT EXISTS (SELECT 1 FROM public.mr_questions WHERE game_id=p_game_id AND phase='half_time') THEN
      PERFORM public.mr_gen_questions(p_game_id, 'half_time', 2, (SELECT questions_half FROM public.mr_config WHERE id=1), 50);
    END IF;
    UPDATE public.mr_games SET status='half_time', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- half_time -> second_half (2H): lock half-time answers, snapshot baselines
  IF v_g.status='half_time' AND v_status IN ('2H','ET','BT','P','FT','AET','PEN') THEN
    PERFORM public.mr_snapshot_baselines(p_game_id,'half_time');
    UPDATE public.mr_games SET status='second_half', updated_at=now() WHERE id=p_game_id;
    SELECT * INTO v_g FROM public.mr_games WHERE id=p_game_id;
  END IF;

  -- resolve in-progress
  IF v_g.status IN ('first_half','second_half') THEN
    PERFORM public.mr_resolve(p_game_id, false);
  END IF;

  -- full time -> resolve remainder + finalize
  IF v_status IN ('FT','AET','PEN') AND v_g.status NOT IN ('finished','cancelled','open') THEN
    PERFORM public.mr_resolve(p_game_id, true);
    PERFORM public.mr_finalize(p_game_id);
  END IF;
END; $$;


--
-- Name: mr_tick_all(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.mr_tick_all() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g UUID; n INTEGER := 0;
BEGIN
  FOR g IN SELECT id FROM public.mr_games WHERE status NOT IN ('finished','cancelled') LOOP
    BEGIN PERFORM public.mr_tick(g); n := n + 1; EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'mr_tick % failed: %', g, SQLERRM; END;
  END LOOP;
  RETURN n;
END $$;


--
-- Name: normalize_name(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.normalize_name(name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT LOWER(
    translate(name,
      'ÁÀÂÄÃÅÉÈÊËÍÌÎÏÓÒÔÖÕÚÙÛÜÑÇŠŽáàâäãåéèêëíìîïóòôöõúùûüñçšž',
      'AAAAAAEEEEIIIIOOOOOUUUUNCSZaaaaaaeeeeiiiiooooouuuuncsz'
    )
  );
$$;


--
-- Name: FUNCTION normalize_name(name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.normalize_name(name text) IS 'Removes accents and converts to lowercase for name matching';


--
-- Name: on_swipe_prediction_change(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.on_swipe_prediction_change() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
    -- Update matchday participant stats
    PERFORM update_matchday_participant_stats(NEW.matchday_id, NEW.user_id);

    -- Update challenge participant total points
    PERFORM update_challenge_participant_points(NEW.challenge_id, NEW.user_id);

    RETURN NEW;
END;
$$;


--
-- Name: participant_qualifies_for_reward(integer, integer, text, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer DEFAULT NULL::integer) RETURNS boolean
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_percentage NUMERIC;
BEGIN
  CASE p_position_type
    WHEN 'rank' THEN
      -- Exact rank (e.g., rank 1)
      RETURN (p_rank = p_tier_start);

    WHEN 'range' THEN
      -- Range of ranks (e.g., ranks 1-10)
      IF p_tier_end IS NULL THEN
        RETURN (p_rank = p_tier_start);
      ELSE
        RETURN (p_rank >= p_tier_start AND p_rank <= p_tier_end);
      END IF;

    WHEN 'percent' THEN
      -- Top X% (e.g., top 10%)
      IF p_total_participants = 0 THEN
        RETURN FALSE;
      END IF;
      v_percentage := (p_rank::NUMERIC / p_total_participants::NUMERIC) * 100;
      RETURN (v_percentage <= p_tier_start);

    ELSE
      RETURN FALSE;
  END CASE;
END;
$$;


--
-- Name: FUNCTION participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer) IS 'Checks if a participant qualifies for a reward tier based on rank/range/percent';


--
-- Name: place_challenge_bets(uuid, uuid, integer, jsonb, jsonb, text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb DEFAULT NULL::jsonb, p_entry_method text DEFAULT 'coins'::text, p_ticket_id uuid DEFAULT NULL::uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_status TEXT; v_rules JSONB; v_budget INTEGER; v_total INTEGER := 0;
  v_entry UUID; v_daily UUID; v_bet JSONB; v_fix_date TIMESTAMPTZ; v_odds RECORD;
  v_booster_type TEXT := NULL; v_booster_match UUID := NULL;
  v_fixture UUID; v_pred TEXT; v_amount INTEGER;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT status::text, rules INTO v_status, v_rules FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_status = 'finished' THEN RAISE EXCEPTION 'challenge_finished'; END IF;

  v_budget := COALESCE((v_rules->>'challengeBalance')::int, 1000);
  SELECT COALESCE(SUM((b->>'amount')::int), 0) INTO v_total
  FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) b;
  IF v_total > v_budget THEN RAISE EXCEPTION 'over_budget'; END IF;

  IF p_booster IS NOT NULL AND p_booster ? 'type' THEN
    v_booster_type := p_booster->>'type';
    v_booster_match := NULLIF(p_booster->>'matchId', '')::uuid;
  END IF;

  -- Validate every fixture: exists, not started, AND has real odds.
  FOR v_bet IN SELECT value FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) AS value
  LOOP
    v_fixture := (v_bet->>'challengeMatchId')::uuid;
    SELECT f.date INTO v_fix_date FROM public.fb_fixtures f WHERE f.id = v_fixture;
    IF NOT FOUND THEN RAISE EXCEPTION 'fixture_not_found'; END IF;
    IF v_fix_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.fb_odds WHERE fixture_id = v_fixture AND home_win IS NOT NULL) THEN
      RAISE EXCEPTION 'odds_not_ready';
    END IF;
  END LOOP;

  INSERT INTO public.challenge_entries (challenge_id, user_id, entry_method, ticket_id)
  VALUES (p_challenge_id, p_user_id, p_entry_method, p_ticket_id)
  ON CONFLICT (challenge_id, user_id) DO UPDATE SET updated_at = now()
  RETURNING id INTO v_entry;

  INSERT INTO public.challenge_daily_entries (challenge_entry_id, day_number, booster_type, booster_match_id)
  VALUES (v_entry, p_day_number, v_booster_type, v_booster_match)
  ON CONFLICT (challenge_entry_id, day_number) DO UPDATE
    SET booster_type = EXCLUDED.booster_type, booster_match_id = EXCLUDED.booster_match_id, updated_at = now()
  RETURNING id INTO v_daily;

  DELETE FROM public.challenge_bets WHERE daily_entry_id = v_daily;

  FOR v_bet IN SELECT value FROM jsonb_array_elements(COALESCE(p_bets, '[]'::jsonb)) AS value
  LOOP
    v_fixture := (v_bet->>'challengeMatchId')::uuid;
    v_pred := v_bet->>'prediction';
    v_amount := (v_bet->>'amount')::int;

    SELECT o.home_win, o.draw, o.away_win INTO v_odds
    FROM public.fb_odds o
    WHERE o.fixture_id = v_fixture AND o.home_win IS NOT NULL
    ORDER BY CASE o.bookmaker_name WHEN 'Pinnacle' THEN 0 WHEN 'Bet365' THEN 1 ELSE 2 END, o.updated_at DESC
    LIMIT 1;

    INSERT INTO public.challenge_bets (daily_entry_id, challenge_match_id, prediction, amount, odds_snapshot, status)
    VALUES (v_daily, v_fixture, v_pred, v_amount,
      jsonb_build_object('teamA', v_odds.home_win, 'draw', v_odds.draw, 'teamB', v_odds.away_win), 'pending');
  END LOOP;

  RETURN v_daily;
END;
$$;


--
-- Name: place_match_bet(uuid, text, integer, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_match_bet(p_fixture_id uuid, p_prediction text, p_amount integer, p_odds numeric) RETURNS TABLE(success boolean, new_balance integer, bet_id uuid)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  v_user      uuid := auth.uid();
  v_level     text;
  v_limit     integer;
  v_balance   integer;
  v_kickoff   timestamptz;
  v_status    text;
  v_existing  public.match_bets%rowtype;
  v_refund    integer := 0;
  v_potential integer;
  v_bet_id    uuid;
begin
  if v_user is null then raise exception 'Not authenticated'; end if;
  if p_prediction not in ('teamA','draw','teamB') then raise exception 'Invalid prediction'; end if;
  if p_amount <= 0 then raise exception 'Amount must be positive'; end if;

  -- Fixture must exist and not have started yet.
  select date, status into v_kickoff, v_status
    from public.fb_fixtures where id = p_fixture_id;
  if not found then raise exception 'Fixture not found'; end if;
  if v_kickoff <= now() or coalesce(v_status, 'NS') <> 'NS' then
    raise exception 'Match already started';
  end if;

  -- Server-side per-level limit (read the same value the client uses).
  select coalesce(nullif(trim(current_level::text), ''), nullif(trim(level_name::text), ''))
    into v_level from public.users where id = v_user;
  v_limit := public.match_bet_limit_for_level(v_level);
  if v_limit is not null and p_amount > v_limit then
    raise exception 'Amount exceeds your level limit of % coins', v_limit;
  end if;

  -- Existing pending bet on this fixture? It gets refunded then replaced.
  select * into v_existing from public.match_bets
    where user_id = v_user and fixture_id = p_fixture_id for update;
  if found then
    if v_existing.status <> 'pending' then raise exception 'Bet already settled'; end if;
    v_refund := v_existing.amount;
  end if;

  -- Balance check (available = current balance + refund of the old bet).
  select coins_balance into v_balance from public.users where id = v_user for update;
  if (v_balance + v_refund) < p_amount then
    raise exception 'Insufficient balance';
  end if;

  v_potential := ceil(p_amount * p_odds)::integer;

  -- Apply the coin movement atomically.
  update public.users
    set coins_balance = coins_balance + v_refund - p_amount
    where id = v_user
    returning coins_balance into v_balance;

  -- Upsert the bet.
  insert into public.match_bets(user_id, fixture_id, prediction, amount, odds, potential_win, status, updated_at)
    values (v_user, p_fixture_id, p_prediction, p_amount, p_odds, v_potential, 'pending', now())
  on conflict (user_id, fixture_id) do update
    set prediction    = excluded.prediction,
        amount        = excluded.amount,
        odds          = excluded.odds,
        potential_win = excluded.potential_win,
        status        = 'pending',
        updated_at    = now()
  returning id into v_bet_id;

  return query select true, v_balance, v_bet_id;
end;
$$;


--
-- Name: place_swipe_prediction(uuid, uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_status TEXT; v_date TIMESTAMPTZ; v_odds RECORD; v_snapshot JSONB;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_prediction NOT IN ('home', 'draw', 'away') THEN RAISE EXCEPTION 'invalid_prediction'; END IF;

  SELECT status::text INTO v_status FROM public.challenges WHERE id = p_challenge_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Challenge not found'; END IF;
  IF v_status = 'finished' THEN RAISE EXCEPTION 'challenge_finished'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id
  ) THEN RAISE EXCEPTION 'not_joined'; END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.matchday_fixtures
    WHERE matchday_id = p_matchday_id AND fixture_id = p_fixture_id
  ) THEN RAISE EXCEPTION 'fixture_not_in_matchday'; END IF;

  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'fixture_not_found'; END IF;
  IF v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  SELECT o.home_win, o.draw, o.away_win INTO v_odds
  FROM public.fb_odds o
  WHERE o.fixture_id = p_fixture_id AND o.home_win IS NOT NULL
  ORDER BY CASE o.bookmaker_name WHEN 'Pinnacle' THEN 0 WHEN 'Bet365' THEN 1 ELSE 2 END,
           o.updated_at DESC
  LIMIT 1;

  -- No real odds → not pickable yet (the UI shows "odds loading" + triggers a sync).
  IF v_odds.home_win IS NULL THEN RAISE EXCEPTION 'odds_not_ready'; END IF;
  v_snapshot := jsonb_build_object('home', v_odds.home_win, 'draw', v_odds.draw, 'away', v_odds.away_win);

  INSERT INTO public.swipe_predictions (challenge_id, matchday_id, user_id, fixture_id, prediction, odds_at_prediction)
  VALUES (p_challenge_id, p_matchday_id, p_user_id, p_fixture_id, p_prediction, v_snapshot)
  ON CONFLICT (challenge_id, user_id, fixture_id) DO UPDATE
  SET prediction = EXCLUDED.prediction,
      odds_at_prediction = EXCLUDED.odds_at_prediction,
      is_correct = NULL,
      points_earned = 0,
      updated_at = now();
END;
$$;


--
-- Name: premium_cfg_int(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.premium_cfg_int(p_key text, p_default integer) RETURNS integer
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(
    (SELECT (value #>> '{}')::int FROM public.game_config
     WHERE category = 'premium' AND key = p_key AND is_active),
    p_default);
$$;


--
-- Name: premium_daily_claim(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.premium_daily_claim() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user     UUID := auth.uid();
  v_is_sub   BOOLEAN;
  v_coins    INT;
  v_spins    INT;
  v_tickets  INT;
  v_exp_days INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;

  SELECT is_subscriber INTO v_is_sub FROM public.profiles WHERE id = v_user;
  IF NOT COALESCE(v_is_sub, false) THEN
    RETURN jsonb_build_object('ok', false, 'error', 'not_premium');
  END IF;

  v_coins    := public.premium_cfg_int('daily_stipend_coins', 200);
  v_spins    := public.premium_cfg_int('daily_spins', 1);
  v_tickets  := public.premium_cfg_int('daily_tickets', 1);
  v_exp_days := public.premium_cfg_int('ticket_expiry_days', 14);

  INSERT INTO public.premium_daily_claims (user_id, claim_date, coins, spins)
  VALUES (v_user, current_date, v_coins, v_spins)
  ON CONFLICT (user_id, claim_date) DO NOTHING;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', true, 'already', true);
  END IF;

  IF v_coins > 0 THEN
    PERFORM public.add_coins(v_user, v_coins, 'premium_bonus',
      jsonb_build_object('kind', 'daily_stipend', 'date', current_date::text));
  END IF;
  IF v_spins > 0 THEN
    PERFORM public.update_available_spins(v_user, 'premium'::public.spin_tier, v_spins);
  END IF;
  IF v_tickets > 0 THEN
    INSERT INTO public.user_tickets (user_id, ticket_type, expires_at)
    SELECT v_user, 'premium'::public.ticket_type, now() + (v_exp_days || ' days')::interval
    FROM generate_series(1, v_tickets);
  END IF;

  RETURN jsonb_build_object('ok', true, 'already', false,
    'coins', v_coins, 'spins', v_spins, 'tickets', v_tickets);
END $$;


--
-- Name: puzzle_admin_reset_plays(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_admin_reset_plays() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n INTEGER;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'admin only'; END IF;
  DELETE FROM public.puzzle_plays WHERE id IS NOT NULL;
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;


--
-- Name: puzzle_current_date(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_current_date() RETURNS date
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT (now() - make_interval(hours => (SELECT daily_cutover_hour FROM public.puzzle_config WHERE id = 1)))::date;
$$;


--
-- Name: puzzle_distribute_daily(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_distribute_daily(p_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cfg public.puzzle_config; lvl TEXT; v_game UUID; v_prize public.puzzle_daily_prizes;
  v_n INT; v_top INT; v_share INT; r RECORD; v_out JSONB := '[]'::jsonb;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  FOREACH lvl IN ARRAY ARRAY['easy','medium','hard'] LOOP
    SELECT id INTO v_game FROM public.puzzle_games WHERE game_type='guess_score' AND level=lvl AND puzzle_date=p_date;
    IF v_game IS NULL THEN CONTINUE; END IF;
    SELECT * INTO v_prize FROM public.puzzle_daily_prizes WHERE level=lvl AND puzzle_date=p_date;
    IF v_prize.id IS NULL THEN
      IF NOT v_cfg.prize_enabled OR v_cfg.prize_pot_default <= 0 THEN CONTINUE; END IF;
      INSERT INTO public.puzzle_daily_prizes (level, puzzle_date, pot, top_pct)
      VALUES (lvl, p_date, v_cfg.prize_pot_default, v_cfg.prize_top_pct) RETURNING * INTO v_prize;
    END IF;
    IF v_prize.distributed OR v_prize.pot <= 0 THEN CONTINUE; END IF;

    SELECT count(*) INTO v_n FROM public.puzzle_plays WHERE game_id=v_game AND finished_at IS NOT NULL;
    IF v_n = 0 THEN UPDATE public.puzzle_daily_prizes SET distributed=true, distributed_at=now(), winners=0 WHERE id=v_prize.id; CONTINUE; END IF;
    v_top := GREATEST(1, CEIL(v_n * v_prize.top_pct / 100.0)::int);
    v_share := FLOOR(v_prize.pot / v_top);
    FOR r IN SELECT user_id FROM public.puzzle_plays WHERE game_id=v_game AND finished_at IS NOT NULL
             ORDER BY score DESC, total_time_ms ASC LIMIT v_top LOOP
      PERFORM public.add_coins(r.user_id, v_share, 'challenge_reward', jsonb_build_object('puzzle_daily', p_date, 'level', lvl));
    END LOOP;
    UPDATE public.puzzle_daily_prizes SET distributed=true, distributed_at=now(), winners=v_top WHERE id=v_prize.id;
    v_out := v_out || jsonb_build_object('level', lvl, 'winners', v_top, 'share', v_share);
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'date', p_date, 'results', v_out);
END $$;


--
-- Name: puzzle_finish(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_finish(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_cfg public.puzzle_config; v_game public.puzzle_games;
  v_solved INT; v_time INT; v_score INT; v_total INT; v_better INT; v_avg INT;
  v_prog public.puzzle_progress; v_date DATE; v_missed INT; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false;
  v_free_every INT; v_free_max INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT free_every, free_max INTO v_free_every, v_free_max FROM public.freeze_params(v_user, v_cfg.freeze_every_days, v_cfg.max_freezes);
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;

  IF v_play.finished_at IS NULL THEN
    SELECT count(*) FILTER (WHERE solved) INTO v_solved FROM public.puzzle_round_attempts WHERE play_id=v_play.id;
    v_time := GREATEST(0, EXTRACT(EPOCH FROM (now() - v_play.started_at))::int * 1000);
    v_score := v_solved * 1000 - LEAST(900, v_time / 1000);
    UPDATE public.puzzle_plays SET finished_at=now(), total_time_ms=v_time, rounds_solved=v_solved, score=v_score WHERE id=v_play.id;
    v_date := v_game.puzzle_date;
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE
      v_missed := (v_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_free_every = 0 AND v_freezes < v_free_max THEN v_freezes := v_freezes + 1; v_freeze_gained := true; END IF;
    INSERT INTO public.puzzle_progress (user_id, game_type, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.game_type, v_game.level, v_streak, v_streak, v_freezes, v_date, 1, CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END, v_score)
    ON CONFLICT (user_id, game_type, level) DO UPDATE SET
      current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak), freezes=v_freezes,
      last_played=v_date, games_played=public.puzzle_progress.games_played+1,
      games_won=public.puzzle_progress.games_won + CASE WHEN v_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END,
      total_score=public.puzzle_progress.total_score + v_score, updated_at=now();
    SELECT * INTO v_play FROM public.puzzle_plays WHERE id=v_play.id;
  END IF;

  SELECT count(*), avg(total_time_ms)::int INTO v_total, v_avg FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  SELECT count(*) INTO v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL AND score > v_play.score;
  SELECT current_streak, freezes INTO v_streak, v_freezes FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
  RETURN jsonb_build_object('ok', true, 'rounds_solved', v_play.rounds_solved, 'time_ms', v_play.total_time_ms, 'score', v_play.score,
    'total_players', v_total, 'avg_time_ms', v_avg,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'streak', v_streak, 'freezes', v_freezes, 'freeze_gained', v_freeze_gained);
END $$;


--
-- Name: puzzle_finish_player(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_finish_player(p_game_id uuid, p_rounds_solved integer, p_time_ms integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_cfg public.puzzle_config; v_game public.puzzle_games;
  v_score INT; v_total INT; v_better INT; v_avg INT; v_prog public.puzzle_progress; v_date DATE; v_missed INT; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false;
  v_free_every INT; v_free_max INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT free_every, free_max INTO v_free_every, v_free_max FROM public.freeze_params(v_user, v_cfg.freeze_every_days, v_cfg.max_freezes);
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;

  IF v_play.finished_at IS NULL THEN
    v_score := GREATEST(0, p_rounds_solved) * 1000 - LEAST(900, GREATEST(0, p_time_ms) / 1000);
    UPDATE public.puzzle_plays SET finished_at=now(), total_time_ms=GREATEST(0,p_time_ms), rounds_solved=GREATEST(0,p_rounds_solved), score=v_score WHERE id=v_play.id;
    v_date := v_game.puzzle_date;
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE
      v_missed := (v_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_free_every = 0 AND v_freezes < v_free_max THEN v_freezes := v_freezes + 1; v_freeze_gained := true; END IF;
    INSERT INTO public.puzzle_progress (user_id, game_type, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.game_type, v_game.level, v_streak, v_streak, v_freezes, v_date, 1, CASE WHEN p_rounds_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END, v_score)
    ON CONFLICT (user_id, game_type, level) DO UPDATE SET
      current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak), freezes=v_freezes,
      last_played=v_date, games_played=public.puzzle_progress.games_played+1,
      games_won=public.puzzle_progress.games_won + CASE WHEN p_rounds_solved = v_cfg.rounds_per_game THEN 1 ELSE 0 END,
      total_score=public.puzzle_progress.total_score + v_score, updated_at=now();
    SELECT * INTO v_play FROM public.puzzle_plays WHERE id=v_play.id;
  END IF;

  SELECT count(*), avg(total_time_ms)::int INTO v_total, v_avg FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  SELECT count(*) INTO v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL AND score > v_play.score;
  SELECT current_streak, freezes INTO v_streak, v_freezes FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
  RETURN jsonb_build_object('ok', true, 'rounds_solved', v_play.rounds_solved, 'time_ms', v_play.total_time_ms, 'score', v_play.score,
    'total_players', v_total, 'avg_time_ms', v_avg,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'streak', v_streak, 'freezes', v_freezes, 'freeze_gained', v_freeze_gained);
END $$;


--
-- Name: puzzle_generate_guess_player(text, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_generate_guess_player(p_level text, p_count integer, p_start_date date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cfg public.puzzle_config; v_floor NUMERIC; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD; v_trail JSONB; v_era TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  -- big = the trail contains a club with popularity >= 78; all = no restriction
  v_floor := CASE p_level WHEN 'big' THEN 78 ELSE 0 END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_player';

  CREATE TEMP TABLE _pcand ON COMMIT DROP AS
  WITH club_noto AS (
    SELECT t.player_id, max(COALESCE(tp.popularity, 30)) AS noto
    FROM (SELECT player_id, team_in_api AS api FROM public.fb_transfers WHERE team_in_api IS NOT NULL
          UNION ALL SELECT player_id, team_out_api FROM public.fb_transfers WHERE team_out_api IS NOT NULL) t
    LEFT JOIN public.team_popularity tp ON tp.team_api_id = t.api
    GROUP BY t.player_id
  ),
  pstats AS (
    SELECT pss.player_id, mode() WITHIN GROUP (ORDER BY pss.position) pos, min(pss.season) smin, max(pss.season) smax,
           (SELECT count(*) FROM public.fb_transfers tt WHERE tt.player_id = pss.player_id) tcount
    FROM public.fb_player_season_stats pss GROUP BY pss.player_id
  )
  SELECT p.api_id AS id, p.name, p.photo, p.nationality, cn.noto, ps.pos, ps.smin, ps.smax
  FROM public.fb_players p
  JOIN pstats ps ON ps.player_id = p.api_id
  LEFT JOIN club_noto cn ON cn.player_id = p.api_id
  WHERE COALESCE(cn.noto,0) >= v_floor AND ps.tcount >= 2
    AND p.api_id NOT IN (SELECT answer_player_id FROM public.puzzle_rounds WHERE answer_player_id IS NOT NULL);

  FOR rec IN SELECT * FROM _pcand ORDER BY random() LIMIT v_need * 2 LOOP
    v_trail := public.puzzle_player_trail(rec.id);
    IF jsonb_array_length(v_trail) < 3 THEN CONTINUE; END IF;
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_player', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    v_era := CASE WHEN rec.smin = rec.smax THEN rec.smin::text ELSE rec.smin::text || '–' || rec.smax::text END;
    INSERT INTO public.puzzle_rounds (game_id, round_no, answer_player_id, payload)
    VALUES (v_gid, v_rn, rec.id, jsonb_build_object('trail', v_trail,
      'hints', jsonb_build_array(
        jsonb_build_object('k','Position','v', COALESCE(rec.pos,'—')),
        jsonb_build_object('k','Nationality','v', COALESCE(NULLIF(rec.nationality,'Unknown'),'—')),
        jsonb_build_object('k','Era','v', v_era))));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; IF v_games >= p_count THEN EXIT; END IF; END IF;
  END LOOP;
  RETURN v_games;
END $$;


--
-- Name: puzzle_generate_guess_score(text, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_generate_guess_score(p_level text, p_count integer, p_start_date date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cfg public.puzzle_config; v_floor NUMERIC; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_floor := CASE p_level WHEN 'big' THEN v_cfg.pop_floor_big ELSE v_cfg.pop_floor_all END;
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level = p_level AND game_type = 'guess_score';

  CREATE TEMP TABLE _cand ON COMMIT DROP AS
  SELECT f.id AS fixture_id, f.season, f.date, f.round, f.goals_home, f.goals_away,
         ht.api_id AS ha, ht.name AS hn, ht.logo_url AS hl, at2.api_id AS aa, at2.name AS an, at2.logo_url AS al, lg.name AS comp,
         (COALESCE(ph.popularity,50) + COALESCE(pa.popularity,50)) / 2.0 AS popm
  FROM public.fb_fixtures f
  JOIN public.fb_teams ht ON ht.id = f.home_team_id
  JOIN public.fb_teams at2 ON at2.id = f.away_team_id
  LEFT JOIN public.fb_leagues lg ON lg.id = f.league_id
  LEFT JOIN public.team_popularity ph ON ph.team_api_id = ht.api_id
  LEFT JOIN public.team_popularity pa ON pa.team_api_id = at2.api_id
  WHERE f.season IS NOT NULL AND f.status='FT' AND f.goals_home IS NOT NULL AND f.goals_away IS NOT NULL
    AND f.id NOT IN (SELECT fixture_id FROM public.puzzle_rounds WHERE fixture_id IS NOT NULL);

  FOR rec IN SELECT * FROM _cand WHERE popm >= v_floor ORDER BY random() LIMIT v_need LOOP
    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_score', p_level, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, fixture_id, home_team_api, home_name, home_logo,
      away_team_api, away_name, away_logo, season, competition_name, stage, match_date, answer_home, answer_away, hints, difficulty_score)
    VALUES (v_gid, v_rn, rec.fixture_id, rec.ha, rec.hn, rec.hl, rec.aa, rec.an, rec.al, rec.season,
      COALESCE(rec.comp, 'La Liga'),
      CASE WHEN rec.round ILIKE 'Regular Season -%' THEN replace(rec.round, 'Regular Season - ', 'Matchday ') ELSE rec.round END,
      rec.date::date, rec.goals_home, rec.goals_away, public.puzzle_hints(rec.goals_home, rec.goals_away), round(rec.popm,1));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; END IF;
  END LOOP;
  RETURN v_games;
END $$;


--
-- Name: puzzle_generate_player_tm(text, integer, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_generate_player_tm(p_scope text, p_count integer, p_start_date date) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_cfg public.puzzle_config; v_floor BIGINT; v_need INT; v_seq INT; v_games INT := 0; v_gid UUID; v_rn INT := 0; rec RECORD; v_trail JSONB; v_era TEXT;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  v_floor := CASE p_scope WHEN 'big' THEN 15000000 ELSE 0 END;   -- big = ≥ €15M current value
  v_need := p_count * v_cfg.rounds_per_game;
  SELECT COALESCE(max(seq), 0) INTO v_seq FROM public.puzzle_games WHERE level=p_scope AND game_type='guess_player';

  FOR rec IN
    SELECT p.player_id, p.name, p.position, p.nationality
    FROM public.tm_players p
    WHERE p.name IS NOT NULL AND COALESCE(p.current_market_value_eur,0) >= v_floor
      AND p.player_id NOT IN (SELECT answer_player_id FROM public.puzzle_rounds WHERE answer_player_id IS NOT NULL)
      AND (SELECT count(*) FROM public.tm_transfers t WHERE t.player_id=p.player_id) >= 3
    ORDER BY random() LIMIT v_need * 3            -- oversample; many get filtered by trail length
  LOOP
    v_trail := public.tm_player_trail(rec.player_id);
    CONTINUE WHEN jsonb_array_length(v_trail) < 3;       -- need a real trail
    SELECT (min(date_part('year', transfer_date))::int)::text || '–' || (max(date_part('year', transfer_date))::int)::text
      INTO v_era FROM public.tm_transfers WHERE player_id=rec.player_id AND transfer_date IS NOT NULL;

    IF v_rn = 0 THEN
      v_seq := v_seq + 1; v_games := v_games + 1;
      INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status)
      VALUES ('guess_player', p_scope, p_start_date + (v_games - 1), v_seq, 'scheduled') RETURNING id INTO v_gid;
    END IF;
    v_rn := v_rn + 1;
    INSERT INTO public.puzzle_rounds (game_id, round_no, answer_player_id, payload)
    VALUES (v_gid, v_rn, rec.player_id, jsonb_build_object(
      'trail', v_trail,
      'hints', jsonb_build_array(
        jsonb_build_object('k','Position','v', COALESCE(rec.position,'—')),
        jsonb_build_object('k','Nationality','v', COALESCE(rec.nationality,'—')),
        jsonb_build_object('k','Era','v', COALESCE(v_era,'—')))));
    IF v_rn = v_cfg.rounds_per_game THEN v_rn := 0; END IF;
    EXIT WHEN v_games >= p_count AND v_rn = 0;
  END LOOP;
  RETURN v_games;
END $$;


--
-- Name: puzzle_get_today(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today(p_level text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT; v_hint TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level, hint INTO v_scope, v_hint FROM public.puzzle_user_prefs WHERE user_id = v_user AND game_type='guess_score';
  v_has := (v_scope IS NOT NULL);
  v_scope := COALESCE(p_level, v_scope, 'big'); v_hint := COALESCE(v_hint, 'easy');
  IF p_level IS NOT NULL THEN
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'guess_score', p_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_score' AND level=v_scope AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date,
    'config', jsonb_build_object('max_attempts', v_cfg.max_attempts, 'heat_bands', v_cfg.heat_bands, 'rounds', v_cfg.rounds_per_game),
    'play', jsonb_build_object('id', v_play.id, 'started_at', v_play.started_at, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id, 'difficulty', v_game.difficulty_score),
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
        'round_no', r.round_no, 'home_name', r.home_name, 'home_logo', r.home_logo,
        'away_name', r.away_name, 'away_logo', r.away_logo, 'season', r.season,
        'competition', r.competition_name, 'stage', r.stage, 'match_date', r.match_date, 'hints', r.hints,
        'attempt', (SELECT jsonb_build_object('guesses', a.guesses, 'solved', a.solved, 'attempts', a.attempts)
                    FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no),
        'reveal', (SELECT CASE WHEN a.solved OR (v_cfg.max_attempts > 0 AND a.attempts >= v_cfg.max_attempts) OR v_play.finished_at IS NOT NULL
                     THEN jsonb_build_object('home', r.answer_home, 'away', r.answer_away) ELSE NULL END
                   FROM public.puzzle_round_attempts a WHERE a.play_id=v_play.id AND a.round_no=r.round_no)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;


--
-- Name: puzzle_get_today_connections(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_connections() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='connections' AND level='daily' AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='connections' AND level='daily'),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;


--
-- Name: puzzle_get_today_grid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_grid() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='grid' AND level='daily' AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='grid' AND level='daily'),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;


--
-- Name: puzzle_get_today_grid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_grid(p_level text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT level INTO v_level FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='grid';
  v_has := (v_level IS NOT NULL);
  IF p_level IS NOT NULL THEN
    v_level := p_level;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'grid', v_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_level := COALESCE(v_level, 'medium');
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='grid' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='grid' AND level=v_level),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;


--
-- Name: puzzle_get_today_hl(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_hl(p_criterion text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_crit TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT level INTO v_crit FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='higherlower';
  v_has := (v_crit IS NOT NULL);
  IF p_criterion IS NOT NULL THEN
    v_crit := p_criterion;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'higherlower', v_crit)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_crit := COALESCE(v_crit, 'value');
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN
    INSERT INTO public.puzzle_games (game_type, level, puzzle_date, seq, status) VALUES ('higherlower', v_crit, v_date, 1, 'live')
    ON CONFLICT (game_type, level, puzzle_date) DO NOTHING;
    SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit AND puzzle_date=v_date;
  END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'criterion', v_crit, 'has_prefs', v_has, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'best', (SELECT max(score) FROM public.puzzle_plays WHERE user_id=v_user AND game_id IN (SELECT id FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_crit)),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user)
  );
END $$;


--
-- Name: puzzle_get_today_lineup(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_lineup(p_scope text DEFAULT NULL::text, p_holes integer DEFAULT NULL::integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_scope TEXT; v_holes INT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level INTO v_level FROM public.puzzle_user_prefs WHERE user_id = v_user AND game_type='guess_lineup';
  v_has := (v_level IS NOT NULL);
  IF p_scope IS NOT NULL AND p_holes IS NOT NULL THEN
    v_level := p_scope || '_' || p_holes;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'guess_lineup', v_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_level := COALESCE(v_level, 'big_1');
  v_scope := split_part(v_level, '_', 1); v_holes := split_part(v_level, '_', 2)::int;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_lineup' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'holes', v_holes, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'holes', v_holes, 'has_prefs', v_has, 'date', v_date,
    'config', jsonb_build_object('rounds', v_cfg.rounds_per_game),
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='guess_lineup' AND level=v_level),
    'rounds', (SELECT jsonb_agg(jsonb_build_object('round_no', r.round_no, 'payload', r.payload) ORDER BY r.round_no)
               FROM public.puzzle_rounds r WHERE r.game_id=v_game.id)
  );
END $$;


--
-- Name: puzzle_get_today_player(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_player(p_scope text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT; v_hint TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays; v_cfg public.puzzle_config; v_cap INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT level, hint INTO v_scope, v_hint FROM public.puzzle_user_prefs WHERE user_id = v_user AND game_type='guess_player';
  v_has := (v_scope IS NOT NULL);
  v_scope := COALESCE(p_scope, v_scope, 'big'); v_hint := COALESCE(v_hint, 'easy');
  IF p_scope IS NOT NULL THEN
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'guess_player', p_scope)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_cap := CASE v_hint WHEN 'easy' THEN 99 WHEN 'medium' THEN 5 ELSE 3 END;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='guess_player' AND level=v_scope AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'scope', v_scope, 'hint', v_hint, 'has_prefs', v_has, 'date', v_date,
    'config', jsonb_build_object('max_attempts', v_cfg.max_attempts, 'rounds', v_cfg.rounds_per_game,
              'freeze_every_days', v_cfg.freeze_every_days, 'max_freezes', v_cfg.max_freezes),
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='guess_player' AND level=v_scope),
    'rounds', (
      SELECT jsonb_agg(jsonb_build_object(
        'round_no', r.round_no,
        'trail', (SELECT jsonb_agg(elem ORDER BY ord) FROM jsonb_array_elements(r.payload->'trail') WITH ORDINALITY AS t(elem, ord)
                  WHERE ord > GREATEST(0, jsonb_array_length(r.payload->'trail') - v_cap)),
        'trail_total', jsonb_array_length(r.payload->'trail'),
        'hints', r.payload->'hints',
        'answer', (SELECT jsonb_build_object('id', r.answer_player_id, 'name', p.name, 'photo', p.photo_url) FROM public.tm_players p WHERE p.player_id = r.answer_player_id)
      ) ORDER BY r.round_no)
      FROM public.puzzle_rounds r WHERE r.game_id=v_game.id
    )
  );
END $$;


--
-- Name: puzzle_get_today_rapid(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_rapid() RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='rapid' AND level='daily' AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='rapid' AND level='daily'),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;


--
-- Name: puzzle_get_today_rapid(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_get_today_rapid(p_level text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT; v_has BOOLEAN; v_date DATE; v_game public.puzzle_games; v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT level INTO v_level FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='rapid';
  v_has := (v_level IS NOT NULL);
  IF p_level IS NOT NULL THEN
    v_level := p_level;
    INSERT INTO public.puzzle_user_prefs (user_id, game_type, level) VALUES (v_user, 'rapid', v_level)
    ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  END IF;
  v_level := COALESCE(v_level, 'medium');
  v_date := public.puzzle_current_date();
  SELECT * INTO v_game FROM public.puzzle_games WHERE game_type='rapid' AND level=v_level AND puzzle_date=v_date;
  IF v_game.id IS NULL THEN RETURN jsonb_build_object('ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date, 'game', NULL); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, v_game.id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=v_game.id;
  RETURN jsonb_build_object(
    'ok', true, 'level', v_level, 'has_prefs', v_has, 'date', v_date,
    'play', jsonb_build_object('id', v_play.id, 'finished_at', v_play.finished_at, 'rounds_solved', v_play.rounds_solved, 'score', v_play.score),
    'game', jsonb_build_object('id', v_game.id),
    'dist', (SELECT COALESCE(jsonb_agg(score), '[]'::jsonb) FROM public.puzzle_plays WHERE game_id=v_game.id AND finished_at IS NOT NULL AND user_id <> v_user),
    'progress', (SELECT jsonb_build_object('streak', current_streak, 'freezes', freezes, 'last_played', last_played)
                 FROM public.puzzle_progress WHERE user_id=v_user AND game_type='rapid' AND level=v_level),
    'payload', (SELECT payload FROM public.puzzle_rounds WHERE game_id=v_game.id AND round_no=1)
  );
END $$;


--
-- Name: puzzle_giveup_player(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_giveup_player(p_game_id uuid, p_round_no integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts, given_up)
  VALUES (v_play.id, p_round_no, '[]'::jsonb, false, COALESCE((SELECT attempts FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no),0), true)
  ON CONFLICT (play_id, round_no) DO UPDATE SET given_up = true;
  RETURN jsonb_build_object('ok', true,
    'reveal', (SELECT jsonb_build_object('name', name, 'photo', photo_url) FROM public.tm_players WHERE player_id = v_round.answer_player_id));
END $$;


--
-- Name: puzzle_grant_monthly(date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_grant_monthly(p_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE v_cfg public.puzzle_config; m JSONB; v_day TEXT; v_key TEXT; v_match BOOLEAN;
  v_period TEXT := to_char(p_date, 'YYYY-MM'); v_start DATE := date_trunc('month', p_date)::date;
  v_min INT; v_reward JSONB; v_granted INT := 0; u RECORD;
BEGIN
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  FOR m IN SELECT * FROM jsonb_array_elements(v_cfg.monthly_milestones) LOOP
    v_day := m->>'day';
    v_match := (v_day = 'last' AND p_date = (date_trunc('month', p_date) + interval '1 month - 1 day')::date)
            OR (v_day ~ '^[0-9]+$' AND EXTRACT(DAY FROM p_date)::int = v_day::int);
    IF NOT v_match THEN CONTINUE; END IF;
    v_key := v_day; v_min := COALESCE((m->>'min_games')::int, 1); v_reward := m->'reward';
    FOR u IN
      SELECT pl.user_id FROM public.puzzle_plays pl
      JOIN public.puzzle_games g ON g.id = pl.game_id
      WHERE pl.finished_at IS NOT NULL AND g.puzzle_date BETWEEN v_start AND p_date
      GROUP BY pl.user_id HAVING count(DISTINCT g.id) >= v_min
    LOOP
      INSERT INTO public.puzzle_monthly_grants (user_id, period, day_key) VALUES (u.user_id, v_period, v_key)
      ON CONFLICT DO NOTHING;
      IF FOUND THEN
        PERFORM public.distribute_reward_to_user(u.user_id, v_reward, 'puzzle_monthly', NULL);
        v_granted := v_granted + 1;
      END IF;
    END LOOP;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'date', p_date, 'granted', v_granted);
END $_$;


--
-- Name: puzzle_grid_index(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_grid_index() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  WITH pool AS (SELECT DISTINCT player_id FROM public.tm_transfers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.player_id, 'n', p.name, 'p', p.photo_url, 'nat', p.nationality,
    'by', EXTRACT(YEAR FROM p.date_of_birth)::int,
    'mv', COALESCE(p.current_market_value_eur, 0),
    'cl', (SELECT array_agg(DISTINCT c) FROM (
              SELECT from_club_name c FROM public.tm_transfers t WHERE t.player_id=p.player_id AND from_club_name IS NOT NULL
              UNION SELECT to_club_name FROM public.tm_transfers t WHERE t.player_id=p.player_id AND to_club_name IS NOT NULL
           ) z WHERE c !~* '(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|madrileñ|without club|retired|career break|unknown| B$| II$| C$)'),
    'tr', (SELECT array_agg(DISTINCT trophy) FROM public.tm_trophies WHERE player_id=p.player_id)
  )), '[]'::jsonb)
  FROM public.tm_players p JOIN pool ON pool.player_id = p.player_id
  WHERE p.name IS NOT NULL;
$_$;


--
-- Name: puzzle_guess(uuid, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_guess(p_game_id uuid, p_round_no integer, p_home integer, p_away integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_solved BOOLEAN; v_attempts INT; v_hint TEXT; v_fb JSONB; v_d INT; b JSONB; v_heat TEXT := 'cold'; v_exhausted BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF v_play.finished_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'finished'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  v_hint := COALESCE((SELECT hint FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type='guess_score'), 'easy');

  SELECT * INTO v_att FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no;
  IF v_att.solved THEN RETURN jsonb_build_object('ok', true, 'already', true, 'solved', true); END IF;
  IF v_cfg.max_attempts > 0 AND COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;

  v_solved := (p_home = v_round.answer_home AND p_away = v_round.answer_away);
  v_d := abs(p_home - v_round.answer_home) + abs(p_away - v_round.answer_away);
  v_attempts := COALESCE(v_att.attempts,0) + 1;
  v_exhausted := (v_cfg.max_attempts > 0 AND v_attempts >= v_cfg.max_attempts);

  IF v_hint = 'easy' THEN
    v_fb := jsonb_build_object('kind','arrows',
      'home', CASE WHEN p_home < v_round.answer_home THEN 'up' WHEN p_home > v_round.answer_home THEN 'down' ELSE 'ok' END,
      'away', CASE WHEN p_away < v_round.answer_away THEN 'up' WHEN p_away > v_round.answer_away THEN 'down' ELSE 'ok' END);
  ELSIF v_hint = 'medium' THEN
    v_fb := jsonb_build_object('kind','distance','value', v_d);
  ELSE
    FOR b IN SELECT * FROM jsonb_array_elements(v_cfg.heat_bands) LOOP IF v_d <= (b->>'max')::int THEN v_heat := b->>'key'; EXIT; END IF; END LOOP;
    v_fb := jsonb_build_object('kind','heat','key', v_heat);
  END IF;

  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('h',p_home,'a',p_away,'fb',v_fb), solved = v_solved, attempts = v_attempts;

  RETURN jsonb_build_object('ok', true, 'solved', v_solved, 'attempts_used', v_attempts,
    'attempts_left', CASE WHEN v_cfg.max_attempts > 0 THEN v_cfg.max_attempts - v_attempts ELSE NULL END, 'fb', v_fb,
    'reveal', CASE WHEN v_solved OR v_exhausted THEN jsonb_build_object('home', v_round.answer_home, 'away', v_round.answer_away) ELSE NULL END);
END $$;


--
-- Name: puzzle_guess_player(uuid, integer, bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_guess_player(p_game_id uuid, p_round_no integer, p_player_id bigint) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_cfg public.puzzle_config;
  v_att public.puzzle_round_attempts; v_solved BOOLEAN; v_attempts INT; v_name TEXT; v_exhausted BOOLEAN;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  IF v_play.finished_at IS NOT NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'finished'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  SELECT * INTO v_att FROM public.puzzle_round_attempts WHERE play_id=v_play.id AND round_no=p_round_no;
  IF v_att.solved THEN RETURN jsonb_build_object('ok', true, 'already', true, 'solved', true); END IF;
  IF v_cfg.max_attempts > 0 AND COALESCE(v_att.attempts,0) >= v_cfg.max_attempts THEN RETURN jsonb_build_object('ok', false, 'error', 'no_attempts_left'); END IF;
  v_solved := (p_player_id = v_round.answer_player_id);
  v_attempts := COALESCE(v_att.attempts,0) + 1;
  v_exhausted := (v_cfg.max_attempts > 0 AND v_attempts >= v_cfg.max_attempts);
  SELECT name INTO v_name FROM public.tm_players WHERE player_id = p_player_id;
  INSERT INTO public.puzzle_round_attempts (play_id, round_no, guesses, solved, attempts)
  VALUES (v_play.id, p_round_no, jsonb_build_array(jsonb_build_object('pid',p_player_id,'name',v_name,'correct',v_solved)), v_solved, 1)
  ON CONFLICT (play_id, round_no) DO UPDATE SET
    guesses = public.puzzle_round_attempts.guesses || jsonb_build_object('pid',p_player_id,'name',v_name,'correct',v_solved), solved = v_solved, attempts = v_attempts;
  RETURN jsonb_build_object('ok', true, 'solved', v_solved, 'attempts_used', v_attempts,
    'attempts_left', CASE WHEN v_cfg.max_attempts > 0 THEN v_cfg.max_attempts - v_attempts ELSE NULL END,
    'reveal', CASE WHEN v_solved OR v_exhausted THEN (SELECT jsonb_build_object('name', name, 'photo', photo_url) FROM public.tm_players WHERE player_id = v_round.answer_player_id) ELSE NULL END);
END $$;


--
-- Name: puzzle_heat(integer, integer, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_heat(gh integer, ga integer, ah integer, aa integer) RETURNS text
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE d INTEGER := abs(gh - ah) + abs(ga - aa); b JSONB; v_key TEXT := 'cold'; gr INTEGER; ar INTEGER;
BEGIN
  FOR b IN SELECT * FROM jsonb_array_elements((SELECT heat_bands FROM public.puzzle_config WHERE id = 1)) LOOP
    IF d <= (b->>'max')::int THEN v_key := b->>'key'; EXIT; END IF;
  END LOOP;
  IF v_key = 'exact' THEN RETURN 'exact'; END IF;
  gr := sign(gh - ga); ar := sign(ah - aa);
  IF gr <> ar THEN RETURN 'cold'; END IF;  -- wrong 1X2 outcome -> cold regardless of distance
  RETURN v_key;
END $$;


--
-- Name: puzzle_hints(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_hints(h integer, a integer) RETURNS jsonb
    LANGUAGE plpgsql IMMUTABLE
    AS $$
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


--
-- Name: puzzle_lineup_index(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_lineup_index() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', api_id, 'n', name, 'p', COALESCE(photo, photo_url), 'r', 50)), '[]'::jsonb)
  FROM public.fb_players p
  WHERE api_id IS NOT NULL AND name IS NOT NULL AND name <> 'Unknown';
$$;


--
-- Name: puzzle_my_stats(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_my_stats(p_level text DEFAULT NULL::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_level TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_level := COALESCE(p_level, (SELECT level FROM public.puzzle_user_prefs WHERE user_id=v_user), 'easy');
  RETURN COALESCE((SELECT jsonb_build_object('ok', true, 'level', v_level,
    'current_streak', current_streak, 'best_streak', best_streak, 'freezes', freezes,
    'games_played', games_played, 'games_won', games_won, 'total_score', total_score)
    FROM public.puzzle_progress WHERE user_id=v_user AND level=v_level),
    jsonb_build_object('ok', true, 'level', v_level, 'current_streak', 0, 'best_streak', 0, 'freezes', 0, 'games_played', 0, 'games_won', 0, 'total_score', 0));
END $$;


--
-- Name: puzzle_my_stats(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_my_stats(p_scope text DEFAULT NULL::text, p_game_type text DEFAULT 'guess_score'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_scope TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  v_scope := COALESCE(p_scope, (SELECT level FROM public.puzzle_user_prefs WHERE user_id=v_user AND game_type=p_game_type), 'big');
  RETURN COALESCE((SELECT jsonb_build_object('ok', true, 'scope', v_scope,
    'current_streak', current_streak, 'best_streak', best_streak, 'freezes', freezes,
    'games_played', games_played, 'games_won', games_won, 'total_score', total_score)
    FROM public.puzzle_progress WHERE user_id=v_user AND game_type=p_game_type AND level=v_scope),
    jsonb_build_object('ok', true, 'scope', v_scope, 'current_streak', 0, 'best_streak', 0, 'freezes', 0, 'games_played', 0, 'games_won', 0, 'total_score', 0));
END $$;


--
-- Name: puzzle_player_index(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_player_index() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE(jsonb_agg(jsonb_build_object('id', player_id, 'n', name, 'p', photo_url,
           'r', COALESCE(current_market_value_eur, 0))), '[]'::jsonb)
  FROM public.tm_players WHERE name IS NOT NULL;
$$;


--
-- Name: puzzle_player_trail(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_player_trail(p_player bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE r RECORD; arr JSONB := '[]'::jsonb; last_id BIGINT := NULL; v_first BOOLEAN := true;
BEGIN
  FOR r IN SELECT transfer_date, team_out_api, team_out_name, team_in_api, team_in_name
           FROM public.fb_transfers WHERE player_id = p_player ORDER BY transfer_date NULLS LAST LOOP
    IF v_first AND r.team_out_api IS NOT NULL THEN
      arr := arr || jsonb_build_object('name', r.team_out_name, 'id', r.team_out_api);
      last_id := r.team_out_api; v_first := false;
    END IF;
    IF r.team_in_api IS NOT NULL AND r.team_in_api IS DISTINCT FROM last_id THEN
      arr := arr || jsonb_build_object('name', r.team_in_name, 'id', r.team_in_api);
      last_id := r.team_in_api;
    END IF;
  END LOOP;
  RETURN arr;
END $$;


--
-- Name: puzzle_replay(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_replay(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT id INTO v_play_id FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play_id IS NOT NULL THEN
    DELETE FROM public.puzzle_round_attempts WHERE play_id=v_play_id;
    DELETE FROM public.puzzle_plays WHERE id=v_play_id;
  END IF;
  RETURN jsonb_build_object('ok', true);
END $$;


--
-- Name: puzzle_reschedule(uuid, date); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_reschedule(p_game_id uuid, p_new_date date) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_level TEXT;
BEGIN
  SELECT level INTO v_level FROM public.puzzle_games WHERE id = p_game_id;
  IF v_level IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_found'); END IF;
  -- park the moved game, shift the block +1 day (latest first to avoid collisions), then place it
  UPDATE public.puzzle_games SET puzzle_date = NULL WHERE id = p_game_id;
  UPDATE public.puzzle_games SET puzzle_date = puzzle_date + 1
    WHERE game_type='guess_score' AND level=v_level AND puzzle_date >= p_new_date AND id <> p_game_id;
  UPDATE public.puzzle_games SET puzzle_date = p_new_date WHERE id = p_game_id;
  -- renumber seq by date
  WITH ord AS (SELECT id, row_number() OVER (ORDER BY puzzle_date) rn FROM public.puzzle_games WHERE game_type='guess_score' AND level=v_level)
  UPDATE public.puzzle_games g SET seq = ord.rn FROM ord WHERE g.id = ord.id;
  RETURN jsonb_build_object('ok', true);
END $$;


--
-- Name: puzzle_reveal_letters(uuid, integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_reveal_letters(p_game_id uuid, p_round_no integer, p_n integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_round public.puzzle_rounds; v_name TEXT; v_masked TEXT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  IF v_play.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not_started'); END IF;
  SELECT * INTO v_round FROM public.puzzle_rounds WHERE game_id=p_game_id AND round_no=p_round_no;
  IF v_round.id IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_round'); END IF;
  SELECT name INTO v_name FROM public.tm_players WHERE player_id = v_round.answer_player_id;
  IF v_name IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'no_name'); END IF;
  SELECT string_agg(CASE WHEN t.ord <= GREATEST(0,p_n) THEN t.ch WHEN t.ch ~ '[[:alnum:]]' THEN '_' ELSE t.ch END, '' ORDER BY t.ord)
  INTO v_masked FROM regexp_split_to_table(v_name, '') WITH ORDINALITY AS t(ch, ord);
  RETURN jsonb_build_object('ok', true, 'masked', v_masked, 'length', char_length(v_name));
END $$;


--
-- Name: puzzle_set_level(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_set_level(p_level text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_level NOT IN ('easy','medium','hard') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad level'); END IF;
  INSERT INTO public.puzzle_user_prefs (user_id, level) VALUES (v_user, p_level)
  ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'level', p_level);
END $$;


--
-- Name: puzzle_set_prefs(text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_scope NOT IN ('big','all') OR p_hint NOT IN ('easy','medium','hard') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad'); END IF;
  INSERT INTO public.puzzle_user_prefs (user_id, level, hint) VALUES (v_user, p_scope, p_hint)
  ON CONFLICT (user_id) DO UPDATE SET level = EXCLUDED.level, hint = EXCLUDED.hint, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'scope', p_scope, 'hint', p_hint);
END $$;


--
-- Name: puzzle_set_prefs(text, text, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text, p_game_type text DEFAULT 'guess_score'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid();
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  IF p_scope NOT IN ('big','all') OR p_hint NOT IN ('easy','medium','hard') THEN RETURN jsonb_build_object('ok', false, 'error', 'bad'); END IF;
  INSERT INTO public.puzzle_user_prefs (user_id, game_type, level, hint) VALUES (v_user, p_game_type, p_scope, p_hint)
  ON CONFLICT (user_id, game_type) DO UPDATE SET level = EXCLUDED.level, hint = EXCLUDED.hint, updated_at = now();
  RETURN jsonb_build_object('ok', true, 'scope', p_scope, 'hint', p_hint, 'game_type', p_game_type);
END $$;


--
-- Name: puzzle_start(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_start(p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false); END IF;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id = v_user AND game_id = p_game_id;
  IF v_play.finished_at IS NULL AND NOT EXISTS (SELECT 1 FROM public.puzzle_round_attempts WHERE play_id = v_play.id) THEN
    UPDATE public.puzzle_plays SET started_at = now() WHERE id = v_play.id;
    RETURN jsonb_build_object('ok', true, 'started_at', now());
  END IF;
  RETURN jsonb_build_object('ok', true, 'started_at', v_play.started_at);
END $$;


--
-- Name: puzzle_submit_hl(uuid, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_submit_hl(p_game_id uuid, p_streak integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_play public.puzzle_plays; v_game public.puzzle_games; v_cfg public.puzzle_config;
  v_best INT; v_total INT; v_better INT; v_prog public.puzzle_progress; v_streak INT; v_freezes INT; v_freeze_gained BOOLEAN := false; v_missed INT; v_first BOOLEAN;
  v_free_every INT; v_free_max INT;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'auth'); END IF;
  SELECT * INTO v_cfg FROM public.puzzle_config WHERE id = 1;
  SELECT free_every, free_max INTO v_free_every, v_free_max FROM public.freeze_params(v_user, v_cfg.freeze_every_days, v_cfg.max_freezes);
  SELECT * INTO v_game FROM public.puzzle_games WHERE id=p_game_id;
  INSERT INTO public.puzzle_plays (user_id, game_id) VALUES (v_user, p_game_id) ON CONFLICT (user_id, game_id) DO NOTHING;
  SELECT * INTO v_play FROM public.puzzle_plays WHERE user_id=v_user AND game_id=p_game_id;
  v_first := (v_play.finished_at IS NULL);
  UPDATE public.puzzle_plays SET score = GREATEST(COALESCE(score,0), p_streak), rounds_solved = GREATEST(COALESCE(rounds_solved,0), p_streak), finished_at = COALESCE(finished_at, now())
    WHERE id = v_play.id;

  IF v_first THEN   -- update the daily play-streak once per day
    SELECT * INTO v_prog FROM public.puzzle_progress WHERE user_id=v_user AND game_type=v_game.game_type AND level=v_game.level;
    IF v_prog.user_id IS NULL THEN v_streak := 1; v_freezes := 0;
    ELSIF v_prog.last_played = v_game.puzzle_date THEN v_streak := v_prog.current_streak; v_freezes := v_prog.freezes;
    ELSE v_missed := (v_game.puzzle_date - v_prog.last_played - 1);
      IF v_missed <= 0 THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes;
      ELSIF v_missed <= v_prog.freezes THEN v_streak := v_prog.current_streak + 1; v_freezes := v_prog.freezes - v_missed;
      ELSE v_streak := 1; v_freezes := v_prog.freezes; END IF;
    END IF;
    IF v_streak > 0 AND v_streak % v_free_every = 0 AND v_freezes < v_free_max THEN v_freezes := v_freezes + 1; v_freeze_gained := true; END IF;
    INSERT INTO public.puzzle_progress (user_id, game_type, level, current_streak, best_streak, freezes, last_played, games_played, games_won, total_score)
    VALUES (v_user, v_game.game_type, v_game.level, v_streak, v_streak, v_freezes, v_game.puzzle_date, 1, 0, p_streak)
    ON CONFLICT (user_id, game_type, level) DO UPDATE SET current_streak=v_streak, best_streak=GREATEST(public.puzzle_progress.best_streak, v_streak),
      freezes=v_freezes, last_played=v_game.puzzle_date, games_played=public.puzzle_progress.games_played+1, updated_at=now();
  END IF;

  SELECT max(score) INTO v_best FROM public.puzzle_plays WHERE user_id=v_user AND game_id IN (SELECT id FROM public.puzzle_games WHERE game_type='higherlower' AND level=v_game.level);
  SELECT count(*), count(*) FILTER (WHERE score > p_streak) INTO v_total, v_better FROM public.puzzle_plays WHERE game_id=p_game_id AND finished_at IS NOT NULL;
  RETURN jsonb_build_object('ok', true, 'streak', p_streak, 'best', v_best,
    'percentile', CASE WHEN v_total > 0 THEN round(100.0 * v_better / v_total, 1) ELSE 0 END,
    'day_streak', (SELECT current_streak FROM public.puzzle_progress WHERE user_id=v_user AND game_type='higherlower' AND level=v_game.level), 'freeze_gained', v_freeze_gained);
END $$;


--
-- Name: puzzle_value_index(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.puzzle_value_index() RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
  WITH pool AS (SELECT DISTINCT player_id FROM public.tm_transfers)
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', p.player_id, 'n', p.name, 'p', p.photo_url,
    'mv', p.current_market_value_eur, 'maxv', p.max_market_value_eur,
    'h', p.height_cm, 'by', EXTRACT(YEAR FROM p.date_of_birth)::int,
    'fee', (SELECT max(fee_eur) FROM public.tm_transfers t WHERE t.player_id=p.player_id),
    'tro', (SELECT count(*) FROM public.tm_trophies tr WHERE tr.player_id=p.player_id),
    'clubs', (SELECT count(*) FROM (
                SELECT from_club_name c FROM public.tm_transfers t WHERE t.player_id=p.player_id AND from_club_name IS NOT NULL
                UNION SELECT to_club_name FROM public.tm_transfers t WHERE t.player_id=p.player_id AND to_club_name IS NOT NULL
              ) z WHERE c !~* '(U1[5-9]|U2[0-3]|youth|yth|giov|reserve|castilla|madrileñ|without club|retired|career break|unknown| B$| II$| C$)')
  )), '[]'::jsonb)
  FROM public.tm_players p JOIN pool ON pool.player_id = p.player_id WHERE p.name IS NOT NULL;
$_$;


--
-- Name: recalc_challenge_participant(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalc_challenge_participant(p_challenge_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total INTEGER;
BEGIN
  SELECT COALESCE(SUM(cb.points_earned), 0) INTO v_total
  FROM public.challenge_bets cb
  JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
  JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
  WHERE ce.challenge_id = p_challenge_id
    AND ce.user_id = p_user_id;

  UPDATE public.challenge_participants
  SET points = v_total
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
END;
$$;


--
-- Name: recalculate_all_challenge_points(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_all_challenge_points(p_challenge_id uuid) RETURNS TABLE(out_user_id uuid, out_old_points integer, out_new_points integer, out_rank integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_participant RECORD;
  v_old_points INTEGER;
  v_new_points INTEGER;
BEGIN
  FOR v_participant IN
    SELECT user_id, points
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
  LOOP
    v_old_points := v_participant.points;

    -- Recalculate points
    v_new_points := public.recalculate_challenge_points(
      p_challenge_id,
      v_participant.user_id
    );

    -- Update participant
    UPDATE public.challenge_participants
    SET points = v_new_points,
        updated_at = NOW()
    WHERE challenge_id = p_challenge_id
      AND user_id = v_participant.user_id;
  END LOOP;

  -- Update rankings
  PERFORM public.update_challenge_rankings(p_challenge_id);

  -- Return results
  RETURN QUERY
  SELECT
    user_id,
    v_old_points,
    points as new_points,
    rank
  FROM public.challenge_participants
  WHERE challenge_id = p_challenge_id
  ORDER BY rank ASC;
END;
$$;


--
-- Name: FUNCTION recalculate_all_challenge_points(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.recalculate_all_challenge_points(p_challenge_id uuid) IS 'Admin function to manually recalculate all points and rankings for a challenge';


--
-- Name: recalculate_challenge_points(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_challenge_points(p_challenge_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_daily_entry RECORD;
  v_bet RECORD;
  v_match RECORD;
  v_has_booster BOOLEAN;
  v_bet_points INTEGER;
  v_total_points INTEGER := 0;
  v_updated_count INTEGER := 0;
BEGIN
  -- Loop through each daily entry for this challenge
  FOR v_daily_entry IN
    SELECT * FROM public.challenge_daily_entries
    WHERE challenge_entry_id IN (
      SELECT id FROM public.challenge_entries WHERE challenge_id = p_challenge_id
    )
  LOOP
    v_total_points := 0;
    v_has_booster := v_daily_entry.booster_type IS NOT NULL;

    -- Loop through all bets for this day
    FOR v_bet IN
      SELECT * FROM public.challenge_bets
      WHERE daily_entry_id = v_daily_entry.id
    LOOP
      -- Get match details including result and real odds
      SELECT
        cm.id,
        m.status,
        m.score,
        -- PRIORITY 1: Use odds_snapshot from bet if available (captured at bet placement)
        COALESCE(
          v_bet.odds_snapshot,
          -- PRIORITY 2: Fetch latest odds from odds table
          (
            SELECT JSONB_BUILD_OBJECT(
              'teamA', o.home_win,
              'draw', o.draw,
              'teamB', o.away_win
            )
            FROM public.fixtures f
            LEFT JOIN public.odds o ON o.fixture_id = f.id
            WHERE f.id = m.fixture_id
              AND o.home_win IS NOT NULL
            ORDER BY o.updated_at DESC
            LIMIT 1
          ),
          -- PRIORITY 3: Fallback to default odds
          JSONB_BUILD_OBJECT(
            'teamA', 2.0,
            'draw', 3.2,
            'teamB', 2.4
          )
        ) as odds
      INTO v_match
      FROM public.challenge_matches cm
      JOIN public.matches m ON m.id = cm.match_id
      WHERE cm.id = v_bet.challenge_match_id;

      -- Only count if match is finished
      IF v_match.status IN ('finished', 'FT', 'AET', 'PEN') AND v_match.score IS NOT NULL THEN
        -- Determine match result
        DECLARE
          v_home_goals INTEGER;
          v_away_goals INTEGER;
          v_result TEXT;
        BEGIN
          v_home_goals := COALESCE((v_match.score->>'home')::INTEGER, (v_match.score->>'goals_home')::INTEGER, 0);
          v_away_goals := COALESCE((v_match.score->>'away')::INTEGER, (v_match.score->>'goals_away')::INTEGER, 0);

          v_result := CASE
            WHEN v_home_goals > v_away_goals THEN 'teamA'
            WHEN v_home_goals < v_away_goals THEN 'teamB'
            ELSE 'draw'
          END;

          -- Check if booster applies to this match
          DECLARE
            v_apply_booster BOOLEAN;
          BEGIN
            v_apply_booster := v_has_booster AND (v_daily_entry.booster_match_id = v_bet.challenge_match_id);

            -- Calculate points for this bet using REAL odds
            v_bet_points := public.calculate_bet_points(
              v_bet.prediction,
              v_result,
              v_match.odds,  -- Now contains real odds from database!
              v_bet.amount,
              v_apply_booster,
              v_daily_entry.booster_type
            );

            v_total_points := v_total_points + v_bet_points;
          END;
        END;
      END IF;
    END LOOP;

    -- Update daily entry points
    UPDATE public.challenge_daily_entries
    SET points = v_total_points
    WHERE id = v_daily_entry.id;

    v_updated_count := v_updated_count + 1;
  END LOOP;

  RETURN v_updated_count;
END;
$$;


--
-- Name: FUNCTION recalculate_challenge_points(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid) IS 'Recalculates points for all challenge entries using REAL odds from the odds table. Priority: 1) odds_snapshot from bet, 2) latest odds from odds table, 3) default fallback (2.0, 3.2, 2.4). Applies gross gain model with x3 penalty.';


--
-- Name: recalculate_challenge_points(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid) RETURNS integer
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_total_points INTEGER := 0;
  v_entry RECORD;
  v_daily_entry RECORD;
  v_bet RECORD;
  v_match RECORD;
  v_has_booster BOOLEAN;
  v_booster_type TEXT;
  v_bet_points INTEGER;
BEGIN
  -- Get the challenge entry
  SELECT * INTO v_entry
  FROM public.challenge_entries
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  IF v_entry IS NULL THEN
    RETURN 0;
  END IF;

  -- Loop through all daily entries
  FOR v_daily_entry IN
    SELECT * FROM public.challenge_daily_entries
    WHERE entry_id = v_entry.id
  LOOP
    -- Check if this day has a booster
    v_has_booster := (v_daily_entry.booster_type IS NOT NULL);
    v_booster_type := v_daily_entry.booster_type;

    -- Loop through all bets for this day
    FOR v_bet IN
      SELECT * FROM public.challenge_bets
      WHERE daily_entry_id = v_daily_entry.id
    LOOP
      -- Get match details including result
      SELECT
        cm.id,
        m.status,
        m.score,
        JSONB_BUILD_OBJECT(
          'teamA', 2.0,
          'draw', 3.2,
          'teamB', 2.4
        ) as odds
      INTO v_match
      FROM public.challenge_matches cm
      JOIN public.matches m ON m.id = cm.match_id
      WHERE cm.id = v_bet.challenge_match_id;

      -- Only count if match is finished
      IF v_match.status IN ('finished', 'FT', 'AET', 'PEN') AND v_match.score IS NOT NULL THEN
        -- Determine match result
        DECLARE
          v_home_goals INTEGER;
          v_away_goals INTEGER;
          v_result TEXT;
        BEGIN
          v_home_goals := COALESCE((v_match.score->>'home')::INTEGER, (v_match.score->>'goals_home')::INTEGER, 0);
          v_away_goals := COALESCE((v_match.score->>'away')::INTEGER, (v_match.score->>'goals_away')::INTEGER, 0);

          v_result := CASE
            WHEN v_home_goals > v_away_goals THEN 'teamA'
            WHEN v_home_goals < v_away_goals THEN 'teamB'
            ELSE 'draw'
          END;

          -- Check if booster applies to this match
          DECLARE
            v_apply_booster BOOLEAN;
          BEGIN
            v_apply_booster := v_has_booster AND (v_daily_entry.booster_match_id = v_bet.challenge_match_id);

            -- Calculate points for this bet
            v_bet_points := public.calculate_bet_points(
              v_bet.prediction,
              v_result,
              v_match.odds,
              v_bet.amount,
              v_apply_booster,
              v_booster_type
            );

            v_total_points := v_total_points + v_bet_points;
          END;
        END;
      END IF;
    END LOOP;
  END LOOP;

  RETURN v_total_points;
END;
$$;


--
-- Name: FUNCTION recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid) IS 'Recalculates total points for a participant in a challenge';


--
-- Name: record_spin(uuid, public.spin_tier, text, text, text, text, boolean, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text DEFAULT NULL::text, p_was_pity boolean DEFAULT false, p_final_chances jsonb DEFAULT NULL::jsonb) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_spin_id UUID;
BEGIN
  INSERT INTO public.spin_history (
    user_id,
    tier,
    reward_id,
    reward_label,
    reward_category,
    reward_value,
    was_pity,
    final_chances
  )
  VALUES (
    p_user_id,
    p_tier,
    p_reward_id,
    p_reward_label,
    p_reward_category,
    p_reward_value,
    p_was_pity,
    p_final_chances
  )
  RETURNING id INTO v_spin_id;

  RETURN v_spin_id;
END;
$$;


--
-- Name: FUNCTION record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb) IS 'Records a spin in history';


--
-- Name: refresh_user_daily_hpi(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refresh_user_daily_hpi() RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY public.user_daily_hpi;
END;
$$;


--
-- Name: refund_challenge_entry(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.refund_challenge_entry(p_challenge_id uuid, p_user_id uuid) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_entry_cost INTEGER;
  v_entry_method TEXT;
BEGIN
  -- Get challenge entry cost
  SELECT entry_cost INTO v_entry_cost
  FROM public.challenges
  WHERE id = p_challenge_id;

  -- Get user's entry method
  SELECT entry_method INTO v_entry_method
  FROM public.challenge_entries
  WHERE challenge_id = p_challenge_id AND user_id = p_user_id;

  -- Only refund if paid with coins
  IF v_entry_method = 'coins' THEN
    PERFORM public.add_coins(
      p_user_id,
      v_entry_cost,
      'challenge_refund',
      jsonb_build_object('challenge_id', p_challenge_id)
    );
  END IF;

  RETURN true;
END;
$$;


--
-- Name: remove_name_suffixes(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.remove_name_suffixes(name text) RETURNS text
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $_$
  SELECT TRIM(regexp_replace(
    regexp_replace(name, '\s+(Jr\.?|Junior|Sr\.?|Senior|III|II|IV)$', '', 'i'),
    '\.$', ''
  ));
$_$;


--
-- Name: fb_fixture_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_fixture_stats (
    fixture_id uuid NOT NULL,
    possession_home integer,
    possession_away integer,
    yellow_home integer DEFAULT 0,
    yellow_away integer DEFAULT 0,
    red_home integer DEFAULT 0,
    red_away integer DEFAULT 0,
    corners_home integer DEFAULT 0,
    corners_away integer DEFAULT 0,
    first_goal_team text,
    first_goal_half integer,
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: resolve_live_bonus(text, public.fb_fixture_stats); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.resolve_live_bonus(p_key text, s public.fb_fixture_stats) RETURNS text
    LANGUAGE plpgsql IMMUTABLE
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ch INT := COALESCE(s.yellow_home,0) + COALESCE(s.red_home,0);
  v_ca INT := COALESCE(s.yellow_away,0) + COALESCE(s.red_away,0);
BEGIN
  CASE p_key
    WHEN 'possession_most' THEN
      RETURN CASE WHEN COALESCE(s.possession_home,0) > COALESCE(s.possession_away,0) THEN 'home'
                  WHEN COALESCE(s.possession_away,0) > COALESCE(s.possession_home,0) THEN 'away' ELSE 'none' END;
    WHEN 'both_carded' THEN RETURN CASE WHEN v_ch > 0 AND v_ca > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'cards_4plus' THEN RETURN CASE WHEN v_ch + v_ca >= 4 THEN 'yes' ELSE 'no' END;
    WHEN 'cards_most' THEN
      RETURN CASE WHEN v_ch > v_ca THEN 'home' WHEN v_ca > v_ch THEN 'away' ELSE 'none' END;
    WHEN 'red_card' THEN RETURN CASE WHEN COALESCE(s.red_home,0)+COALESCE(s.red_away,0) > 0 THEN 'yes' ELSE 'no' END;
    WHEN 'first_scorer' THEN RETURN COALESCE(s.first_goal_team, 'none');
    WHEN 'first_goal_1h' THEN RETURN CASE WHEN s.first_goal_half = 1 THEN 'yes' ELSE 'no' END;
    WHEN 'corners_9plus' THEN RETURN CASE WHEN COALESCE(s.corners_home,0)+COALESCE(s.corners_away,0) >= 10 THEN 'yes' ELSE 'no' END;
    WHEN 'corners_most' THEN
      RETURN CASE WHEN COALESCE(s.corners_home,0) > COALESCE(s.corners_away,0) THEN 'home'
                  WHEN COALESCE(s.corners_away,0) > COALESCE(s.corners_home,0) THEN 'away' ELSE 'none' END;
    ELSE RETURN NULL;
  END CASE;
END;
$$;


--
-- Name: seed_team_popularity(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.seed_team_popularity() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n INTEGER; v_total INTEGER;
BEGIN
  SELECT count(DISTINCT season) INTO v_total FROM public.fb_standings;
  WITH agg AS (
    SELECT team_api_id, max(team_name) AS name, avg(rank) AS avg_rank, count(*) AS seasons
    FROM public.fb_standings GROUP BY team_api_id
  )
  INSERT INTO public.team_popularity (team_api_id, team_name, popularity, is_manual)
  SELECT team_api_id, name,
    GREATEST(5, LEAST(100, round(
      0.7 * (100 * (1 - (avg_rank - 1) / 19.0)) +
      0.3 * (100 * seasons / NULLIF(v_total,0))
    )))::int, false
  FROM agg
  ON CONFLICT (team_api_id) DO UPDATE
    SET popularity = CASE WHEN public.team_popularity.is_manual THEN public.team_popularity.popularity ELSE EXCLUDED.popularity END,
        team_name = EXCLUDED.team_name, updated_at = now();
  GET DIAGNOSTICS n = ROW_COUNT; RETURN n;
END $$;


--
-- Name: set_preferred_bookmaker(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_preferred_bookmaker(p_bookmaker_name text) RETURNS boolean
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION set_preferred_bookmaker(p_bookmaker_name text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.set_preferred_bookmaker(p_bookmaker_name text) IS 'Définit le bookmaker préféré dans la configuration';


--
-- Name: set_subscription(uuid, boolean, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_subscription(p_user_id uuid, p_active boolean, p_expires_at timestamp with time zone DEFAULT NULL::timestamp with time zone) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Base flag on users (read by the app via profiles.is_subscriber when profiles is a view).
  BEGIN
    UPDATE public.users SET is_subscribed = p_active WHERE id = p_user_id;
  EXCEPTION WHEN undefined_column THEN NULL; END;

  -- If profiles is its own table (not an updatable view), mirror the flag there too.
  BEGIN
    UPDATE public.profiles SET is_subscriber = p_active WHERE id = p_user_id;
  EXCEPTION WHEN OTHERS THEN NULL; END;  -- non-updatable view / missing column → ignore

  -- Best-effort expiry on users.
  IF p_expires_at IS NOT NULL THEN
    BEGIN
      UPDATE public.users SET subscription_expires_at = p_expires_at WHERE id = p_user_id;
    EXCEPTION WHEN undefined_column THEN NULL; END;
  END IF;
END $$;


--
-- Name: set_user_role(uuid, public.user_role_enum); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.set_user_role(p_user_id uuid, p_role public.user_role_enum) RETURNS public.users
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_target public.users;
BEGIN
  IF NOT public.is_super_admin() THEN
    RAISE EXCEPTION 'Insufficient privileges';
  END IF;

  UPDATE public.users
  SET
    user_type = p_role,
    updated_at = now()
  WHERE id = p_user_id
  RETURNING * INTO v_target;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'User not found';
  END IF;

  RETURN v_target;
END;
$$;


--
-- Name: settle_challenge_bets_for_fixture(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_challenge_bets_for_fixture(p_fixture_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture RECORD;
  v_result TEXT;          -- 'teamA' | 'draw' | 'teamB' | NULL (void)
  v_is_void BOOLEAN := false;
  v_bet RECORD;
  v_odds NUMERIC;
  v_mult NUMERIC;
  v_points INTEGER;
  v_settled INTEGER := 0;
  v_pair RECORD;
BEGIN
  SELECT id, status, goals_home, goals_away
    INTO v_fixture
  FROM public.fb_fixtures
  WHERE id = p_fixture_id;

  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Determine outcome from the fixture status
  IF v_fixture.status IN ('FT', 'AET', 'PEN') THEN
    IF COALESCE(v_fixture.goals_home, 0) > COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'teamA';
    ELSIF COALESCE(v_fixture.goals_home, 0) < COALESCE(v_fixture.goals_away, 0) THEN
      v_result := 'teamB';
    ELSE
      v_result := 'draw';
    END IF;
  ELSIF v_fixture.status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    v_is_void := true;  -- bets voided (0 points)
  ELSE
    RETURN 0;  -- not finished yet, nothing to do
  END IF;

  -- Score each pending bet on this fixture
  FOR v_bet IN
    SELECT cb.id, cb.daily_entry_id, cb.prediction, cb.amount, cb.odds_snapshot,
           cde.booster_type, cde.booster_match_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
      AND cb.status = 'pending'
  LOOP
    IF v_is_void THEN
      UPDATE public.challenge_bets
      SET status = 'void', points_earned = 0, settled_at = now()
      WHERE id = v_bet.id;
      v_settled := v_settled + 1;
      CONTINUE;
    END IF;

    IF v_bet.prediction = v_result THEN
      v_odds := COALESCE((v_bet.odds_snapshot->>v_bet.prediction)::NUMERIC, 1);
      v_mult := 1;
      IF v_bet.booster_match_id = p_fixture_id THEN
        v_mult := CASE v_bet.booster_type
                    WHEN 'x2' THEN 2 WHEN 'x3' THEN 3 ELSE 1 END;
      END IF;
      v_points := FLOOR(v_odds * v_bet.amount * v_mult);
      UPDATE public.challenge_bets
      SET status = 'won', points_earned = v_points, settled_at = now()
      WHERE id = v_bet.id;
    ELSE
      UPDATE public.challenge_bets
      SET status = 'lost', points_earned = 0, settled_at = now()
      WHERE id = v_bet.id;
    END IF;
    v_settled := v_settled + 1;
  END LOOP;

  -- Recompute points for every (challenge, user) touched by this fixture
  FOR v_pair IN
    SELECT DISTINCT ce.challenge_id, ce.user_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
  LOOP
    PERFORM public.recalc_challenge_participant(v_pair.challenge_id, v_pair.user_id);
  END LOOP;

  -- Refresh ranks for affected challenges
  FOR v_pair IN
    SELECT DISTINCT ce.challenge_id
    FROM public.challenge_bets cb
    JOIN public.challenge_daily_entries cde ON cde.id = cb.daily_entry_id
    JOIN public.challenge_entries ce ON ce.id = cde.challenge_entry_id
    WHERE cb.challenge_match_id = p_fixture_id
  LOOP
    PERFORM public.update_challenge_rankings(v_pair.challenge_id);
  END LOOP;

  RETURN v_settled;
END;
$$;


--
-- Name: settle_finished_live_score_games(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_finished_live_score_games() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_game_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_game_id IN
    SELECT lg.id
    FROM public.live_games lg
    JOIN public.fb_fixtures f ON f.id = lg.fixture_id
    WHERE lg.status IN ('upcoming', 'live')
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
      AND EXISTS (SELECT 1 FROM public.live_game_entries e
                  WHERE e.live_game_id = lg.id AND e.predicted_score IS NOT NULL)
  LOOP
    v_total := v_total + public.settle_live_game_score(v_game_id);
  END LOOP;
  RETURN v_total;
END;
$$;


--
-- Name: settle_finished_unsettled_bets(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_finished_unsettled_bets() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_fixture_id IN
    SELECT DISTINCT f.id
    FROM public.fb_fixtures f
    JOIN public.challenge_bets cb ON cb.challenge_match_id = f.id
    WHERE cb.status = 'pending'
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
  LOOP
    v_total := v_total + public.settle_challenge_bets_for_fixture(v_fixture_id);
  END LOOP;
  RETURN v_total;
END;
$$;


--
-- Name: settle_finished_unsettled_predictions(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_finished_unsettled_predictions() RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture_id UUID;
  v_total INTEGER := 0;
BEGIN
  FOR v_fixture_id IN
    SELECT DISTINCT f.id
    FROM public.fb_fixtures f
    JOIN public.swipe_predictions sp ON sp.fixture_id = f.id
    WHERE sp.is_correct IS NULL
      AND f.status IN ('FT', 'AET', 'PEN', 'CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST')
  LOOP
    v_total := v_total + public.settle_swipe_predictions_for_fixture(v_fixture_id);
  END LOOP;
  RETURN v_total;
END;
$$;


--
-- Name: settle_live_game_score(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_live_game_score(p_game_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture_id UUID; v_status TEXT; v_gh INTEGER; v_ga INTEGER; v_actual TEXT;
  v_entry RECORD; v_ph INTEGER; v_pa INTEGER; v_pred TEXT;
  v_diff_err INTEGER; v_diff_pts INTEGER; v_res_pts INTEGER; v_bonus_pts INTEGER;
  v_q JSONB; v_total INTEGER; v_count INTEGER := 0;
  v_cfg public.live_pred_config; v_malus NUMERIC;
BEGIN
  SELECT lg.fixture_id INTO v_fixture_id FROM public.live_games lg WHERE lg.id = p_game_id;
  IF NOT FOUND THEN RETURN 0; END IF;
  SELECT * INTO v_cfg FROM public.live_pred_config WHERE id = 1;
  v_malus := (100 - COALESCE(v_cfg.halftime_malus_pct,40)) / 100.0;

  SELECT f.status, f.goals_home, f.goals_away INTO v_status, v_gh, v_ga
  FROM public.fb_fixtures f WHERE f.id = v_fixture_id;

  IF v_status IN ('CANC','ABD','WO','AWD','POST','PST') THEN
    UPDATE public.live_games SET status='cancelled', updated_at=now() WHERE id=p_game_id; RETURN 0;
  ELSIF v_status NOT IN ('FT','AET','PEN') THEN RETURN 0; END IF;

  v_gh := COALESCE(v_gh,0); v_ga := COALESCE(v_ga,0);
  v_actual := CASE WHEN v_gh > v_ga THEN 'home' WHEN v_gh < v_ga THEN 'away' ELSE 'draw' END;

  FOR v_entry IN
    SELECT id, predicted_score, bonus_questions, bonus_answers, midtime_edit
    FROM public.live_game_entries WHERE live_game_id=p_game_id AND predicted_score IS NOT NULL
  LOOP
    v_ph := COALESCE((v_entry.predicted_score->>'home')::int,0);
    v_pa := COALESCE((v_entry.predicted_score->>'away')::int,0);
    v_pred := CASE WHEN v_ph > v_pa THEN 'home' WHEN v_ph < v_pa THEN 'away' ELSE 'draw' END;

    v_diff_err := abs((v_ph - v_pa) - (v_gh - v_ga));
    v_diff_pts := COALESCE((v_cfg.diff_points -> LEAST(v_diff_err, jsonb_array_length(v_cfg.diff_points)-1))::text::int, 0);
    v_res_pts := CASE WHEN v_pred = v_actual THEN v_cfg.result_points ELSE 0 END;

    v_bonus_pts := 0;
    FOR v_q IN SELECT * FROM jsonb_array_elements(COALESCE(v_entry.bonus_questions,'[]'::jsonb)) LOOP
      IF v_entry.bonus_answers->>(v_q->>'key') = public.live_bonus_correct(v_q->>'key', v_entry.predicted_score, v_gh, v_ga) THEN
        v_bonus_pts := v_bonus_pts + COALESCE((v_q->>'points')::int,0);
      END IF;
    END LOOP;

    v_total := CASE WHEN v_entry.midtime_edit
      THEN round((v_diff_pts + v_res_pts) * v_malus) ELSE (v_diff_pts + v_res_pts) END + v_bonus_pts;

    UPDATE public.live_game_entries SET total_points=v_total, goal_diff_error=v_diff_err WHERE id=v_entry.id;
    v_count := v_count + 1;
  END LOOP;

  WITH ranked AS (
    SELECT id, ROW_NUMBER() OVER (ORDER BY total_points DESC, COALESCE(goal_diff_error,99) ASC) AS rnk
    FROM public.live_game_entries WHERE live_game_id=p_game_id AND predicted_score IS NOT NULL
  ) UPDATE public.live_game_entries e SET rank=r.rnk FROM ranked r WHERE e.id=r.id;

  UPDATE public.live_games SET status='finished', updated_at=now() WHERE id=p_game_id;
  RETURN v_count;
END; $$;


--
-- Name: settle_match_bets(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_match_bets(p_fixture_id uuid DEFAULT NULL::uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
declare
  r         record;
  v_outcome text;
  v_count   integer := 0;
begin
  for r in
    select b.id, b.user_id, b.amount, b.potential_win, b.prediction,
           f.goals_home, f.goals_away
    from public.match_bets b
    join public.fb_fixtures f on f.id = b.fixture_id
    where b.status = 'pending'
      and f.status = 'FT'
      and f.goals_home is not null
      and f.goals_away is not null
      and (p_fixture_id is null or b.fixture_id = p_fixture_id)
    for update of b
  loop
    v_outcome := case
      when r.goals_home > r.goals_away then 'teamA'
      when r.goals_home < r.goals_away then 'teamB'
      else 'draw'
    end;

    if r.prediction = v_outcome then
      update public.match_bets set status = 'won', settled_at = now(), updated_at = now() where id = r.id;
      update public.users set coins_balance = coins_balance + r.potential_win where id = r.user_id;
    else
      update public.match_bets set status = 'lost', settled_at = now(), updated_at = now() where id = r.id;
    end if;
    v_count := v_count + 1;
  end loop;
  return v_count;
end;
$$;


--
-- Name: settle_swipe_predictions_for_fixture(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public', 'pg_temp'
    AS $$
DECLARE
  v_fixture RECORD; v_result TEXT; v_is_void BOOLEAN := false;
  v_pred RECORD; v_odds NUMERIC; v_correct BOOLEAN; v_points INTEGER;
  v_mult NUMERIC; v_count INTEGER := 0; v_chal UUID;
BEGIN
  SELECT id, status, goals_home, goals_away INTO v_fixture
  FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF NOT FOUND THEN RETURN 0; END IF;

  IF v_fixture.status IN ('FT', 'AET', 'PEN') THEN
    IF COALESCE(v_fixture.goals_home, 0) > COALESCE(v_fixture.goals_away, 0) THEN v_result := 'home';
    ELSIF COALESCE(v_fixture.goals_home, 0) < COALESCE(v_fixture.goals_away, 0) THEN v_result := 'away';
    ELSE v_result := 'draw'; END IF;
  ELSIF v_fixture.status IN ('CANC', 'ABD', 'WO', 'AWD', 'POST', 'PST') THEN
    v_is_void := true;
  ELSE
    RETURN 0;
  END IF;

  FOR v_pred IN
    SELECT id, prediction, odds_at_prediction, booster
    FROM public.swipe_predictions
    WHERE fixture_id = p_fixture_id AND is_correct IS NULL
  LOOP
    IF v_is_void THEN
      v_correct := false; v_points := 0;
    ELSE
      v_correct := (v_pred.prediction = v_result);
      IF v_correct THEN
        v_odds := COALESCE((v_pred.odds_at_prediction->>v_pred.prediction)::NUMERIC, 1);
        v_mult := CASE v_pred.booster WHEN 'x2' THEN 2 WHEN 'x3' THEN 3 ELSE 1 END;
        v_points := ROUND(v_odds * 100 * v_mult);
      ELSE
        v_points := 0;
      END IF;
    END IF;

    UPDATE public.swipe_predictions
    SET is_correct = v_correct, points_earned = v_points
    WHERE id = v_pred.id;
    v_count := v_count + 1;
  END LOOP;

  FOR v_chal IN
    SELECT DISTINCT challenge_id FROM public.swipe_predictions WHERE fixture_id = p_fixture_id
  LOOP
    PERFORM public.update_challenge_rankings(v_chal);
  END LOOP;

  RETURN v_count;
END;
$$;


--
-- Name: spin_wheel(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.spin_wheel(p_tier text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user UUID := auth.uid();
  v_last TIMESTAMPTZ;
  v_avail INT;
  v_total NUMERIC;
  v_rand NUMERIC;
  v_cum NUMERIC := 0;
  v_seg RECORD;
  v_win RECORD;
  v_idx INT := 0;
  v_reward JSONB;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok', false, 'error', 'not authenticated'); END IF;
  IF p_tier NOT IN ('free','amateur','master','apex','premium') THEN RETURN jsonb_build_object('ok', false, 'error', 'invalid tier'); END IF;

  -- Ensure a spin state row exists.
  INSERT INTO public.user_spin_states (user_id) VALUES (v_user) ON CONFLICT (user_id) DO NOTHING;

  -- Eligibility
  IF p_tier = 'free' THEN
    SELECT last_free_spin_at INTO v_last FROM public.user_spin_states WHERE user_id = v_user;
    IF v_last IS NOT NULL AND (now() - v_last) < INTERVAL '24 hours' THEN
      RETURN jsonb_build_object('ok', false, 'error', 'cooldown', 'next_at', v_last + INTERVAL '24 hours');
    END IF;
    UPDATE public.user_spin_states SET last_free_spin_at = now(), updated_at = now() WHERE user_id = v_user;
  ELSE
    SELECT COALESCE((available_spins->>p_tier)::INT, 0) INTO v_avail FROM public.user_spin_states WHERE user_id = v_user;
    IF v_avail < 1 THEN RETURN jsonb_build_object('ok', false, 'error', 'no_spins'); END IF;
    UPDATE public.user_spin_states
    SET available_spins = jsonb_set(available_spins, ARRAY[p_tier], to_jsonb(v_avail - 1)), updated_at = now()
    WHERE user_id = v_user;
  END IF;

  -- Weighted draw
  SELECT COALESCE(sum(base_chance), 0) INTO v_total FROM public.spin_segments WHERE tier = p_tier AND is_active;
  IF v_total <= 0 THEN RETURN jsonb_build_object('ok', false, 'error', 'no segments for tier'); END IF;
  v_rand := random() * v_total;
  FOR v_seg IN SELECT * FROM public.spin_segments WHERE tier = p_tier AND is_active ORDER BY sort_order LOOP
    v_cum := v_cum + v_seg.base_chance;
    IF v_rand <= v_cum THEN v_win := v_seg; EXIT; END IF;
    v_idx := v_idx + 1;
  END LOOP;
  IF v_win IS NULL THEN SELECT * INTO v_win FROM public.spin_segments WHERE tier = p_tier AND is_active ORDER BY sort_order LIMIT 1; v_idx := 0; END IF;

  -- Build reward + grant
  v_reward := CASE v_win.category
    WHEN 'coins'      THEN jsonb_build_object('type','coins','value',v_win.value,'quantity',1)
    WHEN 'xp'         THEN jsonb_build_object('type','xp','value',v_win.value,'quantity',1)
    WHEN 'ticket'     THEN jsonb_build_object('type','ticket','tier',COALESCE(v_win.reward_tier,'amateur'),'quantity',1)
    WHEN 'spin'       THEN jsonb_build_object('type','spin','tier',COALESCE(v_win.reward_tier,p_tier),'quantity',1)
    WHEN 'masterpass' THEN jsonb_build_object('type','masterpass','tier',COALESCE(v_win.reward_tier,p_tier),'name',v_win.label,'quantity',1)
    WHEN 'premium'    THEN jsonb_build_object('type','premium','value',COALESCE(v_win.value,7),'quantity',1)
    WHEN 'gift_card'  THEN jsonb_build_object('type','giftcard','value',v_win.value,'name',v_win.label,'quantity',1)
    ELSE NULL END;
  IF v_reward IS NOT NULL THEN
    BEGIN PERFORM public.distribute_reward_to_user(v_user, v_reward, 'spin', NULL);
    EXCEPTION WHEN OTHERS THEN RAISE NOTICE 'spin grant failed: %', SQLERRM; END;
  END IF;

  -- History (best-effort)
  BEGIN PERFORM public.record_spin(v_user, p_tier, v_win.label, v_win.category);
  EXCEPTION WHEN OTHERS THEN NULL; END;

  RETURN jsonb_build_object('ok', true, 'segment_id', v_win.id, 'index', v_idx,
    'label', v_win.label, 'category', v_win.category, 'value', v_win.value, 'reward_tier', v_win.reward_tier);
END;
$$;


--
-- Name: squad_block_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.squad_block_member(p_actor uuid, p_squad_id uuid, p_target uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  DELETE FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_target;
  INSERT INTO public.squad_blocks (squad_id, user_id, blocked_by)
  VALUES (p_squad_id, p_target, p_actor)
  ON CONFLICT (squad_id, user_id) DO NOTHING;
END;
$$;


--
-- Name: squad_remove_member(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.squad_remove_member(p_actor uuid, p_squad_id uuid, p_target uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  DELETE FROM public.squad_members WHERE squad_id = p_squad_id AND user_id = p_target;
END;
$$;


--
-- Name: squad_set_member_role(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.squad_set_member_role(p_actor uuid, p_squad_id uuid, p_target uuid, p_role text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_role NOT IN ('admin', 'member') THEN RAISE EXCEPTION 'invalid_role'; END IF;
  PERFORM public._squad_admin_guard(p_actor, p_squad_id, p_target);
  UPDATE public.squad_members SET role = p_role WHERE squad_id = p_squad_id AND user_id = p_target;
END;
$$;


--
-- Name: submit_live_prediction(uuid, uuid, integer, integer, jsonb, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_fixture_id UUID;
  v_date TIMESTAMPTZ;
  v_sit TEXT;
  v_subpool TEXT[];
  v_keys TEXT[];
  v_points INT[];
  v_k TEXT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_home < 0 OR p_away < 0 THEN RAISE EXCEPTION 'invalid_score'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.live_game_entries
                 WHERE live_game_id = p_game_id AND user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_joined';
  END IF;

  SELECT fixture_id INTO v_fixture_id FROM public.live_games WHERE id = p_game_id;
  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = v_fixture_id;
  IF v_date IS NULL OR v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  -- Validate the 3 questions belong to the situation's sub-pool, are distinct, 20/10/10.
  v_sit := public.live_situation(p_home, p_away);
  v_subpool := public.live_bonus_subpool(v_sit);
  SELECT array_agg(q->>'key'), array_agg((q->>'points')::int)
    INTO v_keys, v_points
  FROM jsonb_array_elements(COALESCE(p_questions, '[]'::jsonb)) q;

  IF v_keys IS NULL OR array_length(v_keys, 1) <> 3 THEN RAISE EXCEPTION 'invalid_questions'; END IF;
  IF (SELECT count(DISTINCT k) FROM unnest(v_keys) k) <> 3 THEN RAISE EXCEPTION 'duplicate_questions'; END IF;
  FOREACH v_k IN ARRAY v_keys LOOP
    IF NOT (v_k = ANY(v_subpool)) THEN RAISE EXCEPTION 'question_not_in_situation'; END IF;
  END LOOP;
  IF (SELECT array_agg(p ORDER BY p) FROM unnest(v_points) p) <> ARRAY[10,10,20] THEN
    RAISE EXCEPTION 'invalid_points';
  END IF;

  UPDATE public.live_game_entries
  SET predicted_score = jsonb_build_object('home', p_home, 'away', p_away),
      bonus_questions = p_questions,
      bonus_answers   = COALESCE(p_answers, '{}'::jsonb),
      midtime_edit    = false,
      submitted_at    = now()
  WHERE live_game_id = p_game_id AND user_id = p_user_id;
END;
$$;


--
-- Name: swipe_set_booster(uuid, uuid, uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.swipe_set_booster(p_challenge_id uuid, p_matchday_id uuid, p_fixture_id uuid, p_booster text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_uid UUID := auth.uid(); v_date TIMESTAMPTZ;
BEGIN
  IF v_uid IS NULL THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF p_booster IS NOT NULL AND p_booster NOT IN ('x2', 'x3') THEN RAISE EXCEPTION 'invalid_booster'; END IF;

  -- A booster can't be changed once the match has kicked off.
  SELECT date INTO v_date FROM public.fb_fixtures WHERE id = p_fixture_id;
  IF v_date IS NOT NULL AND v_date <= now() THEN RAISE EXCEPTION 'match_started'; END IF;

  IF p_booster IS NULL THEN
    UPDATE public.swipe_predictions SET booster = NULL, updated_at = now()
    WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id;
    RETURN;
  END IF;

  -- You can only boost a match you've predicted.
  IF NOT EXISTS (
    SELECT 1 FROM public.swipe_predictions
    WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id
  ) THEN
    RAISE EXCEPTION 'no_prediction';
  END IF;

  -- One of each type per game: free this type from any other match first.
  UPDATE public.swipe_predictions SET booster = NULL, updated_at = now()
  WHERE challenge_id = p_challenge_id AND user_id = v_uid AND booster = p_booster AND fixture_id <> p_fixture_id;

  -- Apply (replaces any other booster already on this same match).
  UPDATE public.swipe_predictions SET booster = p_booster, updated_at = now()
  WHERE challenge_id = p_challenge_id AND user_id = v_uid AND fixture_id = p_fixture_id;
END $$;


--
-- Name: sync_fb_odds_to_odds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_fb_odds_to_odds() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION sync_fb_odds_to_odds(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_fb_odds_to_odds() IS 'Synchronise automatiquement les odds de fb_odds vers odds lors des INSERT/UPDATE';


--
-- Name: sync_preferred_bookmaker_odds(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_preferred_bookmaker_odds() RETURNS TABLE(synced_count integer)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
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


--
-- Name: FUNCTION sync_preferred_bookmaker_odds(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.sync_preferred_bookmaker_odds() IS 'Synchronise uniquement les odds du bookmaker préféré';


--
-- Name: sync_user_role_flags(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.sync_user_role_flags() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.is_super_admin := NEW.user_type = 'super_admin';
  NEW.is_admin := NEW.user_type IN ('admin', 'super_admin');
  RETURN NEW;
END;
$$;


--
-- Name: tm_player_trail(bigint); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tm_player_trail(p_player_id bigint) RETURNS jsonb
    LANGUAGE plpgsql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $_$
DECLARE seqarr TEXT[]; out TEXT[] := '{}'; cl TEXT; prev TEXT := '';
BEGIN
  SELECT array_agg(club ORDER BY ord) INTO seqarr FROM (
    (SELECT from_club_name AS club, 0::numeric AS ord FROM public.tm_transfers WHERE player_id=p_player_id ORDER BY seq LIMIT 1)
    UNION ALL
    (SELECT to_club_name, row_number() OVER (ORDER BY seq) FROM public.tm_transfers WHERE player_id=p_player_id)
  ) z;
  IF seqarr IS NULL THEN RETURN '[]'::jsonb; END IF;
  FOREACH cl IN ARRAY seqarr LOOP
    CONTINUE WHEN cl IS NULL OR cl = '';
    CONTINUE WHEN cl ~* '(U1[5-9]|U2[0-3]|youth|yth|giov|jugend|reserve|castilla|without club| B$| II$| C$)';
    IF cl <> prev THEN out := array_append(out, cl); prev := cl; END IF;
  END LOOP;
  RETURN COALESCE((SELECT jsonb_agg(jsonb_build_object('name', e)) FROM unnest(out) e), '[]'::jsonb);
END $_$;


--
-- Name: tq_admin_advance_round(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_admin_advance_round(p_comp uuid, p_from text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_advance_round(p_comp, p_from);
END; $$;


--
-- Name: tq_admin_generate_bracket(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_admin_generate_bracket(p_comp uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_generate_bracket(p_comp);
END; $$;


--
-- Name: tq_admin_import_groups(uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_admin_import_groups(p_comp uuid, p_spec jsonb) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE g JSONB; tm JSONB; v_grp UUID; v_team UUID; gi INT := 0; ti INT; n_groups INT := 0; n_teams INT := 0;
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  FOR g IN SELECT * FROM jsonb_array_elements(p_spec) LOOP
    v_grp := gen_random_uuid();
    INSERT INTO public.tq_groups (id, competition_id, name, sort_order, qualified_count)
    VALUES (v_grp, p_comp, COALESCE(g->>'name','Group ' || chr(65+gi)), gi, COALESCE((g->>'qualified')::int, 2));
    n_groups := n_groups + 1; ti := 0;
    FOR tm IN SELECT * FROM jsonb_array_elements(COALESCE(g->'teams','[]'::jsonb)) LOOP
      ti := ti + 1;
      INSERT INTO public.tq_teams (id, competition_id, name, short_name, flag_url)
      VALUES (gen_random_uuid(), p_comp, tm->>'name', tm->>'short', tm->>'flag')
      RETURNING id INTO v_team;
      INSERT INTO public.tq_group_teams (group_id, team_id, seed_order) VALUES (v_grp, v_team, ti);
      n_teams := n_teams + 1;
    END LOOP;
    gi := gi + 1;
  END LOOP;
  RETURN jsonb_build_object('ok', true, 'groups', n_groups, 'teams', n_teams);
END; $$;


--
-- Name: tq_admin_resolve(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_admin_resolve(p_comp uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NOT public.is_admin() THEN RAISE EXCEPTION 'Admin only'; END IF;
  RETURN public.tq_resolve(p_comp);
END; $$;


--
-- Name: tq_advance_round(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_advance_round(p_comp uuid, p_from text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_rounds JSONB; v_idx INT; v_next TEXT; v_winners UUID[]; i INT; created INT := 0;
BEGIN
  v_rounds := public.tq_detect_format(p_comp)->'knockout_rounds';
  SELECT ord - 1 INTO v_idx FROM jsonb_array_elements_text(v_rounds) WITH ORDINALITY AS x(val, ord) WHERE val = p_from;
  IF v_idx IS NULL OR (v_idx + 1) >= jsonb_array_length(v_rounds) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'no next round after ' || p_from);
  END IF;
  v_next := v_rounds->>(v_idx + 1);

  SELECT array_agg(winner_team_id ORDER BY bracket_slot) INTO v_winners
  FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = p_from AND status = 'finished' AND winner_team_id IS NOT NULL;
  IF v_winners IS NULL OR array_length(v_winners,1) % 2 <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'round ' || p_from || ' not fully resolved');
  END IF;

  DELETE FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = v_next;
  i := 1;
  WHILE i <= array_length(v_winners, 1) LOOP
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_next, created, v_winners[i], v_winners[i+1], 'scheduled');
    created := created + 1; i := i + 2;
  END LOOP;

  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES (p_comp, v_next, 'open')
    ON CONFLICT (competition_id, phase_key) DO UPDATE SET state = 'open';
  RETURN jsonb_build_object('ok', true, 'next', v_next, 'matches', created);
END;
$$;


--
-- Name: tq_claim_masterpass_invite(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_claim_masterpass_invite(p_token text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_inv public.tq_masterpass_invites;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT * INTO v_inv FROM public.tq_masterpass_invites WHERE token = p_token;
  IF v_inv.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','invalid_invite'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','already_used'); END IF;
  IF v_inv.inviter_id = v_user THEN RETURN jsonb_build_object('ok',false,'error','cannot_claim_own'); END IF;

  PERFORM public._mp_create_entry(v_inv.game_type, v_inv.game_id, v_user);
  UPDATE public.tq_masterpass_invites SET status='claimed', claimed_by=v_user, claimed_at=now() WHERE id=v_inv.id;
  RETURN jsonb_build_object('ok',true,'game_type',v_inv.game_type,'game_id',v_inv.game_id);
END; $$;


--
-- Name: tq_detect_format(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_detect_format(p_competition_id uuid) RETURNS jsonb
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  WITH cfg AS (SELECT config_json FROM public.tq_competitions WHERE id = p_competition_id),
  g AS (
    SELECT count(*)::int AS groups_count,
           COALESCE(sum(qualified_count), 0)::int AS direct_qualifiers,
           COALESCE(max(qualified_count), 0)::int AS max_qualified
    FROM public.tq_groups WHERE competition_id = p_competition_id
  ),
  gt AS (
    SELECT COALESCE(count(*),0)::int AS teams_count
    FROM public.tq_group_teams gtx
    JOIN public.tq_groups gr ON gr.id = gtx.group_id
    WHERE gr.competition_id = p_competition_id
  ),
  best AS (
    SELECT COALESCE(((SELECT config_json FROM cfg)->'format'->>'best_thirds_count')::int, 0) AS best_thirds
  )
  SELECT jsonb_build_object(
    'groups_count', g.groups_count,
    'teams_count', gt.teams_count,
    'teams_per_group', CASE WHEN g.groups_count > 0 THEN round(gt.teams_count::numeric / g.groups_count, 1) ELSE 0 END,
    'direct_qualifiers', g.direct_qualifiers,
    'best_thirds', best.best_thirds,
    'knockout_participants', g.direct_qualifiers + best.best_thirds,
    'group_matches_per_group', CASE WHEN g.groups_count > 0
        THEN (gt.teams_count / NULLIF(g.groups_count,0)) * ((gt.teams_count / NULLIF(g.groups_count,0)) - 1) / 2 ELSE 0 END,
    'knockout_rounds', COALESCE(
        ((SELECT config_json FROM cfg)->'format'->'knockout_rounds'),
        to_jsonb(public.tq_rounds_for(g.direct_qualifiers + best.best_thirds))),
    'third_place_match', COALESCE(((SELECT config_json FROM cfg)->'format'->>'third_place_match')::boolean, false)
  )
  FROM g, gt, best;
$$;


--
-- Name: tq_generate_bracket(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_generate_bracket(p_comp uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_round TEXT; v_groups UUID[]; n INT; k INT; created INT := 0;
  wa UUID; ra UUID; wb UUID; rb UUID;
BEGIN
  v_round := (public.tq_detect_format(p_comp)->'knockout_rounds'->>0);
  IF v_round IS NULL THEN RETURN jsonb_build_object('ok', false, 'reason', 'no knockout rounds'); END IF;

  SELECT array_agg(id ORDER BY sort_order) INTO v_groups FROM public.tq_groups WHERE competition_id = p_comp;
  n := COALESCE(array_length(v_groups, 1), 0);
  IF n = 0 OR n % 2 <> 0 THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'this generator needs an even number of groups (top-2)');
  END IF;
  -- require standings resolved
  IF EXISTS (SELECT 1 FROM public.tq_group_teams gt JOIN public.tq_groups g ON g.id = gt.group_id
             WHERE g.competition_id = p_comp AND gt.final_rank IS NULL) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'group standings not resolved (final_rank missing)');
  END IF;

  DELETE FROM public.tq_matches WHERE competition_id = p_comp AND knockout_round = v_round;
  k := 1;
  WHILE k <= n LOOP
    SELECT team_id INTO wa FROM public.tq_group_teams WHERE group_id = v_groups[k]   AND final_rank = 1;
    SELECT team_id INTO ra FROM public.tq_group_teams WHERE group_id = v_groups[k]   AND final_rank = 2;
    SELECT team_id INTO wb FROM public.tq_group_teams WHERE group_id = v_groups[k+1] AND final_rank = 1;
    SELECT team_id INTO rb FROM public.tq_group_teams WHERE group_id = v_groups[k+1] AND final_rank = 2;
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_round, created, wa, rb, 'scheduled'); created := created + 1;
    INSERT INTO public.tq_matches (competition_id, knockout_round, bracket_slot, team_a_id, team_b_id, status)
      VALUES (p_comp, v_round, created, wb, ra, 'scheduled'); created := created + 1;
    k := k + 2;
  END LOOP;

  INSERT INTO public.tq_phase_windows (competition_id, phase_key, state) VALUES (p_comp, v_round, 'open')
    ON CONFLICT (competition_id, phase_key) DO UPDATE SET state = 'open';
  RETURN jsonb_build_object('ok', true, 'round', v_round, 'matches', created);
END;
$$;


--
-- Name: tq_get_or_create_entry(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_get_or_create_entry(p_comp uuid) RETURNS uuid
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_id UUID;
BEGIN
  IF auth.uid() IS NULL THEN RAISE EXCEPTION 'Not authenticated'; END IF;
  SELECT id INTO v_id FROM public.tq_entries WHERE user_id = auth.uid() AND competition_id = p_comp;
  IF v_id IS NULL THEN
    INSERT INTO public.tq_entries (user_id, competition_id) VALUES (auth.uid(), p_comp) RETURNING id INTO v_id;
  END IF;
  RETURN v_id;
END;
$$;


--
-- Name: tq_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    competition_id uuid NOT NULL,
    total_score integer DEFAULT 0 NOT NULL,
    long_term_score integer DEFAULT 0 NOT NULL,
    group_score integer DEFAULT 0 NOT NULL,
    daily_score integer DEFAULT 0 NOT NULL,
    bracket_score integer DEFAULT 0 NOT NULL,
    exact_score_predictions_count integer DEFAULT 0 NOT NULL,
    correct_bracket_predictions_count integer DEFAULT 0 NOT NULL,
    total_goals_prediction integer,
    total_goals_tiebreak_delta integer,
    last_prediction_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tq_join_competition(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_join_competition(p_user_id uuid, p_competition_id uuid) RETURNS public.tq_entries
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entry public.tq_entries; v_cost INT; v_bal INT;
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;

  SELECT id INTO v_entry FROM public.tq_entries WHERE user_id = p_user_id AND competition_id = p_competition_id;
  IF v_entry.id IS NOT NULL THEN RETURN v_entry; END IF; -- idempotent

  SELECT entry_cost INTO v_cost FROM public.tq_competitions WHERE id = p_competition_id;
  IF COALESCE(v_cost,0) > 0 THEN
    SELECT coins INTO v_bal FROM public.users WHERE id = p_user_id FOR UPDATE;
    IF COALESCE(v_bal,0) < v_cost THEN RAISE EXCEPTION 'Insufficient balance'; END IF;
    UPDATE public.users SET coins = coins - v_cost WHERE id = p_user_id;
  END IF;

  INSERT INTO public.tq_entries (user_id, competition_id) VALUES (p_user_id, p_competition_id)
  RETURNING * INTO v_entry;
  RETURN v_entry;
END;
$$;


--
-- Name: tq_masterpass_invite_username(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_masterpass_invite_username(p_invite_id uuid, p_username text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user UUID := auth.uid(); v_inv public.tq_masterpass_invites; v_target UUID; v_comp TEXT; v_me TEXT;
BEGIN
  SELECT * INTO v_inv FROM public.tq_masterpass_invites WHERE id = p_invite_id;
  IF v_inv.id IS NULL OR v_inv.inviter_id <> v_user THEN RETURN jsonb_build_object('ok',false,'error','not_your_invite'); END IF;
  IF v_inv.status <> 'pending' THEN RETURN jsonb_build_object('ok',false,'error','already_used'); END IF;
  SELECT id INTO v_target FROM public.users WHERE lower(username) = lower(p_username);
  IF v_target IS NULL THEN RETURN jsonb_build_object('ok',false,'error','user_not_found'); END IF;
  IF v_target = v_user THEN RETURN jsonb_build_object('ok',false,'error','cannot_invite_self'); END IF;

  UPDATE public.tq_masterpass_invites SET invitee_user_id = v_target WHERE id = p_invite_id;
  SELECT name INTO v_comp FROM public.tq_competitions WHERE id = v_inv.competition_id;
  SELECT username INTO v_me FROM public.users WHERE id = v_user;
  INSERT INTO public.notifications(user_id, type, title, message, action_label, action_link, metadata)
  VALUES(v_target, 'gameplay', 'MasterPass invite',
    COALESCE(v_me,'A player')||' invited you to join '||COALESCE(v_comp,'a tournament')||' — free entry!',
    'Join', 'sportime://masterpass/'||v_inv.token,
    jsonb_build_object('kind','masterpass_invite','token',v_inv.token,'competition_id',v_inv.competition_id));
  RETURN jsonb_build_object('ok',true,'invited',p_username);
END;
$$;


--
-- Name: tq_phase_open(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_phase_open(p_comp uuid, p_phase text) RETURNS boolean
    LANGUAGE sql STABLE SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
  SELECT COALESCE((
    SELECT (state = 'open' AND (locks_at IS NULL OR now() < locks_at))
    FROM public.tq_phase_windows WHERE competition_id = p_comp AND phase_key = p_phase
  ), true);
$$;


--
-- Name: tq_recalc_leaderboard(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_recalc_leaderboard(p_competition_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE n INTEGER;
BEGIN
  -- roll each entry's total
  UPDATE public.tq_entries e
    SET total_score = COALESCE(long_term_score,0) + COALESCE(group_score,0)
                    + COALESCE(daily_score,0) + COALESCE(bracket_score,0),
        updated_at = now()
  WHERE competition_id = p_competition_id;

  DELETE FROM public.tq_leaderboard WHERE competition_id = p_competition_id;
  INSERT INTO public.tq_leaderboard (competition_id, entry_id, user_id, username, avatar, total_score, tiebreak_delta, rank)
  SELECT p_competition_id, e.id, e.user_id,
         u.username, u.profile_picture_url, e.total_score, e.total_goals_tiebreak_delta,
         RANK() OVER (ORDER BY
            e.total_score DESC,
            e.total_goals_tiebreak_delta ASC NULLS LAST,
            e.exact_score_predictions_count DESC,
            e.correct_bracket_predictions_count DESC,
            e.last_prediction_at ASC NULLS LAST)
  FROM public.tq_entries e
  LEFT JOIN public.users u ON u.id = e.user_id
  WHERE e.competition_id = p_competition_id;

  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END;
$$;


--
-- Name: tq_resolve(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_resolve(p_competition_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE e RECORD;
BEGIN
  FOR e IN SELECT id FROM public.tq_entries WHERE competition_id = p_competition_id LOOP
    PERFORM public.tq_score_group(e.id);
    PERFORM public.tq_score_daily(e.id);
    PERFORM public.tq_score_bracket(e.id);
    PERFORM public.tq_score_long_term(e.id);
  END LOOP;
  PERFORM public.tq_recalc_leaderboard(p_competition_id);
  RETURN jsonb_build_object('ok', true, 'format', public.tq_detect_format(p_competition_id));
END;
$$;


--
-- Name: tq_rounds_for(integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_rounds_for(p_participants integer) RETURNS text[]
    LANGUAGE sql IMMUTABLE
    AS $$
  SELECT CASE
    WHEN p_participants >= 32 THEN ARRAY['R32','R16','QF','SF','F']
    WHEN p_participants >= 16 THEN ARRAY['R16','QF','SF','F']
    WHEN p_participants >= 8  THEN ARRAY['QF','SF','F']
    WHEN p_participants >= 4  THEN ARRAY['SF','F']
    WHEN p_participants >= 2  THEN ARRAY['F']
    ELSE ARRAY[]::TEXT[]
  END;
$$;


--
-- Name: tq_save_bracket_prediction(uuid, text, uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_save_bracket_prediction(p_comp uuid, p_round_key text, p_team_ids uuid[]) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entry UUID; tid UUID;
BEGIN
  IF NOT public.tq_phase_open(p_comp, p_round_key) THEN RAISE EXCEPTION 'This round is locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  DELETE FROM public.tq_bracket_predictions WHERE entry_id = v_entry AND round_key = p_round_key;
  FOREACH tid IN ARRAY p_team_ids LOOP
    INSERT INTO public.tq_bracket_predictions (entry_id, round_key, predicted_winner_team_id)
    VALUES (v_entry, p_round_key, tid);
  END LOOP;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;


--
-- Name: tq_save_daily_prediction(uuid, uuid, integer, integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_score_a integer, p_score_b integer, p_bonus text DEFAULT NULL::text) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entry UUID; v_start TIMESTAMPTZ; v_status TEXT; v_result TEXT;
BEGIN
  SELECT start_time, status INTO v_start, v_status FROM public.tq_matches WHERE id = p_match_id AND competition_id = p_comp;
  IF v_status <> 'scheduled' OR (v_start IS NOT NULL AND now() >= v_start) THEN RAISE EXCEPTION 'This match is locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  v_result := CASE WHEN p_score_a > p_score_b THEN 'A' WHEN p_score_a < p_score_b THEN 'B' ELSE 'draw' END;
  INSERT INTO public.tq_daily_predictions (entry_id, match_id, predicted_result, predicted_score_a, predicted_score_b, predicted_bonus)
  VALUES (v_entry, p_match_id, v_result, p_score_a, p_score_b, p_bonus)
  ON CONFLICT (entry_id, match_id) DO UPDATE SET
    predicted_result = EXCLUDED.predicted_result, predicted_score_a = EXCLUDED.predicted_score_a,
    predicted_score_b = EXCLUDED.predicted_score_b, predicted_bonus = EXCLUDED.predicted_bonus;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;


--
-- Name: tq_save_group_prediction(uuid, uuid, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_save_group_prediction(p_comp uuid, p_group_id uuid, p_picks jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entry UUID; pick JSONB;
BEGIN
  IF NOT public.tq_phase_open(p_comp, 'group') THEN RAISE EXCEPTION 'Group predictions are locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  DELETE FROM public.tq_group_predictions WHERE entry_id = v_entry AND group_id = p_group_id;
  FOR pick IN SELECT * FROM jsonb_array_elements(p_picks) LOOP
    INSERT INTO public.tq_group_predictions (entry_id, group_id, predicted_team_id, predicted_position)
    VALUES (v_entry, p_group_id, (pick->>'team_id')::uuid, (pick->>'position')::int);
  END LOOP;
  UPDATE public.tq_entries SET last_prediction_at = now() WHERE id = v_entry;
END;
$$;


--
-- Name: tq_save_long_term(uuid, uuid, uuid, uuid, integer, jsonb); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_save_long_term(p_comp uuid, p_champion uuid, p_finalist uuid, p_top_scorer uuid DEFAULT NULL::uuid, p_total_goals integer DEFAULT NULL::integer, p_extras jsonb DEFAULT '{}'::jsonb) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_entry UUID;
BEGIN
  IF NOT public.tq_phase_open(p_comp, 'long_term') THEN RAISE EXCEPTION 'Long-term predictions are locked'; END IF;
  v_entry := public.tq_get_or_create_entry(p_comp);
  INSERT INTO public.tq_long_term_predictions (entry_id, champion_team_id, finalist_team_id, top_scorer_player_id, total_goals_prediction, extras_json)
  VALUES (v_entry, p_champion, p_finalist, p_top_scorer, p_total_goals, COALESCE(p_extras,'{}'::jsonb))
  ON CONFLICT (entry_id) DO UPDATE SET
    champion_team_id = EXCLUDED.champion_team_id, finalist_team_id = EXCLUDED.finalist_team_id,
    top_scorer_player_id = EXCLUDED.top_scorer_player_id, total_goals_prediction = EXCLUDED.total_goals_prediction, extras_json = EXCLUDED.extras_json;
  UPDATE public.tq_entries SET total_goals_prediction = p_total_goals, last_prediction_at = now() WHERE id = v_entry;
END;
$$;


--
-- Name: tq_score_bracket(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_score_bracket(p_entry_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; v_correct INT := 0; r RECORD;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'bracket';
  FOR r IN SELECT bp.id, bp.round_key, bp.predicted_winner_team_id
           FROM public.tq_bracket_predictions bp WHERE bp.entry_id = p_entry_id
  LOOP
    DECLARE
      advanced BOOLEAN; w INT; pts INT;
    BEGIN
      w := COALESCE((v_cfg->'scoring'->'bracket'->>r.round_key)::int, 0);
      advanced := EXISTS (
        SELECT 1 FROM public.tq_matches m
        WHERE m.competition_id = v_comp AND m.knockout_round = r.round_key
          AND m.winner_team_id = r.predicted_winner_team_id
      );
      pts := CASE WHEN advanced THEN w ELSE 0 END;
      UPDATE public.tq_bracket_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        v_correct := v_correct + 1;
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'bracket', r.id, pts, 'advanced from ' || r.round_key);
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET bracket_score = v_total, correct_bracket_predictions_count = v_correct
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;


--
-- Name: tq_score_daily(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_score_daily(p_entry_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; r RECORD;
  p_result INT; p_exact INT; p_bonus INT; v_cards_line NUMERIC; v_exact_count INT := 0;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  p_result := COALESCE((v_cfg->'scoring'->'daily'->>'result')::int, 10);
  p_exact  := COALESCE((v_cfg->'scoring'->'daily'->>'exact_score')::int, 12);
  p_bonus  := COALESCE((v_cfg->'scoring'->'daily'->>'bonus')::int, 8);
  v_cards_line := COALESCE((v_cfg->'scoring'->'daily'->>'cards_line')::numeric, 3.5);

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'daily';
  FOR r IN
    SELECT dp.id, dp.predicted_score_a pa, dp.predicted_score_b pb, dp.predicted_bonus bonus,
           m.score_a ra, m.score_b rb, m.first_scorer_team_id, m.first_goal_half, m.total_cards
    FROM public.tq_daily_predictions dp
    JOIN public.tq_matches m ON m.id = dp.match_id
    WHERE m.status = 'finished' AND dp.predicted_score_a IS NOT NULL
  LOOP
    DECLARE
      pts INT := 0; res_ok BOOLEAN; dist INT; dpts INT; bonus_ok BOOLEAN := false;
    BEGIN
      res_ok := sign(r.pa - r.pb) = sign(r.ra - r.rb);
      IF res_ok THEN pts := pts + p_result; END IF;
      IF r.pa = r.ra AND r.pb = r.rb THEN pts := pts + p_exact; v_exact_count := v_exact_count + 1; END IF;

      -- degressive goal-difference distance (default 0:15,1:10,2:5,3:2, >=4:0)
      dist := abs((r.pa - r.pb) - (r.ra - r.rb));
      dpts := COALESCE((v_cfg->'scoring'->'daily'->'distance'->>(LEAST(dist,4))::text)::int,
                       CASE dist WHEN 0 THEN 15 WHEN 1 THEN 10 WHEN 2 THEN 5 WHEN 3 THEN 2 ELSE 0 END);
      pts := pts + dpts;

      -- bonus question type is driven by the PREDICTED score
      IF r.pa > 0 AND r.pb > 0 THEN          -- both score -> who scores first (team id)
        bonus_ok := r.bonus IS NOT NULL AND r.bonus = r.first_scorer_team_id::text;
      ELSIF (r.pa > 0) <> (r.pb > 0) THEN     -- exactly one scores -> which half
        bonus_ok := r.bonus IS NOT NULL AND r.bonus = r.first_goal_half;
      ELSE                                    -- 0-0 -> over/under cards
        bonus_ok := (r.bonus = 'over' AND r.total_cards > v_cards_line)
                 OR (r.bonus = 'under' AND r.total_cards <= v_cards_line);
      END IF;
      IF bonus_ok THEN pts := pts + p_bonus; END IF;

      UPDATE public.tq_daily_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'daily', r.id, pts, 'daily match');
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET daily_score = v_total, exact_score_predictions_count = v_exact_count WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;


--
-- Name: tq_score_group(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_score_group(p_entry_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_qpts INT; v_epts INT; v_total INT := 0; r RECORD;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  v_qpts := COALESCE((v_cfg->'scoring'->'group'->>'qualified')::int, 5);
  v_epts := COALESCE((v_cfg->'scoring'->'group'->>'exact_position')::int, 5);

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'group';
  FOR r IN
    SELECT gp.id, gp.predicted_position, gt.final_rank, g.qualified_count
    FROM public.tq_group_predictions gp
    JOIN public.tq_groups g ON g.id = gp.group_id
    LEFT JOIN public.tq_group_teams gt ON gt.group_id = gp.group_id AND gt.team_id = gp.predicted_team_id
  LOOP
    DECLARE pts INT := 0;
    BEGIN
      IF r.final_rank IS NOT NULL THEN
        IF r.final_rank <= r.qualified_count THEN pts := pts + v_qpts; END IF;
        IF r.final_rank = r.predicted_position THEN pts := pts + v_epts; END IF;
      END IF;
      UPDATE public.tq_group_predictions SET points_awarded = pts WHERE id = r.id;
      IF pts > 0 THEN
        INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
        VALUES (p_entry_id, 'group', r.id, pts, 'group qualifier');
      END IF;
      v_total := v_total + pts;
    END;
  END LOOP;

  UPDATE public.tq_entries SET group_score = v_total WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;


--
-- Name: tq_score_long_term(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_score_long_term(p_entry_id uuid) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_comp UUID; v_cfg JSONB; v_total INT := 0; lt RECORD;
  v_champion UUID; v_finalists UUID[]; v_semis UUID[]; v_actual_goals INT; v_top JSONB;
BEGIN
  SELECT competition_id INTO v_comp FROM public.tq_entries WHERE id = p_entry_id;
  SELECT config_json INTO v_cfg FROM public.tq_competitions WHERE id = v_comp;
  SELECT * INTO lt FROM public.tq_long_term_predictions WHERE entry_id = p_entry_id;
  IF lt IS NULL THEN RETURN 0; END IF;

  SELECT winner_team_id, ARRAY[team_a_id, team_b_id] INTO v_champion, v_finalists
  FROM public.tq_matches WHERE competition_id = v_comp AND knockout_round = 'F' AND status = 'finished' LIMIT 1;
  SELECT array_agg(t) INTO v_semis FROM (
    SELECT unnest(ARRAY[team_a_id, team_b_id]) t FROM public.tq_matches WHERE competition_id = v_comp AND knockout_round = 'SF'
  ) s WHERE t IS NOT NULL;

  IF lt.champion_team_id IS NOT NULL THEN
    IF lt.champion_team_id = v_champion THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_exact')::int, 150);
    ELSIF lt.champion_team_id = ANY(v_finalists) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_finalist')::int, 75);
    ELSIF lt.champion_team_id = ANY(v_semis) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'champion_semi')::int, 30);
    END IF;
  END IF;
  IF lt.finalist_team_id IS NOT NULL THEN
    IF lt.finalist_team_id = ANY(v_finalists) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_exact')::int, 100);
    ELSIF lt.finalist_team_id = ANY(v_semis) THEN v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'finalist_semi')::int, 40);
    END IF;
  END IF;

  v_top := v_cfg->'results'->'top_scorer';
  IF lt.top_scorer_player_id IS NOT NULL AND v_top IS NOT NULL THEN
    IF (v_top->>'exact') IS NOT NULL AND lt.top_scorer_player_id::text = (v_top->>'exact') THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_exact')::int, 100);
    ELSIF v_top->'top3' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top3')::int, 40);
    ELSIF v_top->'top10' ? lt.top_scorer_player_id::text THEN
      v_total := v_total + COALESCE((v_cfg->'scoring'->'long_term'->>'top_scorer_top10')::int, 15);
    END IF;
  END IF;

  SELECT COALESCE(sum(COALESCE(score_a,0) + COALESCE(score_b,0)), 0) INTO v_actual_goals
  FROM public.tq_matches WHERE competition_id = v_comp AND status = 'finished';

  DELETE FROM public.tq_scoring_events WHERE entry_id = p_entry_id AND source_type = 'long_term';
  IF v_total > 0 THEN
    INSERT INTO public.tq_scoring_events(entry_id, source_type, source_id, points, reason)
    VALUES (p_entry_id, 'long_term', lt.id, v_total, 'long-term picks');
  END IF;
  UPDATE public.tq_long_term_predictions SET points_awarded = v_total WHERE id = lt.id;
  UPDATE public.tq_entries SET long_term_score = v_total,
    total_goals_tiebreak_delta = CASE WHEN lt.total_goals_prediction IS NOT NULL THEN abs(lt.total_goals_prediction - v_actual_goals) ELSE NULL END
  WHERE id = p_entry_id;
  RETURN v_total;
END;
$$;


--
-- Name: tq_use_masterpass(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.tq_use_masterpass(p_competition_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user UUID := auth.uid();
  v_tier TEXT; v_mp public.user_masterpasses; v_token TEXT; v_invite_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  SELECT tier INTO v_tier FROM public.tq_competitions WHERE id = p_competition_id;
  IF v_tier IS NULL THEN RETURN jsonb_build_object('ok',false,'error','competition not found'); END IF;

  SELECT * INTO v_mp FROM public.user_masterpasses
  WHERE user_id = v_user AND tier = v_tier AND status = 'available' ORDER BY created_at LIMIT 1;
  IF v_mp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_masterpass','tier',v_tier); END IF;

  -- join the owner (free) + consume the pass
  INSERT INTO public.tq_entries(user_id, competition_id) VALUES(v_user, p_competition_id) ON CONFLICT (user_id, competition_id) DO NOTHING;
  UPDATE public.user_masterpasses SET status='used', used_at=now(), used_competition_id=p_competition_id WHERE id=v_mp.id;

  -- open the +1 invite slot
  v_token := replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.tq_masterpass_invites(competition_id, inviter_id, masterpass_id, tier, token)
  VALUES(p_competition_id, v_user, v_mp.id, v_tier, v_token) RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('ok',true,'invite_id',v_invite_id,'token',v_token,'competition_id',p_competition_id);
END;
$$;


--
-- Name: track_badge_earned(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_badge_earned(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    badges_earned,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    badges_earned = public.user_activity_logs.badges_earned + 1,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$;


--
-- Name: FUNCTION track_badge_earned(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_badge_earned(p_user_id uuid) IS 'Increments badge counter when user earns a badge';


--
-- Name: track_bet(uuid, numeric, numeric, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric DEFAULT 0, p_odds numeric DEFAULT 0) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
  v_is_won BOOLEAN;
BEGIN
  v_week_start := public.get_week_start(now());
  v_is_won := p_win_amount > 0;

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    bets_placed,
    bets_won,
    total_bet_amount,
    total_win_amount,
    avg_win_odds,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    CASE WHEN v_is_won THEN 1 ELSE 0 END,
    p_bet_amount,
    p_win_amount,
    CASE WHEN v_is_won THEN p_odds ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    bets_placed = public.user_activity_logs.bets_placed + 1,
    bets_won = public.user_activity_logs.bets_won + CASE WHEN v_is_won THEN 1 ELSE 0 END,
    total_bet_amount = public.user_activity_logs.total_bet_amount + p_bet_amount,
    total_win_amount = public.user_activity_logs.total_win_amount + p_win_amount,
    avg_win_odds = CASE
      WHEN v_is_won THEN
        (public.user_activity_logs.avg_win_odds * public.user_activity_logs.bets_won + p_odds) /
        (public.user_activity_logs.bets_won + 1)
      ELSE
        public.user_activity_logs.avg_win_odds
    END,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$;


--
-- Name: FUNCTION track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric) IS 'Records a bet placed by the user';


--
-- Name: track_fantasy_game(uuid, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_fantasy_game(p_user_id uuid, p_score numeric) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    fantasy_games,
    fantasy_total_score,
    fantasy_avg_score,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    p_score,
    p_score,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    fantasy_games = public.user_activity_logs.fantasy_games + 1,
    fantasy_total_score = public.user_activity_logs.fantasy_total_score + p_score,
    fantasy_avg_score = (public.user_activity_logs.fantasy_total_score + p_score) /
                        (public.user_activity_logs.fantasy_games + 1),
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$;


--
-- Name: FUNCTION track_fantasy_game(p_user_id uuid, p_score numeric); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_fantasy_game(p_user_id uuid, p_score numeric) IS 'Records a fantasy game played by the user';


--
-- Name: track_game_type(uuid, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_game_type(p_user_id uuid, p_game_type text) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
  v_current_types TEXT[];
  v_new_count INT;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Get current game types played this week (stored in a custom column or calculated)
  -- For now, we'll just increment the counter
  -- A more sophisticated version would track unique game types

  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    game_types_played,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    -- This is simplified - in reality you'd track unique game types
    game_types_played = GREATEST(
      public.user_activity_logs.game_types_played,
      1
    ),
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$;


--
-- Name: FUNCTION track_game_type(p_user_id uuid, p_game_type text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_game_type(p_user_id uuid, p_game_type text) IS 'Tracks variety of game types played';


--
-- Name: track_prediction(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_prediction(p_user_id uuid, p_is_correct boolean DEFAULT NULL::boolean) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
BEGIN
  v_week_start := public.get_week_start(now());

  -- Insert or update activity log
  INSERT INTO public.user_activity_logs (
    user_id,
    week_start,
    predictions_made,
    predictions_correct,
    updated_at
  )
  VALUES (
    p_user_id,
    v_week_start,
    1,
    CASE WHEN p_is_correct = true THEN 1 ELSE 0 END,
    now()
  )
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    predictions_made = public.user_activity_logs.predictions_made + 1,
    predictions_correct = CASE
      WHEN p_is_correct = true THEN public.user_activity_logs.predictions_correct + 1
      ELSE public.user_activity_logs.predictions_correct
    END,
    updated_at = now();

  -- Track general activity
  PERFORM public.track_user_activity(p_user_id);
END;
$$;


--
-- Name: FUNCTION track_prediction(p_user_id uuid, p_is_correct boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_prediction(p_user_id uuid, p_is_correct boolean) IS 'Records a prediction made by the user';


--
-- Name: track_user_activity(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.track_user_activity(p_user_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_week_start DATE;
  v_today DATE;
BEGIN
  v_week_start := public.get_week_start(now());
  v_today := CURRENT_DATE;

  -- Insert or update activity log for this week
  INSERT INTO public.user_activity_logs (user_id, week_start, days_active, updated_at)
  VALUES (p_user_id, v_week_start, 1, now())
  ON CONFLICT (user_id, week_start)
  DO UPDATE SET
    days_active = CASE
      -- Only increment if we haven't counted today yet
      WHEN public.user_activity_logs.updated_at::date < v_today THEN
        public.user_activity_logs.days_active + 1
      ELSE
        public.user_activity_logs.days_active
    END,
    updated_at = now();

  -- Update last_active_date in users table
  UPDATE public.users
  SET last_active_date = now()
  WHERE id = p_user_id;
END;
$$;


--
-- Name: FUNCTION track_user_activity(p_user_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.track_user_activity(p_user_id uuid) IS 'Tracks general user activity and updates last_active_date';


--
-- Name: trigger_award_badge_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_award_badge_xp() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_badge_xp_bonus INT;
  v_result RECORD;
BEGIN
  -- Get badge XP bonus
  SELECT xp_bonus INTO v_badge_xp_bonus
  FROM public.badges
  WHERE id = NEW.badge_id;

  -- Add XP to user immediately (not waiting for weekly calculation)
  SELECT * INTO v_result
  FROM public.add_xp_to_user(NEW.user_id, v_badge_xp_bonus);

  RETURN NEW;
END;
$$;


--
-- Name: trigger_distribute_prizes_on_finalize(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_distribute_prizes_on_finalize() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Check if status changed to 'finished'
  IF NEW.status = 'finished' AND (OLD.status IS NULL OR OLD.status != 'finished') THEN
    -- Distribute prizes automatically
    PERFORM public.distribute_challenge_prizes(NEW.id);
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trigger_distribute_prizes_on_finalize(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_distribute_prizes_on_finalize() IS 'Trigger function that auto-distributes prizes when challenge status → finished';


--
-- Name: trigger_fixture_sync(integer, text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_fixture_sync(p_days_ahead integer DEFAULT 14, p_mode text DEFAULT 'scheduled'::text) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
    DECLARE
      v_url TEXT;
      v_service_role_key TEXT;
      v_response JSONB;
      v_request_id BIGINT;
    BEGIN
      -- IMPORTANT: Remplacez ces valeurs par votre URL et clé Supabase réelles
      -- Option 1: Hard-coder les valeurs (plus simple pour démarrer)
      v_url := 'https://crypuzduplbzbmvefvzr.supabase.co/functions/v1/sync-fixture-schedules';

      -- Option 2: Utiliser Supabase Vault (recommandé pour la production)
      -- Décommentez cette ligne et créez le secret dans le dashboard Supabase
      -- SELECT decrypted_secret INTO v_service_role_key
      -- FROM vault.decrypted_secrets
      -- WHERE name = 'service_role_key';

      -- Pour l'instant, on utilise la clé anon (limitée mais suffisante pour tester)
      -- IMPORTANT: Remplacez par votre service_role_key pour la production
      v_service_role_key := current_setting('request.jwt.claims', true)::json->>'token';

      -- Si on n'a pas de token JWT, utiliser une approche alternative
      IF v_service_role_key IS NULL THEN
        -- L'Edge Function doit gérer l'authentification elle-même
        -- ou vous devez passer le service_role_key en paramètre
        RAISE NOTICE 'No JWT token available, calling Edge Function without auth header';

        -- Appeler sans Authorization header (l'Edge Function devra utiliser SUPABASE_SERVICE_ROLE_KEY)
        SELECT net.http_post(
          url := v_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json'
          ),
          body := jsonb_build_object(
            'days_ahead', p_days_ahead,
            'update_mode', p_mode
          )
        ) INTO v_request_id;
      ELSE
        -- Appeler avec Authorization header
        SELECT net.http_post(
          url := v_url,
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || v_service_role_key
          ),
          body := jsonb_build_object(
            'days_ahead', p_days_ahead,
            'update_mode', p_mode
          )
        ) INTO v_request_id;
      END IF;

      -- Note: pg_net.http_post retourne un request_id, pas la réponse directement
      -- Pour obtenir la réponse, il faut interroger net.http_request_queue
      -- Mais pour un cron job, on n'a pas besoin de la réponse immédiate

      RETURN jsonb_build_object(
        'success', true,
        'request_id', v_request_id,
        'message', 'Sync request submitted'
      );
    END;
    $$;


--
-- Name: FUNCTION trigger_fixture_sync(p_days_ahead integer, p_mode text); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_fixture_sync(p_days_ahead integer, p_mode text) IS 'Déclenche la synchronisation des fixtures via Edge Function';


--
-- Name: trigger_recalculate_challenge_points(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_recalculate_challenge_points() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_challenge_id UUID;
  v_participant RECORD;
  v_new_points INTEGER;
BEGIN
  -- Check if match status changed to finished
  IF NEW.status IN ('finished', 'FT', 'AET', 'PEN') AND
     (OLD.status IS NULL OR OLD.status NOT IN ('finished', 'FT', 'AET', 'PEN')) THEN

    -- Find all challenges using this match
    FOR v_challenge_id IN
      SELECT DISTINCT challenge_id
      FROM public.challenge_matches
      WHERE match_id = NEW.id
    LOOP
      -- Recalculate points for all participants in this challenge
      FOR v_participant IN
        SELECT user_id
        FROM public.challenge_participants
        WHERE challenge_id = v_challenge_id
      LOOP
        -- Calculate new points
        v_new_points := public.recalculate_challenge_points(
          v_challenge_id,
          v_participant.user_id
        );

        -- Update participant points
        UPDATE public.challenge_participants
        SET points = v_new_points,
            updated_at = NOW()
        WHERE challenge_id = v_challenge_id
          AND user_id = v_participant.user_id;
      END LOOP;

      -- Update rankings for this challenge
      PERFORM public.update_challenge_rankings(v_challenge_id);
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;


--
-- Name: FUNCTION trigger_recalculate_challenge_points(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.trigger_recalculate_challenge_points() IS 'Trigger function that recalculates points when a match finishes';


--
-- Name: trigger_track_badge_earned(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.trigger_track_badge_earned() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  PERFORM public.track_badge_earned(NEW.user_id);
  RETURN NEW;
END;
$$;


--
-- Name: unlink_squad_game(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.unlink_squad_game(p_user_id uuid, p_squad_id uuid, p_game_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF p_user_id IS DISTINCT FROM auth.uid() THEN RAISE EXCEPTION 'Unauthorized'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.squad_members m WHERE m.squad_id = p_squad_id AND m.user_id = p_user_id) THEN
    RAISE EXCEPTION 'not_a_member';
  END IF;
  DELETE FROM public.squad_games WHERE squad_id = p_squad_id AND game_id = p_game_id;
END;
$$;


--
-- Name: update_adaptive_multipliers(uuid, text, timestamp with time zone); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_multipliers JSONB;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update multipliers
  UPDATE public.user_spin_states
  SET
    adaptive_multipliers = adaptive_multipliers || jsonb_build_object(
      p_category, jsonb_build_object(
        'multiplier', CASE
          WHEN p_category = 'premium' THEN 0.5
          WHEN p_category = 'gift_card' THEN 0.3
          WHEN p_category = 'masterpass' THEN 0.5
          ELSE 0.5
        END,
        'expiresAt', to_char(p_expires_at, 'YYYY-MM-DD"T"HH24:MI:SS"Z"')
      )
    ),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING adaptive_multipliers INTO v_multipliers;

  RETURN v_multipliers;
END;
$$;


--
-- Name: FUNCTION update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone) IS 'Adds adaptive multiplier for a reward category';


--
-- Name: update_all_weekly_xp(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_all_weekly_xp() RETURNS TABLE(user_id uuid, xp_gained integer, new_xp_total integer, new_level integer, new_level_name text, leveled_up boolean)
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
DECLARE
  v_user RECORD;
  v_xp_gained INT;
  v_new_total INT;
  v_old_level INT;
  v_new_level INT;
  v_new_level_name TEXT;
  v_leveled_up BOOLEAN;
BEGIN
  -- Loop through all users
  FOR v_user IN
    SELECT u.id, u.xp_total, u.current_level, u.level_name
    FROM public.users u
  LOOP
    -- Calculate XP gained this week
    v_xp_gained := public.calculate_user_weekly_xp(v_user.id);

    -- Only process if user earned XP
    IF v_xp_gained > 0 THEN
      -- Calculate new total
      v_new_total := v_user.xp_total + v_xp_gained;
      v_old_level := v_user.current_level;

      -- Determine new level based on XP
      SELECT level, name
      INTO v_new_level, v_new_level_name
      FROM public.levels_config
      WHERE xp_required <= v_new_total
      ORDER BY xp_required DESC
      LIMIT 1;

      -- Check if leveled up
      v_leveled_up := v_new_level > v_old_level;

      -- Update user record
      UPDATE public.users
      SET
        xp_total = v_new_total,
        current_level = v_new_level,
        level_name = v_new_level_name,
        updated_at = NOW()
      WHERE id = v_user.id;

      -- Return results for this user
      RETURN QUERY SELECT
        v_user.id,
        v_xp_gained,
        v_new_total,
        v_new_level,
        v_new_level_name,
        v_leveled_up;
    END IF;
  END LOOP;
END;
$$;


--
-- Name: FUNCTION update_all_weekly_xp(); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_all_weekly_xp() IS 'Batch updates XP for all users, returns summary of changes';


--
-- Name: update_available_spins(uuid, public.spin_tier, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_available_spins JSONB;
  v_current_count INTEGER;
  v_new_count INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Get current available spins
  SELECT available_spins INTO v_available_spins
  FROM public.user_spin_states
  WHERE user_id = p_user_id;

  -- Get current count for this tier
  v_current_count := COALESCE((v_available_spins->>p_tier::text)::INTEGER, 0);
  v_new_count := GREATEST(0, v_current_count + p_delta);

  -- Update
  UPDATE public.user_spin_states
  SET
    available_spins = available_spins || jsonb_build_object(p_tier::text, v_new_count),
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING available_spins INTO v_available_spins;

  RETURN v_available_spins;
END;
$$;


--
-- Name: FUNCTION update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer) IS 'Adds or removes available spins for a tier';


--
-- Name: update_challenge(uuid, text, text, timestamp with time zone, timestamp with time zone, integer, jsonb, jsonb, text, jsonb, jsonb, uuid[], uuid[]); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_challenge(p_challenge_id uuid, p_name text DEFAULT NULL::text, p_description text DEFAULT NULL::text, p_start_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_end_date timestamp with time zone DEFAULT NULL::timestamp with time zone, p_entry_cost integer DEFAULT NULL::integer, p_prizes jsonb DEFAULT NULL::jsonb, p_rules jsonb DEFAULT NULL::jsonb, p_status text DEFAULT NULL::text, p_entry_conditions jsonb DEFAULT NULL::jsonb, p_configs jsonb DEFAULT NULL::jsonb, p_league_ids uuid[] DEFAULT NULL::uuid[], p_match_ids uuid[] DEFAULT NULL::uuid[]) RETURNS TABLE(out_success boolean, out_message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_league_id UUID;
  v_match_id UUID;
  v_config JSONB;
BEGIN
  -- Check admin permission
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Only admins can update challenges';
  END IF;

  -- Check if challenge exists
  IF NOT EXISTS (SELECT 1 FROM public.challenges WHERE id = p_challenge_id) THEN
    RETURN QUERY SELECT FALSE, 'Challenge not found'::TEXT;
    RETURN;
  END IF;

  -- Update challenge (only non-NULL fields)
  UPDATE public.challenges
  SET
    name = COALESCE(p_name, name),
    description = COALESCE(p_description, description),
    start_date = COALESCE(p_start_date, start_date),
    end_date = COALESCE(p_end_date, end_date),
    entry_cost = COALESCE(p_entry_cost, entry_cost),
    prizes = COALESCE(p_prizes, prizes),
    rules = COALESCE(p_rules, rules),
    status = COALESCE(p_status::public.challenge_status_enum, status),
    entry_conditions = COALESCE(p_entry_conditions, entry_conditions),
    updated_at = NOW()
  WHERE id = p_challenge_id;

  -- Update configs if provided
  IF p_configs IS NOT NULL AND jsonb_array_length(p_configs) > 0 THEN
    FOR v_config IN SELECT * FROM jsonb_array_elements(p_configs)
    LOOP
      INSERT INTO public.challenge_configs (
        challenge_id,
        config_type,
        config_data
      ) VALUES (
        p_challenge_id,
        v_config->>'config_type',
        v_config->'config_data'
      )
      ON CONFLICT (challenge_id, config_type) DO UPDATE
      SET config_data = EXCLUDED.config_data;
    END LOOP;
  END IF;

  -- Update leagues if provided
  IF p_league_ids IS NOT NULL THEN
    -- Remove existing leagues
    DELETE FROM public.challenge_leagues WHERE challenge_id = p_challenge_id;

    -- Add new leagues
    IF array_length(p_league_ids, 1) > 0 THEN
      FOREACH v_league_id IN ARRAY p_league_ids
      LOOP
        INSERT INTO public.challenge_leagues (challenge_id, league_id)
        VALUES (p_challenge_id, v_league_id)
        ON CONFLICT (challenge_id, league_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  -- Update matches if provided
  IF p_match_ids IS NOT NULL THEN
    -- Remove existing matches
    DELETE FROM public.challenge_matches WHERE challenge_id = p_challenge_id;

    -- Add new matches
    IF array_length(p_match_ids, 1) > 0 THEN
      FOREACH v_match_id IN ARRAY p_match_ids
      LOOP
        INSERT INTO public.challenge_matches (challenge_id, match_id)
        VALUES (p_challenge_id, v_match_id)
        ON CONFLICT (challenge_id, match_id) DO NOTHING;
      END LOOP;
    END IF;
  END IF;

  RETURN QUERY SELECT TRUE, 'Challenge updated successfully'::TEXT;
END;
$$;


--
-- Name: FUNCTION update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) IS 'Admin function to update challenge details, configs, leagues, and matches';


--
-- Name: update_challenge_participant_points(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_challenge_participant_points(p_challenge_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_total_points INTEGER;
    v_total_correct INTEGER;
BEGIN
    -- Sum points across all matchdays
    SELECT
        COALESCE(SUM(mp.points_earned), 0),
        COALESCE(SUM(mp.correct_predictions), 0)
    INTO v_total_points, v_total_correct
    FROM public.matchday_participants mp
    INNER JOIN public.challenge_matchdays cm ON mp.matchday_id = cm.id
    WHERE cm.challenge_id = p_challenge_id AND mp.user_id = p_user_id;

    -- Update challenge_participants
    UPDATE public.challenge_participants
    SET
        points = v_total_points,
        updated_at = NOW()
    WHERE challenge_id = p_challenge_id AND user_id = p_user_id;
END;
$$;


--
-- Name: update_challenge_rankings(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_challenge_rankings(p_challenge_id uuid) RETURNS void
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  -- Update ranks based on points (higher points = lower rank number)
  WITH ranked_participants AS (
    SELECT
      id,
      ROW_NUMBER() OVER (ORDER BY points DESC, created_at ASC) as new_rank
    FROM public.challenge_participants
    WHERE challenge_id = p_challenge_id
  )
  UPDATE public.challenge_participants cp
  SET rank = rp.new_rank
  FROM ranked_participants rp
  WHERE cp.id = rp.id;
END;
$$;


--
-- Name: FUNCTION update_challenge_rankings(p_challenge_id uuid); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_challenge_rankings(p_challenge_id uuid) IS 'Updates rank column for all participants in a challenge based on points';


--
-- Name: update_fantasy_league_players_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_fantasy_league_players_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_game_config_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_game_config_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: update_live_game_tier_limits_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_live_game_tier_limits_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_live_games_updated_at(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_live_games_updated_at() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;


--
-- Name: update_matchday_participant_stats(uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_matchday_participant_stats(p_matchday_id uuid, p_user_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
    v_predictions_count INTEGER;
    v_total_points INTEGER;
    v_correct_count INTEGER;
    v_total_matches INTEGER;
BEGIN
    -- Count predictions and calculate stats
    SELECT
        COUNT(*),
        COALESCE(SUM(points_earned), 0),
        COUNT(*) FILTER (WHERE is_correct = true)
    INTO v_predictions_count, v_total_points, v_correct_count
    FROM public.swipe_predictions
    WHERE matchday_id = p_matchday_id AND user_id = p_user_id;

    -- Count total matches in this matchday
    SELECT COUNT(*) INTO v_total_matches
    FROM public.matchday_fixtures
    WHERE matchday_id = p_matchday_id;

    -- Update or insert participant stats
    INSERT INTO public.matchday_participants (
        matchday_id,
        user_id,
        predictions_made,
        points_earned,
        correct_predictions,
        is_complete
    ) VALUES (
        p_matchday_id,
        p_user_id,
        v_predictions_count,
        v_total_points,
        v_correct_count,
        v_predictions_count >= v_total_matches
    )
    ON CONFLICT (matchday_id, user_id)
    DO UPDATE SET
        predictions_made = v_predictions_count,
        points_earned = v_total_points,
        correct_predictions = v_correct_count,
        is_complete = v_predictions_count >= v_total_matches,
        updated_at = NOW();
END;
$$;


--
-- Name: update_pity_counter(uuid, boolean); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_pity_counter(p_user_id uuid, p_reset boolean DEFAULT false) RETURNS integer
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_new_counter INTEGER;
BEGIN
  -- Ensure state exists
  INSERT INTO public.user_spin_states (user_id)
  VALUES (p_user_id)
  ON CONFLICT (user_id) DO NOTHING;

  -- Update counter
  UPDATE public.user_spin_states
  SET
    pity_counter = CASE WHEN p_reset THEN 0 ELSE pity_counter + 1 END,
    updated_at = NOW()
  WHERE user_id = p_user_id
  RETURNING pity_counter INTO v_new_counter;

  RETURN v_new_counter;
END;
$$;


--
-- Name: FUNCTION update_pity_counter(p_user_id uuid, p_reset boolean); Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON FUNCTION public.update_pity_counter(p_user_id uuid, p_reset boolean) IS 'Increments or resets pity counter';


--
-- Name: update_player_fatigue(uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_player_fatigue(p_game_week_id uuid) RETURNS void
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_team RECORD;
  v_player_id UUID;
BEGIN
  FOR v_team IN
    SELECT user_id, starters, substitutes
    FROM user_fantasy_teams
    WHERE game_week_id = p_game_week_id
  LOOP
    FOREACH v_player_id IN ARRAY v_team.starters
    LOOP
      UPDATE fantasy_players
      SET fatigue = CASE
        WHEN "status" = 'Star' THEN GREATEST(0, fatigue - 20)
        WHEN "status" = 'Key' THEN GREATEST(0, fatigue - 10)
        ELSE fatigue
      END,
      updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;

    FOREACH v_player_id IN ARRAY v_team.substitutes
    LOOP
      UPDATE fantasy_players
      SET fatigue = LEAST(100, fatigue + 10), updated_at = NOW()
      WHERE id = v_player_id;
    END LOOP;
  END LOOP;
END;
$$;


--
-- Name: update_player_season_stats(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_player_season_stats() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
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
$$;


--
-- Name: update_updated_at_column(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.update_updated_at_column() RETURNS trigger
    LANGUAGE plpgsql
    SET search_path TO 'public'
    AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;


--
-- Name: use_masterpass(text, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_masterpass(p_game_type text, p_game_id uuid) RETURNS jsonb
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_user UUID := auth.uid(); v_tier TEXT; v_mp public.user_masterpasses; v_token TEXT; v_invite_id UUID;
BEGIN
  IF v_user IS NULL THEN RETURN jsonb_build_object('ok',false,'error','not authenticated'); END IF;
  IF p_game_type NOT IN ('tournament','betting','prediction','fantasy') THEN RETURN jsonb_build_object('ok',false,'error','bad game type'); END IF;
  v_tier := public._mp_game_tier(p_game_type, p_game_id);
  IF v_tier IS NULL THEN RETURN jsonb_build_object('ok',false,'error','game not found or no tier'); END IF;

  SELECT * INTO v_mp FROM public.user_masterpasses WHERE user_id=v_user AND tier=v_tier AND status='available' ORDER BY created_at LIMIT 1;
  IF v_mp.id IS NULL THEN RETURN jsonb_build_object('ok',false,'error','no_masterpass','tier',v_tier); END IF;

  PERFORM public._mp_create_entry(p_game_type, p_game_id, v_user);
  UPDATE public.user_masterpasses SET status='used', used_at=now(), used_competition_id=p_game_id WHERE id=v_mp.id;

  v_token := replace(gen_random_uuid()::text,'-','');
  INSERT INTO public.tq_masterpass_invites(competition_id, game_type, game_id, inviter_id, masterpass_id, tier, token)
  VALUES(CASE WHEN p_game_type='tournament' THEN p_game_id ELSE NULL END, p_game_type, p_game_id, v_user, v_mp.id, v_tier, v_token)
  RETURNING id INTO v_invite_id;

  RETURN jsonb_build_object('ok',true,'invite_id',v_invite_id,'token',v_token,'game_type',p_game_type,'game_id',p_game_id);
END; $$;


--
-- Name: use_ticket(uuid, uuid, uuid); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.use_ticket(p_user_id uuid, p_ticket_id uuid, p_challenge_id uuid) RETURNS TABLE(success boolean, message text)
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  -- Get the ticket
  SELECT * INTO v_ticket
  FROM public.user_tickets
  WHERE id = p_ticket_id AND user_id = p_user_id;

  -- Check if ticket exists
  IF v_ticket IS NULL THEN
    RETURN QUERY SELECT false, 'Ticket not found or does not belong to you';
    RETURN;
  END IF;

  -- Check if already used
  IF v_ticket.is_used THEN
    RETURN QUERY SELECT false, 'Ticket already used';
    RETURN;
  END IF;

  -- Check if expired
  IF v_ticket.expires_at <= now() THEN
    RETURN QUERY SELECT false, 'Ticket has expired';
    RETURN;
  END IF;

  -- Mark ticket as used
  UPDATE public.user_tickets
  SET is_used = true,
      used_at = now(),
      used_for_challenge_id = p_challenge_id,
      updated_at = now()
  WHERE id = p_ticket_id;

  -- Log the transaction
  INSERT INTO public.ticket_transactions (user_id, ticket_id, ticket_type, transaction_type, used_for_challenge_id)
  VALUES (p_user_id, p_ticket_id, v_ticket.ticket_type, 'used', p_challenge_id);

  RETURN QUERY SELECT true, 'Ticket used successfully';
END;
$$;


--
-- Name: user_level_rank(text); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.user_level_rank(p_level text) RETURNS integer
    LANGUAGE sql IMMUTABLE
    SET search_path TO 'public'
    AS $$
  SELECT CASE lower(trim(coalesce(p_level, '')))
    WHEN 'rookie' THEN 0
    WHEN 'amateur' THEN 0          -- legacy alias
    WHEN 'rising star' THEN 1
    WHEN 'rising_star' THEN 1
    WHEN 'pro' THEN 2
    WHEN 'elite' THEN 3
    WHEN 'expert' THEN 3           -- legacy alias
    WHEN 'legend' THEN 4
    WHEN 'master' THEN 5
    WHEN 'goat' THEN 6
    ELSE 0
  END;
$$;


--
-- Name: xp_coef(text, numeric); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_coef(p_key text, p_default numeric) RETURNS numeric
    LANGUAGE sql STABLE
    AS $$
  SELECT COALESCE((SELECT value FROM public.xp_formula_config WHERE key = p_key), p_default);
$$;


--
-- Name: xp_on_live_settled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_on_live_settled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF NEW.total_points IS NOT NULL
     AND OLD.total_points IS DISTINCT FROM NEW.total_points THEN
    PERFORM public.award_xp(
      NEW.user_id,
      10 + GREATEST(ROUND(NEW.total_points / 4.0)::INT, 0),
      'live', NEW.id::text, 'Live game settled'
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: xp_on_match_bet_settled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_on_match_bet_settled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
DECLARE v_xp INT;
BEGIN
  IF NEW.status IN ('won', 'lost')
     AND OLD.status IS DISTINCT FROM NEW.status
     AND COALESCE(OLD.status, '') NOT IN ('won', 'lost') THEN
    v_xp := 10;  -- participation
    IF NEW.status = 'won' THEN
      v_xp := v_xp + ROUND(20 * (1 + LEAST(GREATEST((COALESCE(NEW.odds, 1) - 1) / 2.0, 0), 2)))::INT;
    END IF;
    PERFORM public.award_xp(NEW.user_id, v_xp, 'match_bet', NEW.id::text, 'Match bet settled');
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: xp_on_swipe_settled(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.xp_on_swipe_settled() RETURNS trigger
    LANGUAGE plpgsql SECURITY DEFINER
    SET search_path TO 'public'
    AS $$
BEGIN
  IF OLD.is_correct IS NULL AND NEW.is_correct IS NOT NULL THEN
    PERFORM public.award_xp(
      NEW.user_id,
      CASE WHEN NEW.is_correct THEN 20 ELSE 5 END,
      'swipe', NEW.id::text, 'Swipe prediction settled'
    );
  END IF;
  RETURN NEW;
END;
$$;


--
-- Name: api_sync_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.api_sync_config (
    id text NOT NULL,
    frequency text DEFAULT 'Manual'::text NOT NULL,
    last_sync_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    endpoint text
);


--
-- Name: app_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.app_config (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    value text NOT NULL,
    description text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_by uuid
);


--
-- Name: TABLE app_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.app_config IS 'Configuration globale de l''application';


--
-- Name: badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    icon_url text,
    condition_type text,
    condition_value jsonb,
    created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    condition_query text,
    is_active boolean DEFAULT true,
    xp_bonus integer DEFAULT 150
);


--
-- Name: boosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.boosters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    type text NOT NULL,
    used_by uuid,
    used_on_week uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: challenge_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    daily_entry_id uuid NOT NULL,
    challenge_match_id uuid NOT NULL,
    prediction text NOT NULL,
    amount integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    odds_snapshot jsonb,
    status text DEFAULT 'pending'::text NOT NULL,
    points_earned integer DEFAULT 0 NOT NULL,
    settled_at timestamp with time zone,
    CONSTRAINT challenge_bets_amount_check CHECK ((amount >= 0)),
    CONSTRAINT challenge_bets_prediction_check CHECK ((prediction = ANY (ARRAY['teamA'::text, 'draw'::text, 'teamB'::text]))),
    CONSTRAINT challenge_bets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'void'::text])))
);


--
-- Name: COLUMN challenge_bets.odds_snapshot; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.challenge_bets.odds_snapshot IS 'Snapshot of odds at the time the bet was placed. Format: { "teamA": 2.0, "draw": 3.2, "teamB": 2.4 }. Ensures accurate point calculation even if odds change later.';


--
-- Name: challenge_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_configs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    config_type text NOT NULL,
    config_data jsonb,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: challenge_daily_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_daily_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_entry_id uuid NOT NULL,
    day_number integer NOT NULL,
    booster_type text,
    booster_match_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_daily_entries_booster_type_check CHECK ((booster_type = ANY (ARRAY['x2'::text, 'x3'::text])))
);


--
-- Name: challenge_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    entry_method text NOT NULL,
    ticket_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT challenge_entries_entry_method_check CHECK ((entry_method = ANY (ARRAY['coins'::text, 'ticket'::text])))
);


--
-- Name: challenge_leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    league_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: challenge_matchdays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_matchdays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    date date NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    deadline timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT challenge_matchdays_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'finished'::text])))
);


--
-- Name: challenge_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    match_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    day_number integer DEFAULT 1 NOT NULL
);


--
-- Name: challenge_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    user_id uuid NOT NULL,
    points integer DEFAULT 0,
    rank integer,
    booster_used boolean DEFAULT false,
    booster_type text,
    reward jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    results_viewed_at timestamp with time zone
);


--
-- Name: COLUMN challenge_participants.results_viewed_at; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.challenge_participants.results_viewed_at IS 'Timestamp when user viewed final results. Used to move game to Past Games section.';


--
-- Name: challenge_required_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenge_required_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE challenge_required_badges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.challenge_required_badges IS 'Junction table for challenges requiring multiple badges';


--
-- Name: challenges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.challenges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    game_type public.game_type_enum NOT NULL,
    format public.challenge_format_enum NOT NULL,
    sport public.sport_enum NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    entry_cost integer DEFAULT 0,
    prizes jsonb,
    rules jsonb,
    status public.challenge_status_enum DEFAULT 'upcoming'::public.challenge_status_enum,
    entry_conditions jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    league_id uuid,
    is_linkable boolean DEFAULT false NOT NULL,
    publish_date timestamp with time zone,
    prizes_distributed boolean DEFAULT false NOT NULL,
    is_visible boolean DEFAULT true NOT NULL,
    rules_html text,
    source_league_id uuid,
    reward_pack_id uuid
);


--
-- Name: COLUMN challenges.league_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.challenges.league_id IS 'Optional link to a private league. If NULL, the challenge is public.';


--
-- Name: coin_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.coin_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    balance_after integer NOT NULL,
    transaction_type text NOT NULL,
    metadata jsonb DEFAULT '{}'::jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT coin_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['shop_purchase'::text, 'daily_streak'::text, 'spin_wheel'::text, 'challenge_entry'::text, 'challenge_refund'::text, 'challenge_reward'::text, 'premium_bonus'::text, 'referral_reward'::text, 'admin_adjustment'::text, 'initial_bonus'::text, 'fantasy_entry'::text, 'live_game_entry'::text])))
);


--
-- Name: content_versions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.content_versions (
    key text NOT NULL,
    version bigint DEFAULT 1 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: countries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.countries (
    id text NOT NULL,
    code text,
    flag text
);


--
-- Name: fantasy_boosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_boosters (
    id integer NOT NULL,
    name text NOT NULL,
    description text NOT NULL,
    icon text,
    type text DEFAULT 'regular'::text,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fantasy_boosters_type_check CHECK ((type = ANY (ARRAY['regular'::text, 'live'::text])))
);


--
-- Name: fantasy_boosters_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.fantasy_boosters_id_seq
    AS integer
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- Name: fantasy_boosters_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.fantasy_boosters_id_seq OWNED BY public.fantasy_boosters.id;


--
-- Name: fantasy_configs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_configs (
    id text DEFAULT 'default_config'::text NOT NULL,
    config jsonb NOT NULL
);


--
-- Name: fantasy_game_weeks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_game_weeks (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    fantasy_game_id uuid NOT NULL,
    name text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    leagues text[] DEFAULT '{}'::text[],
    status text NOT NULL,
    conditions jsonb DEFAULT '[]'::jsonb,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fantasy_game_weeks_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'live'::text, 'finished'::text])))
);


--
-- Name: fantasy_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_games (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    status text NOT NULL,
    start_date timestamp with time zone NOT NULL,
    end_date timestamp with time zone NOT NULL,
    entry_cost integer DEFAULT 0,
    total_players integer DEFAULT 0,
    is_linkable boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    league_id uuid,
    tier text DEFAULT 'amateur'::text,
    duration_type text DEFAULT 'flash'::text,
    custom_entry_cost_enabled boolean DEFAULT false,
    requires_subscription boolean DEFAULT false,
    minimum_level text DEFAULT 'Rookie'::text,
    required_badges uuid[] DEFAULT '{}'::uuid[],
    min_players integer DEFAULT 2,
    max_players integer DEFAULT 100,
    rules_html text,
    is_visible boolean DEFAULT true NOT NULL,
    source_league_id uuid,
    reward_pack_id uuid,
    prizes jsonb DEFAULT '[]'::jsonb,
    rewards_distributed boolean DEFAULT false NOT NULL,
    CONSTRAINT fantasy_games_duration_type_check CHECK ((duration_type = ANY (ARRAY['flash'::text, 'series'::text, 'season'::text]))),
    CONSTRAINT fantasy_games_max_players_check CHECK ((max_players >= min_players)),
    CONSTRAINT fantasy_games_min_players_check CHECK ((min_players >= 2)),
    CONSTRAINT fantasy_games_status_check CHECK ((status = ANY (ARRAY['Draft'::text, 'Upcoming'::text, 'Published'::text, 'Ongoing'::text, 'Finished'::text, 'Cancelled'::text]))),
    CONSTRAINT fantasy_games_tier_check CHECK ((tier = ANY (ARRAY['amateur'::text, 'master'::text, 'apex'::text])))
);


--
-- Name: COLUMN fantasy_games.league_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.league_id IS 'The league associated with this fantasy game. Players available for selection come from this league.';


--
-- Name: COLUMN fantasy_games.tier; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.tier IS 'Game tier: amateur (2000 base), master (10000 base), apex (20000 base)';


--
-- Name: COLUMN fantasy_games.duration_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.duration_type IS 'Duration type affecting entry cost multiplier: flash (1x), series (2x), season (4x)';


--
-- Name: COLUMN fantasy_games.custom_entry_cost_enabled; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.custom_entry_cost_enabled IS 'If true, entry_cost is manually set; if false, auto-calculated from tier × duration';


--
-- Name: COLUMN fantasy_games.requires_subscription; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.requires_subscription IS 'Whether this game requires an active subscription to join';


--
-- Name: COLUMN fantasy_games.minimum_level; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.minimum_level IS 'Minimum user level required to join this game';


--
-- Name: COLUMN fantasy_games.required_badges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.required_badges IS 'Array of badge UUIDs that users must possess to join';


--
-- Name: COLUMN fantasy_games.min_players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.min_players IS 'Minimum number of players required to start the game';


--
-- Name: COLUMN fantasy_games.max_players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fantasy_games.max_players IS 'Maximum number of players allowed in the game';


--
-- Name: fantasy_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_leaderboard (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    game_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    user_id uuid NOT NULL,
    username text NOT NULL,
    avatar text,
    total_points numeric(5,1) DEFAULT 0.0,
    booster_used integer,
    rank integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: fantasy_league_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_league_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    player_id uuid NOT NULL,
    status text NOT NULL,
    pgs numeric(5,2) DEFAULT 0,
    is_available boolean DEFAULT true,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT fantasy_league_players_pgs_check CHECK (((pgs >= (0)::numeric) AND (pgs <= (10)::numeric))),
    CONSTRAINT fantasy_league_players_status_check CHECK ((status = ANY (ARRAY['Star'::text, 'Key'::text, 'Wild'::text])))
);


--
-- Name: TABLE fantasy_league_players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fantasy_league_players IS 'Links players to fantasy games by league with Fantasy-specific attributes (status, PGS). Replaces fantasy_players table to avoid data duplication.';


--
-- Name: fantasy_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fantasy_players (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    api_player_id integer NOT NULL,
    name text NOT NULL,
    photo text,
    "position" text NOT NULL,
    status text NOT NULL,
    fatigue integer DEFAULT 100,
    team_name text NOT NULL,
    team_logo text,
    birthdate date,
    pgs numeric(3,1) DEFAULT 0.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fantasy_players_fatigue_check CHECK (((fatigue >= 0) AND (fatigue <= 100))),
    CONSTRAINT fantasy_players_position_check CHECK (("position" = ANY (ARRAY['Goalkeeper'::text, 'Defender'::text, 'Midfielder'::text, 'Attacker'::text]))),
    CONSTRAINT fantasy_players_status_check CHECK ((status = ANY (ARRAY['Star'::text, 'Key'::text, 'Wild'::text])))
);


--
-- Name: fb_fixture_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_fixture_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid,
    api_fixture_id bigint NOT NULL,
    seq integer NOT NULL,
    elapsed integer,
    extra integer,
    team_api_id bigint,
    team_name text,
    player text,
    assist text,
    type text,
    detail text,
    comments text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_fixture_statistics; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_fixture_statistics (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid,
    api_fixture_id bigint NOT NULL,
    team_api_id bigint NOT NULL,
    team_name text,
    stat_type text NOT NULL,
    stat_value text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_fixtures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_fixtures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_id integer NOT NULL,
    league_id uuid NOT NULL,
    home_team_id uuid NOT NULL,
    away_team_id uuid NOT NULL,
    date timestamp with time zone,
    status text,
    goals_home integer,
    goals_away integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    round text,
    season integer
);


--
-- Name: COLUMN fb_fixtures.api_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_fixtures.api_id IS 'Maps to fb_fixtures.id - the INTEGER ID from API-Football. Used for synchronization.';


--
-- Name: fb_leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    description text,
    photo_url text,
    invite_code text NOT NULL,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    country_id text,
    logo text,
    type text,
    season text,
    api_league_id bigint,
    api_id bigint,
    is_visible boolean DEFAULT true NOT NULL
);


--
-- Name: TABLE fb_leagues; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fb_leagues IS 'Stores information about user-created private leagues.';


--
-- Name: COLUMN fb_leagues.description; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.description IS 'Description of the league';


--
-- Name: COLUMN fb_leagues.invite_code; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.invite_code IS 'Unique invite code for the league';


--
-- Name: COLUMN fb_leagues.created_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.created_by IS 'User who created/imported this league (nullable)';


--
-- Name: COLUMN fb_leagues.logo; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.logo IS 'Logo URL from API-Football';


--
-- Name: COLUMN fb_leagues.type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.type IS 'League type (e.g., football_competition)';


--
-- Name: COLUMN fb_leagues.api_league_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_leagues.api_league_id IS 'API-Football league ID';


--
-- Name: fb_odds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_odds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid NOT NULL,
    bookmaker_name text NOT NULL,
    home_win real,
    draw real,
    away_win real,
    updated_at timestamp with time zone NOT NULL
);


--
-- Name: fb_player_match_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_player_match_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    team_id uuid NOT NULL,
    api_id integer,
    minutes_played integer DEFAULT 0,
    started boolean DEFAULT false,
    substitute_in boolean DEFAULT false,
    substitute_out boolean DEFAULT false,
    rating numeric(3,2),
    "position" text,
    goals integer DEFAULT 0,
    assists integer DEFAULT 0,
    shots_total integer DEFAULT 0,
    shots_on_target integer DEFAULT 0,
    passes_total integer DEFAULT 0,
    passes_key integer DEFAULT 0,
    passes_accuracy numeric(5,2),
    tackles_total integer DEFAULT 0,
    tackles_interceptions integer DEFAULT 0,
    duels_total integer DEFAULT 0,
    duels_won integer DEFAULT 0,
    dribbles_attempts integer DEFAULT 0,
    dribbles_success integer DEFAULT 0,
    fouls_drawn integer DEFAULT 0,
    fouls_committed integer DEFAULT 0,
    yellow_card boolean DEFAULT false,
    red_card boolean DEFAULT false,
    saves integer DEFAULT 0,
    goals_conceded integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    clean_sheet boolean DEFAULT false,
    penalties_saved integer DEFAULT 0,
    penalties_missed integer DEFAULT 0,
    interceptions integer DEFAULT 0
);


--
-- Name: fb_player_season_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_player_season_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    player_name text,
    season integer NOT NULL,
    league_api_id bigint,
    team_api_id bigint,
    team_name text,
    "position" text,
    appearances integer,
    lineups integer,
    minutes integer,
    goals integer,
    assists integer,
    yellow integer,
    red integer,
    rating numeric,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_player_team_association; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_player_team_association (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    team_id uuid NOT NULL,
    start_date date NOT NULL,
    end_date date,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    first_name text NOT NULL,
    last_name text NOT NULL,
    photo_url text NOT NULL,
    nationality text NOT NULL,
    birthdate date NOT NULL,
    "position" text NOT NULL,
    height_cm integer,
    weight_kg integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    team_id uuid,
    stats jsonb,
    pgs numeric,
    category text,
    fatigue integer DEFAULT 100,
    status text,
    playtime_ratio numeric,
    api_id bigint,
    name text,
    photo text
);


--
-- Name: fb_standings; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_standings (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid,
    league_api_id bigint,
    season integer NOT NULL,
    team_api_id bigint NOT NULL,
    team_name text,
    rank integer,
    points integer,
    played integer,
    win integer,
    draw integer,
    lose integer,
    goals_for integer,
    goals_against integer,
    goals_diff integer,
    form text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_team_league_participation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_team_league_participation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    league_id uuid NOT NULL,
    season text NOT NULL,
    "group" text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fb_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    logo_url text NOT NULL,
    country text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    league_id uuid,
    api_team_id integer,
    api_id bigint,
    code text,
    logo text
);


--
-- Name: COLUMN fb_teams.api_team_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fb_teams.api_team_id IS 'Maps to fb_teams.id - the INTEGER ID from API-Football. Used for synchronization.';


--
-- Name: fb_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fb_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    player_name text,
    transfer_date date,
    type text,
    team_out_api bigint,
    team_out_name text,
    team_in_api bigint,
    team_in_name text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: fixture_sync_log; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixture_sync_log (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    sync_type text NOT NULL,
    checked integer DEFAULT 0,
    updated integer DEFAULT 0,
    schedule_changes jsonb,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT fixture_sync_log_sync_type_check CHECK ((sync_type = ANY (ARRAY['upcoming'::text, 'today'::text, 'manual'::text, 'scheduled'::text])))
);


--
-- Name: TABLE fixture_sync_log; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.fixture_sync_log IS 'Logs des synchronisations de fixtures et des changements de calendrier';


--
-- Name: COLUMN fixture_sync_log.sync_type; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fixture_sync_log.sync_type IS 'Type de sync: upcoming (14j), today (jour même), manual (admin), scheduled (cron)';


--
-- Name: COLUMN fixture_sync_log.checked; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fixture_sync_log.checked IS 'Nombre de fixtures vérifiées';


--
-- Name: COLUMN fixture_sync_log.updated; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fixture_sync_log.updated IS 'Nombre de fixtures mises à jour';


--
-- Name: COLUMN fixture_sync_log.schedule_changes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.fixture_sync_log.schedule_changes IS 'JSON des changements de date/heure détectés';


--
-- Name: fixture_sync_summary; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.fixture_sync_summary WITH (security_invoker='on') AS
 SELECT date(created_at) AS sync_date,
    sync_type,
    count(*) AS total_runs,
    sum(checked) AS total_checked,
    sum(updated) AS total_updated,
    count(*) FILTER (WHERE (jsonb_array_length(COALESCE(schedule_changes, '[]'::jsonb)) > 0)) AS runs_with_changes
   FROM public.fixture_sync_log
  GROUP BY (date(created_at)), sync_type
  ORDER BY (date(created_at)) DESC, sync_type;


--
-- Name: VIEW fixture_sync_summary; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON VIEW public.fixture_sync_summary IS 'Vue résumée des synchronisations de fixtures par jour et type';


--
-- Name: fixtures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.fixtures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_id integer,
    league_id uuid,
    home_team_id uuid,
    away_team_id uuid,
    date timestamp with time zone NOT NULL,
    status text NOT NULL,
    goals_home integer,
    goals_away integer,
    round text,
    season integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: game_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_config (
    id text NOT NULL,
    category text NOT NULL,
    key text NOT NULL,
    value jsonb NOT NULL,
    description text,
    is_active boolean DEFAULT true,
    version integer DEFAULT 1,
    updated_at timestamp with time zone DEFAULT now(),
    updated_by uuid
);


--
-- Name: TABLE game_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.game_config IS 'Centralized game configuration for runtime admin control';


--
-- Name: COLUMN game_config.id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.id IS 'Unique identifier (e.g., "daily_streak_rewards")';


--
-- Name: COLUMN game_config.category; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.category IS 'Configuration category for grouping';


--
-- Name: COLUMN game_config.key; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.key IS 'Human-readable key within category';


--
-- Name: COLUMN game_config.value; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.value IS 'JSON configuration value';


--
-- Name: COLUMN game_config.version; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.version IS 'Cache invalidation version (incremented on publish)';


--
-- Name: COLUMN game_config.updated_by; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.game_config.updated_by IS 'Admin user who last updated this config';


--
-- Name: game_weeks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.game_weeks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fantasy_game_id uuid,
    week_number integer NOT NULL,
    formation text,
    theme text,
    fatigue_modifiers jsonb,
    limits jsonb,
    status text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: league_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    created_by uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: league_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.league_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role public.league_role DEFAULT 'member'::public.league_role NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE league_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.league_members IS 'Junction table to link users to leagues and define their role.';


--
-- Name: leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.leagues (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    country_or_region text NOT NULL,
    logo text,
    api_id integer,
    type text,
    season text,
    created_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: levels_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.levels_config (
    level integer NOT NULL,
    name text NOT NULL,
    xp_required integer NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE levels_config; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.levels_config IS 'Standardized user progression levels: Rookie, Rising Star, Pro, Elite, Legend, GOAT (NOT challenge tiers which are Amateur/Master/Apex)';


--
-- Name: lf_activation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_activation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    league_id uuid,
    team_id uuid,
    fixture_id uuid,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lf_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_config (
    id integer DEFAULT 1 NOT NULL,
    captain_multiplier numeric DEFAULT 2 NOT NULL,
    max_transfers integer DEFAULT 3 NOT NULL,
    gk_count integer DEFAULT 1 NOT NULL,
    outfield_per_team integer DEFAULT 3 NOT NULL,
    pool_mode text DEFAULT 'starters'::text NOT NULL,
    gk_underdog_tiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    scoring jsonb DEFAULT '{}'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    reward_split jsonb DEFAULT '[{"pct": 50, "rank": 1}, {"pct": 30, "rank": 2}, {"pct": 20, "rank": 3}]'::jsonb NOT NULL,
    CONSTRAINT lf_config_id_check CHECK ((id = 1))
);


--
-- Name: lf_game_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_game_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_id uuid NOT NULL,
    player_id uuid NOT NULL,
    api_id bigint,
    team_id uuid,
    side text,
    "position" text NOT NULL,
    name text,
    photo text,
    shirt_no integer,
    is_starter boolean DEFAULT true NOT NULL,
    available boolean DEFAULT true NOT NULL,
    on_pitch boolean DEFAULT true NOT NULL
);


--
-- Name: lf_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid NOT NULL,
    status text DEFAULT 'upcoming'::text NOT NULL,
    lock_at timestamp with time zone,
    settled_at timestamp with time zone,
    gk_underdog jsonb DEFAULT '{}'::jsonb,
    pot_amount integer,
    pot_profile_id uuid,
    pot_kind text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    crowd_stats jsonb
);


--
-- Name: lf_notify; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_notify (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    notified boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lf_team_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_team_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    team_id uuid NOT NULL,
    player_id uuid NOT NULL,
    "position" text NOT NULL,
    side text,
    is_captain boolean DEFAULT false NOT NULL,
    active boolean DEFAULT true NOT NULL,
    added_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: lf_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.lf_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_id uuid NOT NULL,
    user_id uuid NOT NULL,
    captain_player_id uuid,
    transfers_used integer DEFAULT 0 NOT NULL,
    score numeric DEFAULT 0 NOT NULL,
    rank integer,
    locked boolean DEFAULT false NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: live_game_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_game_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid,
    category character varying(50) NOT NULL,
    market_id integer,
    market_name character varying(100),
    choice character varying(100) NOT NULL,
    choice_label character varying(100),
    amount integer NOT NULL,
    odds numeric(5,2) NOT NULL,
    placed_at_minute integer,
    status character varying(20) DEFAULT 'pending'::character varying,
    potential_win numeric(10,2),
    actual_win integer,
    resolved_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now(),
    CONSTRAINT live_game_bets_status_check CHECK (((status)::text = ANY ((ARRAY['pending'::character varying, 'won'::character varying, 'lost'::character varying, 'void'::character varying])::text[])))
);


--
-- Name: live_game_entries; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_game_entries (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    live_game_id uuid,
    user_id uuid,
    balance integer DEFAULT 1000,
    total_gains integer DEFAULT 0,
    joined_at timestamp with time zone DEFAULT now(),
    predicted_score jsonb,
    bonus_questions jsonb DEFAULT '[]'::jsonb,
    bonus_answers jsonb DEFAULT '{}'::jsonb,
    midtime_edit boolean DEFAULT false,
    total_points integer DEFAULT 0,
    goal_diff_error integer,
    rank integer,
    submitted_at timestamp with time zone
);


--
-- Name: live_game_tier_limits; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_game_tier_limits (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier character varying(50) NOT NULL,
    max_entry integer NOT NULL,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: live_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid,
    mode character varying(20) NOT NULL,
    entry_cost integer DEFAULT 0,
    status character varying(20) DEFAULT 'upcoming'::character varying,
    friend_code character varying(10),
    created_by uuid,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    crowd_stats jsonb,
    CONSTRAINT live_games_mode_check CHECK (((mode)::text = ANY ((ARRAY['free'::character varying, 'ranked'::character varying])::text[]))),
    CONSTRAINT live_games_status_check CHECK (((status)::text = ANY ((ARRAY['upcoming'::character varying, 'live'::character varying, 'finished'::character varying])::text[])))
);


--
-- Name: live_pred_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.live_pred_config (
    id integer DEFAULT 1 NOT NULL,
    diff_points jsonb DEFAULT '[90, 72, 54, 36, 18, 0]'::jsonb NOT NULL,
    result_points integer DEFAULT 70 NOT NULL,
    halftime_malus_pct integer DEFAULT 40 NOT NULL,
    bonus_count integer DEFAULT 3 NOT NULL,
    bonus_points jsonb DEFAULT '[20, 10, 10]'::jsonb NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT live_pred_config_id_check CHECK ((id = 1))
);


--
-- Name: match_bets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.match_bets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    prediction text NOT NULL,
    amount integer NOT NULL,
    odds numeric(8,2) NOT NULL,
    potential_win integer DEFAULT 0 NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    settled_at timestamp with time zone,
    CONSTRAINT match_bets_amount_check CHECK ((amount > 0)),
    CONSTRAINT match_bets_odds_check CHECK ((odds >= (0)::numeric)),
    CONSTRAINT match_bets_prediction_check CHECK ((prediction = ANY (ARRAY['teamA'::text, 'draw'::text, 'teamB'::text]))),
    CONSTRAINT match_bets_status_check CHECK ((status = ANY (ARRAY['pending'::text, 'won'::text, 'lost'::text, 'void'::text])))
);


--
-- Name: matchday_fixtures; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchday_fixtures (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matchday_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now()
);


--
-- Name: matchday_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matchday_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    matchday_id uuid NOT NULL,
    user_id uuid NOT NULL,
    predictions_made integer DEFAULT 0,
    points_earned integer DEFAULT 0,
    correct_predictions integer DEFAULT 0,
    is_complete boolean DEFAULT false,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    home_team_id uuid,
    away_team_id uuid,
    league_id uuid,
    kickoff_time timestamp with time zone NOT NULL,
    status public.match_status_enum DEFAULT 'upcoming'::public.match_status_enum,
    score jsonb,
    api_match_id text,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: mr_activation; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_activation (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    target_id uuid NOT NULL,
    enabled boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mr_answers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_answers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    question_id uuid NOT NULL,
    game_id uuid NOT NULL,
    user_id uuid NOT NULL,
    option_key text NOT NULL,
    is_correct boolean,
    answered_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mr_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_config (
    id integer DEFAULT 1 NOT NULL,
    hearts integer DEFAULT 3 NOT NULL,
    questions_pre integer DEFAULT 5 NOT NULL,
    questions_half integer DEFAULT 5 NOT NULL,
    tie_break_enabled boolean DEFAULT true NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT mr_config_id_check CHECK ((id = 1))
);


--
-- Name: mr_event_catalog; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_event_catalog (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    key text NOT NULL,
    label text NOT NULL,
    answer_type text NOT NULL,
    resolution text NOT NULL,
    source_key text NOT NULL,
    detail_filter text,
    is_active boolean DEFAULT true NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mr_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid,
    api_fixture_id bigint,
    name text NOT NULL,
    status text DEFAULT 'draft'::text NOT NULL,
    lives_per_player integer DEFAULT 3 NOT NULL,
    entry_cost integer DEFAULT 0 NOT NULL,
    reward_pack_id uuid,
    min_players integer,
    max_players integer,
    tier text DEFAULT 'amateur'::text,
    starts_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    pot_profile_id uuid,
    pot_amount integer,
    hearts integer DEFAULT 3 NOT NULL,
    crowd_stats jsonb
);


--
-- Name: mr_participants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_participants (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_id uuid NOT NULL,
    user_id uuid NOT NULL,
    lives integer DEFAULT 3 NOT NULL,
    status text DEFAULT 'alive'::text NOT NULL,
    is_winner boolean DEFAULT false NOT NULL,
    eliminated_at timestamp with time zone,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    tie_break_answer text,
    prize_amount integer DEFAULT 0 NOT NULL,
    eliminated_question_seq integer
);


--
-- Name: mr_pot_assignments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_pot_assignments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    league_id uuid,
    team_id uuid,
    fixture_id uuid,
    pot_profile_id uuid,
    override_amount integer,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    game text DEFAULT 'match_royale'::text NOT NULL
);


--
-- Name: mr_pot_profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_pot_profiles (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    type text NOT NULL,
    fixed_amount integer,
    tiers jsonb DEFAULT '[]'::jsonb,
    entry_cost integer,
    redistribution_pct integer DEFAULT 100,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: mr_questions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.mr_questions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_id uuid NOT NULL,
    seq integer NOT NULL,
    kind text NOT NULL,
    prompt text NOT NULL,
    options jsonb DEFAULT '[]'::jsonb NOT NULL,
    status text DEFAULT 'pending'::text NOT NULL,
    opened_at timestamp with time zone,
    deadline timestamp with time zone,
    baseline jsonb,
    correct_key text,
    resolved_at timestamp with time zone,
    is_sudden_death boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    phase text,
    answer_type text,
    catalog_key text,
    half integer,
    is_tie_break boolean DEFAULT false NOT NULL
);


--
-- Name: notification_preferences; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notification_preferences (
    user_id uuid NOT NULL,
    gameplay_enabled boolean DEFAULT true NOT NULL,
    league_enabled boolean DEFAULT true NOT NULL,
    squad_enabled boolean DEFAULT true NOT NULL,
    premium_enabled boolean DEFAULT true NOT NULL,
    reminder_enabled boolean DEFAULT true NOT NULL,
    system_enabled boolean DEFAULT true NOT NULL,
    push_enabled boolean DEFAULT true NOT NULL,
    in_app_enabled boolean DEFAULT true NOT NULL,
    email_enabled boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE notification_preferences; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notification_preferences IS 'User preferences for which types of notifications they want to receive.';


--
-- Name: notifications; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.notifications (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    type text NOT NULL,
    title text NOT NULL,
    message text NOT NULL,
    is_read boolean DEFAULT false NOT NULL,
    action_label text,
    action_link text,
    metadata jsonb DEFAULT '{}'::jsonb,
    onesignal_notification_id text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT notifications_action_label_check CHECK (((action_label IS NULL) OR (char_length(action_label) <= 50))),
    CONSTRAINT notifications_message_check CHECK (((char_length(message) >= 1) AND (char_length(message) <= 500))),
    CONSTRAINT notifications_title_check CHECK (((char_length(title) >= 1) AND (char_length(title) <= 100))),
    CONSTRAINT notifications_type_check CHECK ((type = ANY (ARRAY['gameplay'::text, 'league'::text, 'squad'::text, 'premium'::text, 'reminder'::text, 'system'::text])))
);


--
-- Name: TABLE notifications; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.notifications IS 'Notification history for all users. Integrates with OneSignal for push notifications.';


--
-- Name: odds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.odds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    fixture_id uuid NOT NULL,
    bookmaker_name text NOT NULL,
    home_win real,
    draw real,
    away_win real,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE odds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.odds IS 'Table de production pour les cotes de paris';


--
-- Name: player_match_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_match_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    team_id uuid NOT NULL,
    api_id integer,
    minutes_played integer DEFAULT 0,
    started boolean DEFAULT false,
    substitute_in boolean DEFAULT false,
    substitute_out boolean DEFAULT false,
    rating numeric(3,2),
    "position" text,
    goals integer DEFAULT 0,
    assists integer DEFAULT 0,
    shots_total integer DEFAULT 0,
    shots_on_target integer DEFAULT 0,
    passes_total integer DEFAULT 0,
    passes_key integer DEFAULT 0,
    passes_accuracy numeric(5,2),
    tackles_total integer DEFAULT 0,
    tackles_interceptions integer DEFAULT 0,
    duels_total integer DEFAULT 0,
    duels_won integer DEFAULT 0,
    dribbles_attempts integer DEFAULT 0,
    dribbles_success integer DEFAULT 0,
    fouls_drawn integer DEFAULT 0,
    fouls_committed integer DEFAULT 0,
    yellow_card boolean DEFAULT false,
    red_card boolean DEFAULT false,
    saves integer DEFAULT 0,
    goals_conceded integer DEFAULT 0,
    clean_sheet boolean DEFAULT false,
    penalties_saved integer DEFAULT 0,
    penalties_missed integer DEFAULT 0,
    interceptions integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: player_season_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_season_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    season integer NOT NULL,
    team_id uuid NOT NULL,
    league_id uuid NOT NULL,
    api_id integer,
    appearances integer DEFAULT 0,
    minutes_played integer DEFAULT 0,
    starting_xi integer DEFAULT 0,
    substitute_in integer DEFAULT 0,
    substitute_out integer DEFAULT 0,
    bench integer DEFAULT 0,
    rating numeric(3,2),
    goals integer DEFAULT 0,
    assists integer DEFAULT 0,
    shots_total integer DEFAULT 0,
    shots_on_target integer DEFAULT 0,
    passes_total integer DEFAULT 0,
    passes_key integer DEFAULT 0,
    passes_accuracy numeric(5,2),
    tackles_total integer DEFAULT 0,
    tackles_interceptions integer DEFAULT 0,
    duels_total integer DEFAULT 0,
    duels_won integer DEFAULT 0,
    dribbles_attempts integer DEFAULT 0,
    dribbles_success integer DEFAULT 0,
    fouls_drawn integer DEFAULT 0,
    fouls_committed integer DEFAULT 0,
    yellow_cards integer DEFAULT 0,
    red_cards integer DEFAULT 0,
    saves integer DEFAULT 0,
    goals_conceded integer DEFAULT 0,
    clean_sheets integer DEFAULT 0,
    penalties_saved integer DEFAULT 0,
    penalties_missed integer DEFAULT 0,
    impact_score numeric(5,2),
    consistency_score numeric(5,2),
    pgs numeric(5,2),
    pgs_category text,
    market_value bigint,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: player_season_stats_combined; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.player_season_stats_combined WITH (security_invoker='on') AS
 WITH aggregated AS (
         SELECT player_season_stats.player_id,
            player_season_stats.season,
            player_season_stats.league_id,
            sum(player_season_stats.goals) AS total_goals,
            sum(player_season_stats.assists) AS total_assists,
            sum(player_season_stats.appearances) AS total_appearances,
            sum(player_season_stats.minutes_played) AS total_minutes_played,
            sum(player_season_stats.shots_total) AS total_shots_total,
            sum(player_season_stats.shots_on_target) AS total_shots_on_target,
            sum(player_season_stats.passes_total) AS total_passes_total,
            sum(player_season_stats.passes_key) AS total_passes_key,
            sum(player_season_stats.tackles_total) AS total_tackles_total,
            sum(player_season_stats.tackles_interceptions) AS total_tackles_interceptions,
            sum(player_season_stats.duels_total) AS total_duels_total,
            sum(player_season_stats.duels_won) AS total_duels_won,
            sum(player_season_stats.dribbles_attempts) AS total_dribbles_attempts,
            sum(player_season_stats.dribbles_success) AS total_dribbles_success,
            sum(player_season_stats.fouls_drawn) AS total_fouls_drawn,
            sum(player_season_stats.fouls_committed) AS total_fouls_committed,
            sum(player_season_stats.yellow_cards) AS total_yellow_cards,
            sum(player_season_stats.red_cards) AS total_red_cards,
            sum(player_season_stats.saves) AS total_saves,
            sum(player_season_stats.goals_conceded) AS total_goals_conceded,
            sum(player_season_stats.clean_sheets) AS total_clean_sheets,
            sum(player_season_stats.penalties_saved) AS total_penalties_saved,
            sum(player_season_stats.penalties_missed) AS total_penalties_missed,
            avg(player_season_stats.rating) AS avg_rating,
            avg(player_season_stats.passes_accuracy) AS avg_passes_accuracy,
            count(DISTINCT player_season_stats.team_id) AS teams_count,
            (array_agg(player_season_stats.team_id ORDER BY player_season_stats.updated_at DESC))[1] AS current_team_id,
            string_agg(DISTINCT (player_season_stats.team_id)::text, ', '::text ORDER BY (player_season_stats.team_id)::text) AS all_team_ids,
            max(player_season_stats.updated_at) AS updated_at
           FROM public.player_season_stats
          GROUP BY player_season_stats.player_id, player_season_stats.season, player_season_stats.league_id
        )
 SELECT player_id,
    season,
    league_id,
    current_team_id AS team_id,
    (total_goals)::integer AS goals,
    (total_assists)::integer AS assists,
    (total_appearances)::integer AS appearances,
    (total_minutes_played)::integer AS minutes_played,
    avg_rating AS rating,
    (total_shots_total)::integer AS shots_total,
    (total_shots_on_target)::integer AS shots_on_target,
    (total_passes_total)::integer AS passes_total,
    (total_passes_key)::integer AS passes_key,
    avg_passes_accuracy AS passes_accuracy,
    (total_tackles_total)::integer AS tackles_total,
    (total_tackles_interceptions)::integer AS tackles_interceptions,
    (total_duels_total)::integer AS duels_total,
    (total_duels_won)::integer AS duels_won,
    (total_dribbles_attempts)::integer AS dribbles_attempts,
    (total_dribbles_success)::integer AS dribbles_success,
    (total_fouls_drawn)::integer AS fouls_drawn,
    (total_fouls_committed)::integer AS fouls_committed,
    (total_yellow_cards)::integer AS yellow_cards,
    (total_red_cards)::integer AS red_cards,
    (total_saves)::integer AS saves,
    (total_goals_conceded)::integer AS goals_conceded,
    (total_clean_sheets)::integer AS clean_sheets,
    (total_penalties_saved)::integer AS penalties_saved,
    (total_penalties_missed)::integer AS penalties_missed,
    public.calculate_impact_score((total_goals)::integer, (total_assists)::integer, (total_passes_key)::integer, (total_dribbles_success)::integer, (total_tackles_total)::integer, (total_tackles_interceptions)::integer, (total_shots_on_target)::integer, (total_duels_won)::integer, (total_clean_sheets)::integer, (total_saves)::integer, (total_penalties_saved)::integer, (total_appearances)::integer, COALESCE(( SELECT player_match_stats."position"
           FROM public.player_match_stats
          WHERE (player_match_stats.player_id = aggregated.player_id)
         LIMIT 1), 'Unknown'::text)) AS impact_score,
    public.calculate_consistency_score(player_id, season) AS consistency_score,
    public.calculate_pgs(avg_rating, public.calculate_impact_score((total_goals)::integer, (total_assists)::integer, (total_passes_key)::integer, (total_dribbles_success)::integer, (total_tackles_total)::integer, (total_tackles_interceptions)::integer, (total_shots_on_target)::integer, (total_duels_won)::integer, (total_clean_sheets)::integer, (total_saves)::integer, (total_penalties_saved)::integer, (total_appearances)::integer, COALESCE(( SELECT player_match_stats."position"
           FROM public.player_match_stats
          WHERE (player_match_stats.player_id = aggregated.player_id)
         LIMIT 1), 'Unknown'::text)), public.calculate_consistency_score(player_id, season), (total_minutes_played)::integer, (total_appearances)::integer) AS pgs,
    public.get_pgs_category(public.calculate_pgs(avg_rating, public.calculate_impact_score((total_goals)::integer, (total_assists)::integer, (total_passes_key)::integer, (total_dribbles_success)::integer, (total_tackles_total)::integer, (total_tackles_interceptions)::integer, (total_shots_on_target)::integer, (total_duels_won)::integer, (total_clean_sheets)::integer, (total_saves)::integer, (total_penalties_saved)::integer, (total_appearances)::integer, COALESCE(( SELECT player_match_stats."position"
           FROM public.player_match_stats
          WHERE (player_match_stats.player_id = aggregated.player_id)
         LIMIT 1), 'Unknown'::text)), public.calculate_consistency_score(player_id, season), (total_minutes_played)::integer, (total_appearances)::integer)) AS pgs_category,
    (teams_count)::integer AS teams_count,
    (teams_count > 1) AS is_transferred,
    updated_at
   FROM aggregated;


--
-- Name: player_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.player_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id uuid NOT NULL,
    transfer_date date NOT NULL,
    from_team_id uuid,
    from_team_name text,
    to_team_id uuid,
    to_team_name text,
    transfer_type text,
    fee bigint,
    api_id integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_id integer,
    first_name text,
    last_name text,
    "position" text,
    photo_url text,
    birthdate date,
    nationality text,
    height integer,
    weight integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: premium_daily_claims; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.premium_daily_claims (
    user_id uuid NOT NULL,
    claim_date date NOT NULL,
    claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    coins integer,
    spins integer
);


--
-- Name: profiles; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.profiles (
    id uuid NOT NULL,
    username text,
    email text,
    created_at timestamp with time zone DEFAULT now(),
    is_guest boolean DEFAULT false,
    verified boolean DEFAULT false,
    display_name text,
    level text DEFAULT 'Amateur'::text,
    xp integer DEFAULT 0,
    favorite_club text,
    favorite_national_team text,
    sports_preferences jsonb,
    is_subscriber boolean DEFAULT false,
    subscription_expires_at timestamp with time zone,
    badges text[],
    referralcode text,
    referralssent integer DEFAULT 0,
    referralsrewarded integer DEFAULT 0,
    daily_games_played integer DEFAULT 0,
    last_premium_prompt_at jsonb,
    paidtournamentscreatedthismonth integer DEFAULT 0,
    activepaidtournaments integer DEFAULT 0,
    giftcards jsonb,
    total_spent_eur double precision DEFAULT 0,
    purchases_count integer DEFAULT 0,
    profile_picture_url text,
    coins_balance integer DEFAULT 1000
);


--
-- Name: puzzle_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_config (
    id integer DEFAULT 1 NOT NULL,
    rounds_per_game integer DEFAULT 5 NOT NULL,
    weight_pop numeric DEFAULT 0.5 NOT NULL,
    weight_rarity numeric DEFAULT 0.3 NOT NULL,
    weight_recency numeric DEFAULT 0.2 NOT NULL,
    easy_max numeric DEFAULT 33 NOT NULL,
    medium_max numeric DEFAULT 66 NOT NULL,
    too_easy_max numeric DEFAULT 8 NOT NULL,
    impossible_min numeric DEFAULT 92 NOT NULL,
    heat_bands jsonb DEFAULT '[{"key": "exact", "max": 0}, {"key": "burning", "max": 2}, {"key": "hot", "max": 4}, {"key": "warm", "max": 6}, {"key": "cold", "max": 999}]'::jsonb NOT NULL,
    max_attempts integer DEFAULT 5 NOT NULL,
    freeze_every_days integer DEFAULT 7 NOT NULL,
    max_freezes integer DEFAULT 3 NOT NULL,
    monthly_milestones jsonb DEFAULT '[{"day": 10, "reward": {"type": "coins", "value": 500}, "min_games": 5}, {"day": 20, "reward": {"type": "coins", "value": 1500}, "min_games": 10}, {"day": "last", "reward": {"tier": "amateur", "type": "ticket", "quantity": 1}, "min_games": 15}]'::jsonb NOT NULL,
    daily_cutover_hour integer DEFAULT 8 NOT NULL,
    prize_enabled boolean DEFAULT false NOT NULL,
    prize_top_pct numeric DEFAULT 10 NOT NULL,
    prize_pot_default integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_match_popularity numeric DEFAULT 40 NOT NULL,
    pop_floor_easy numeric DEFAULT 75 NOT NULL,
    pop_floor_medium numeric DEFAULT 58 NOT NULL,
    pop_floor_hard numeric DEFAULT 45 NOT NULL,
    rarity_easy_max numeric DEFAULT 45 NOT NULL,
    rarity_medium_max numeric DEFAULT 72 NOT NULL,
    pop_floor_big numeric DEFAULT 75 NOT NULL,
    pop_floor_all numeric DEFAULT 30 NOT NULL,
    CONSTRAINT puzzle_config_id_check CHECK ((id = 1))
);


--
-- Name: puzzle_daily_prizes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_daily_prizes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    level text NOT NULL,
    puzzle_date date NOT NULL,
    pot integer DEFAULT 0 NOT NULL,
    top_pct numeric DEFAULT 10 NOT NULL,
    distributed boolean DEFAULT false NOT NULL,
    distributed_at timestamp with time zone,
    winners integer
);


--
-- Name: puzzle_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_type text DEFAULT 'guess_score'::text NOT NULL,
    level text NOT NULL,
    puzzle_date date,
    seq integer,
    status text DEFAULT 'scheduled'::text NOT NULL,
    difficulty_score numeric,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puzzle_monthly_grants; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_monthly_grants (
    user_id uuid NOT NULL,
    period text NOT NULL,
    day_key text NOT NULL,
    granted_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: puzzle_plays; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_plays (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_id uuid NOT NULL,
    started_at timestamp with time zone DEFAULT now() NOT NULL,
    finished_at timestamp with time zone,
    total_time_ms integer,
    rounds_solved integer DEFAULT 0 NOT NULL,
    score integer DEFAULT 0 NOT NULL
);


--
-- Name: puzzle_progress; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_progress (
    user_id uuid NOT NULL,
    level text NOT NULL,
    current_streak integer DEFAULT 0 NOT NULL,
    best_streak integer DEFAULT 0 NOT NULL,
    freezes integer DEFAULT 0 NOT NULL,
    last_played date,
    games_played integer DEFAULT 0 NOT NULL,
    games_won integer DEFAULT 0 NOT NULL,
    total_score integer DEFAULT 0 NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    game_type text DEFAULT 'guess_score'::text NOT NULL
);


--
-- Name: puzzle_round_attempts; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_round_attempts (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    play_id uuid NOT NULL,
    round_no integer NOT NULL,
    guesses jsonb DEFAULT '[]'::jsonb NOT NULL,
    solved boolean DEFAULT false NOT NULL,
    attempts integer DEFAULT 0 NOT NULL,
    given_up boolean DEFAULT false NOT NULL
);


--
-- Name: puzzle_rounds; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_rounds (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    game_id uuid NOT NULL,
    round_no integer NOT NULL,
    fixture_id uuid,
    home_team_api bigint,
    home_name text,
    home_logo text,
    away_team_api bigint,
    away_name text,
    away_logo text,
    season integer,
    competition_name text,
    stage text,
    match_date date,
    answer_home integer,
    answer_away integer,
    hints jsonb DEFAULT '[]'::jsonb NOT NULL,
    difficulty_score numeric,
    payload jsonb,
    answer_player_id bigint
);


--
-- Name: puzzle_user_prefs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.puzzle_user_prefs (
    user_id uuid NOT NULL,
    level text DEFAULT 'big'::text NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    hint text DEFAULT 'easy'::text NOT NULL,
    game_type text DEFAULT 'guess_score'::text NOT NULL
);


--
-- Name: reward_fulfillments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_fulfillments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    game_type text,
    game_id uuid,
    reward_type text NOT NULL,
    value integer,
    name text,
    tier text,
    quantity integer DEFAULT 1 NOT NULL,
    status text DEFAULT 'fulfilled'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: reward_packs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.reward_packs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    tiers jsonb DEFAULT '[]'::jsonb NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_team_id uuid,
    game_week_id uuid,
    total_points integer NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE scores; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.scores IS 'Stores the points scored by a user''s team for a specific game week.';


--
-- Name: season_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.season_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    season_id uuid NOT NULL,
    xp_final integer NOT NULL,
    level_final text NOT NULL,
    goat_earned boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seasons (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    start_date date NOT NULL,
    end_date date NOT NULL,
    is_active boolean DEFAULT false NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: seed_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.seed_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_api_id bigint NOT NULL,
    season integer,
    phase text NOT NULL,
    status text NOT NULL,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: spin_history; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spin_history (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tier public.spin_tier NOT NULL,
    reward_id text NOT NULL,
    reward_label text NOT NULL,
    reward_category text NOT NULL,
    reward_value text,
    was_pity boolean DEFAULT false NOT NULL,
    final_chances jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE spin_history; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.spin_history IS 'Records every spin performed by users with full metadata';


--
-- Name: spin_segments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.spin_segments (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    tier text NOT NULL,
    segment_key text NOT NULL,
    label text NOT NULL,
    base_chance numeric DEFAULT 0 NOT NULL,
    category text NOT NULL,
    value integer,
    sort_order integer DEFAULT 0 NOT NULL,
    is_active boolean DEFAULT true NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    reward_tier text
);


--
-- Name: squad_blocks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_blocks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    blocked_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: squad_feed; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_feed (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    post_type text NOT NULL,
    content text NOT NULL,
    related_game_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squad_feed_content_check CHECK (((char_length(content) >= 1) AND (char_length(content) <= 1000))),
    CONSTRAINT squad_feed_post_type_check CHECK ((post_type = ANY (ARRAY['celebration'::text, 'announcement'::text, 'game_linked'::text])))
);


--
-- Name: TABLE squad_feed; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_feed IS 'Social feed for squad activities (celebrations, announcements, game links).';


--
-- Name: squad_feed_likes; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_feed_likes (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    post_id uuid NOT NULL,
    user_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE squad_feed_likes; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_feed_likes IS 'Likes on squad feed posts.';


--
-- Name: squad_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    game_id uuid NOT NULL,
    linked_by uuid NOT NULL,
    linked_at timestamp with time zone DEFAULT now() NOT NULL,
    game_type text DEFAULT 'betting'::text NOT NULL
);


--
-- Name: TABLE squad_games; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_games IS 'Games/challenges linked to squads.';


--
-- Name: squad_leaderboard_snapshots; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_leaderboard_snapshots (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    game_id uuid NOT NULL,
    leaderboard_data jsonb NOT NULL,
    celebration_message text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squad_leaderboard_snapshots_celebration_message_check CHECK ((char_length(celebration_message) <= 500))
);


--
-- Name: TABLE squad_leaderboard_snapshots; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_leaderboard_snapshots IS 'Point-in-time captures of leaderboards for winner celebrations.';


--
-- Name: squad_members; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_members (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    user_id uuid NOT NULL,
    role text NOT NULL,
    joined_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squad_members_role_check CHECK ((role = ANY (ARRAY['admin'::text, 'member'::text])))
);


--
-- Name: TABLE squad_members; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_members IS 'Squad membership with role-based permissions (admin or member).';


--
-- Name: squad_private_games; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.squad_private_games (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    squad_id uuid NOT NULL,
    created_by uuid NOT NULL,
    name text NOT NULL,
    description text,
    tournament_type text NOT NULL,
    starts_at timestamp with time zone NOT NULL,
    ends_at timestamp with time zone NOT NULL,
    entry_fee integer,
    prize_pool integer,
    max_participants integer,
    status text DEFAULT 'upcoming'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT squad_private_games_description_check CHECK ((char_length(description) <= 500)),
    CONSTRAINT squad_private_games_entry_fee_check CHECK ((entry_fee >= 0)),
    CONSTRAINT squad_private_games_max_participants_check CHECK ((max_participants > 0)),
    CONSTRAINT squad_private_games_name_check CHECK (((char_length(name) >= 3) AND (char_length(name) <= 100))),
    CONSTRAINT squad_private_games_prize_pool_check CHECK ((prize_pool >= 0)),
    CONSTRAINT squad_private_games_status_check CHECK ((status = ANY (ARRAY['upcoming'::text, 'active'::text, 'completed'::text, 'cancelled'::text]))),
    CONSTRAINT squad_private_games_tournament_type_check CHECK ((tournament_type = ANY (ARRAY['amateur'::text, 'master'::text, 'apex'::text]))),
    CONSTRAINT valid_tournament_dates CHECK ((ends_at > starts_at))
);


--
-- Name: TABLE squad_private_games; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.squad_private_games IS 'Private tournaments/games created within squads with custom configurations.';


--
-- Name: swipe_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.swipe_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    challenge_id uuid NOT NULL,
    matchday_id uuid NOT NULL,
    user_id uuid NOT NULL,
    fixture_id uuid NOT NULL,
    prediction text NOT NULL,
    odds_at_prediction jsonb NOT NULL,
    points_earned integer DEFAULT 0,
    is_correct boolean,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    booster text,
    CONSTRAINT swipe_predictions_booster_check CHECK (((booster IS NULL) OR (booster = ANY (ARRAY['x2'::text, 'x3'::text])))),
    CONSTRAINT swipe_predictions_prediction_check CHECK ((prediction = ANY (ARRAY['home'::text, 'draw'::text, 'away'::text])))
);


--
-- Name: team_popularity; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.team_popularity (
    team_api_id bigint NOT NULL,
    team_name text,
    popularity integer DEFAULT 50 NOT NULL,
    is_manual boolean DEFAULT false NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    api_id integer,
    name text NOT NULL,
    logo text,
    country text,
    founded integer,
    venue_name text,
    venue_capacity integer,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: ticket_transactions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.ticket_transactions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticket_id uuid,
    ticket_type public.ticket_type NOT NULL,
    transaction_type text NOT NULL,
    granted_reason text,
    used_for_challenge_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT ticket_transactions_transaction_type_check CHECK ((transaction_type = ANY (ARRAY['granted'::text, 'used'::text, 'expired'::text])))
);


--
-- Name: tm_club_seasons; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_club_seasons (
    league_id text NOT NULL,
    season integer NOT NULL,
    club_id bigint NOT NULL
);


--
-- Name: tm_clubs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_clubs (
    club_id bigint NOT NULL,
    name text NOT NULL,
    country text,
    founded integer,
    stadium text,
    logo_url text,
    tm_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tm_leagues; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_leagues (
    league_id text NOT NULL,
    name text NOT NULL,
    country text,
    tier integer,
    tm_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tm_lineups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_lineups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    match_id text NOT NULL,
    club_id bigint,
    club_name text,
    player_id bigint,
    player_name text,
    is_starter boolean,
    "position" text,
    shirt_number integer,
    minutes integer,
    goals integer,
    assists integer,
    yellow integer,
    red integer
);


--
-- Name: tm_market_values; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_market_values (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    value_date date NOT NULL,
    value_eur bigint,
    club_id bigint
);


--
-- Name: tm_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_matches (
    match_id text NOT NULL,
    league_id text,
    season integer,
    match_date date,
    matchweek text,
    stage text,
    home_club_id bigint,
    home_club_name text,
    away_club_id bigint,
    away_club_name text,
    home_goals integer,
    away_goals integer,
    home_xg numeric,
    away_xg numeric,
    venue text,
    attendance integer,
    referee text,
    fbref_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tm_squad_memberships; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_squad_memberships (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    club_id bigint NOT NULL,
    season integer NOT NULL,
    age integer,
    market_value_eur bigint
);


--
-- Name: tm_transfers; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_transfers (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    player_name text,
    season text,
    transfer_date date,
    from_club_id bigint,
    from_club_name text,
    from_country text,
    to_club_id bigint,
    to_club_name text,
    to_country text,
    is_loan boolean DEFAULT false,
    fee_eur bigint,
    market_value_eur bigint,
    seq integer,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tm_player_clubs; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.tm_player_clubs WITH (security_invoker='on') AS
 SELECT DISTINCT sm.player_id,
    sm.club_id,
    c.name AS club_name
   FROM (public.tm_squad_memberships sm
     LEFT JOIN public.tm_clubs c ON ((c.club_id = sm.club_id)))
  WHERE (sm.club_id IS NOT NULL)
UNION
 SELECT t.player_id,
    t.to_club_id AS club_id,
    t.to_club_name AS club_name
   FROM public.tm_transfers t
  WHERE (t.to_club_id IS NOT NULL)
UNION
 SELECT t.player_id,
    t.from_club_id AS club_id,
    t.from_club_name AS club_name
   FROM public.tm_transfers t
  WHERE (t.from_club_id IS NOT NULL);


--
-- Name: tm_player_season_stats; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_player_season_stats (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    player_id bigint NOT NULL,
    season integer NOT NULL,
    league_id text,
    club_id bigint,
    club_name text,
    "position" text,
    appearances integer,
    starts integer,
    minutes integer,
    goals integer,
    assists integer,
    xg numeric,
    xa numeric,
    yellow integer,
    red integer
);


--
-- Name: tm_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_players (
    player_id bigint NOT NULL,
    name text NOT NULL,
    full_name text,
    date_of_birth date,
    birth_place text,
    nationality text,
    second_nationality text,
    "position" text,
    sub_position text,
    foot text,
    height_cm integer,
    current_club_id bigint,
    current_market_value_eur bigint,
    retired boolean DEFAULT false,
    photo_url text,
    tm_url text,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    nt_team text,
    caps integer,
    nt_goals integer,
    max_market_value_eur bigint
);


--
-- Name: tm_seed_runs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_seed_runs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    league_id text,
    season integer,
    phase text,
    status text,
    detail jsonb,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tm_trophies; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tm_trophies (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    scope text NOT NULL,
    category text,
    player_id bigint,
    club_id bigint,
    trophy text NOT NULL,
    season text,
    year integer,
    count integer DEFAULT 1
);


--
-- Name: tq_announcements; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_announcements (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    title text NOT NULL,
    body text,
    phase_key text,
    celebrate boolean DEFAULT false NOT NULL,
    published_at timestamp with time zone,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tq_bracket_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_bracket_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    round_key text NOT NULL,
    match_id uuid,
    predicted_winner_team_id uuid NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone
);


--
-- Name: tq_competitions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_competitions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    name text NOT NULL,
    slug text NOT NULL,
    start_date timestamp with time zone,
    end_date timestamp with time zone,
    status text DEFAULT 'draft'::text NOT NULL,
    config_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    entry_cost integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    min_players integer,
    max_players integer,
    minimum_level text DEFAULT 'Rookie'::text,
    required_badges uuid[] DEFAULT '{}'::uuid[],
    is_visible boolean DEFAULT true NOT NULL,
    source_league_id uuid,
    source_season integer,
    rewards_json jsonb DEFAULT '[]'::jsonb NOT NULL,
    opens_at timestamp with time zone,
    rules_html text,
    tier text DEFAULT 'amateur'::text,
    duration_type text DEFAULT 'flash'::text,
    reward_pack_id uuid,
    rewards_distributed boolean DEFAULT false NOT NULL
);


--
-- Name: tq_daily_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_daily_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    match_id uuid NOT NULL,
    predicted_result text,
    predicted_goal_diff_bucket text,
    predicted_first_scorer_team_id uuid,
    predicted_score_a integer,
    predicted_score_b integer,
    points_awarded integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone,
    predicted_bonus text
);


--
-- Name: tq_group_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_group_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    group_id uuid NOT NULL,
    predicted_team_id uuid NOT NULL,
    predicted_position integer NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone
);


--
-- Name: tq_group_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_group_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    group_id uuid NOT NULL,
    team_id uuid NOT NULL,
    seed_order integer DEFAULT 0 NOT NULL,
    final_rank integer
);


--
-- Name: tq_groups; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_groups (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    name text NOT NULL,
    sort_order integer DEFAULT 0 NOT NULL,
    qualified_count integer DEFAULT 2 NOT NULL,
    allow_best_third boolean DEFAULT false NOT NULL
);


--
-- Name: tq_leaderboard; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_leaderboard (
    competition_id uuid NOT NULL,
    entry_id uuid NOT NULL,
    user_id uuid NOT NULL,
    username text,
    avatar text,
    total_score integer DEFAULT 0 NOT NULL,
    rank integer,
    tiebreak_delta integer
);


--
-- Name: tq_long_term_predictions; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_long_term_predictions (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    champion_team_id uuid,
    finalist_team_id uuid,
    total_goals_prediction integer,
    extras_json jsonb DEFAULT '{}'::jsonb NOT NULL,
    points_awarded integer DEFAULT 0 NOT NULL,
    locked_at timestamp with time zone,
    top_scorer_player_id uuid
);


--
-- Name: tq_masterpass_invites; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_masterpass_invites (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid,
    inviter_id uuid NOT NULL,
    masterpass_id uuid,
    tier text NOT NULL,
    token text NOT NULL,
    invitee_user_id uuid,
    status text DEFAULT 'pending'::text NOT NULL,
    claimed_by uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    claimed_at timestamp with time zone,
    game_type text DEFAULT 'tournament'::text NOT NULL,
    game_id uuid
);


--
-- Name: tq_matches; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_matches (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    group_id uuid,
    knockout_round text,
    bracket_slot integer,
    team_a_id uuid,
    team_b_id uuid,
    start_time timestamp with time zone,
    status text DEFAULT 'scheduled'::text NOT NULL,
    score_a integer,
    score_b integer,
    winner_team_id uuid,
    first_scorer_team_id uuid,
    is_official_quest_match boolean DEFAULT false NOT NULL,
    quest_slot_key text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    first_goal_half text,
    total_cards integer
);


--
-- Name: tq_phase_windows; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_phase_windows (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    phase_key text NOT NULL,
    state text DEFAULT 'open'::text NOT NULL,
    opens_at timestamp with time zone,
    locks_at timestamp with time zone
);


--
-- Name: tq_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    team_id uuid,
    name text NOT NULL,
    photo text
);


--
-- Name: tq_scoring_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_scoring_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    entry_id uuid NOT NULL,
    source_type text NOT NULL,
    source_id uuid,
    points integer NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: tq_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.tq_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    competition_id uuid NOT NULL,
    name text NOT NULL,
    short_name text,
    flag_url text,
    external_id bigint,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_activity_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_activity_logs (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    week_start date NOT NULL,
    days_active integer DEFAULT 0,
    predictions_made integer DEFAULT 0,
    predictions_correct integer DEFAULT 0,
    fantasy_games integer DEFAULT 0,
    fantasy_avg_score numeric DEFAULT 0,
    fantasy_total_score numeric DEFAULT 0,
    bets_placed integer DEFAULT 0,
    bets_won integer DEFAULT 0,
    total_bet_amount numeric DEFAULT 0,
    total_win_amount numeric DEFAULT 0,
    avg_win_odds numeric DEFAULT 0,
    badges_earned integer DEFAULT 0,
    game_types_played integer DEFAULT 0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now()
);


--
-- Name: TABLE user_activity_logs; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_activity_logs IS 'Weekly aggregated user activity metrics for XP calculation';


--
-- Name: user_badges; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_badges (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    badge_id uuid NOT NULL,
    earned_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
    season_id uuid
);


--
-- Name: user_daily_hpi; Type: MATERIALIZED VIEW; Schema: public; Owner: -
--

CREATE MATERIALIZED VIEW public.user_daily_hpi AS
 SELECT user_id,
    date(created_at) AS prediction_date,
    count(*) AS total_predictions,
    sum(
        CASE
            WHEN is_correct THEN 1
            ELSE 0
        END) AS correct_predictions,
    round((((sum(
        CASE
            WHEN is_correct THEN 1
            ELSE 0
        END))::numeric / (count(*))::numeric) * avg(((odds_at_prediction ->> 'home_odds'::text))::numeric)), 2) AS hpi
   FROM public.swipe_predictions sp
  WHERE (created_at >= (now() - '30 days'::interval))
  GROUP BY user_id, (date(created_at))
 HAVING (count(*) >= 3)
  WITH NO DATA;


--
-- Name: user_fantasy_boosters; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_fantasy_boosters (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    booster_type text NOT NULL,
    used_in_gameweek_id uuid NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_fantasy_scores; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_fantasy_scores (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    challenge_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    points integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_fantasy_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_fantasy_teams (
    id uuid DEFAULT extensions.uuid_generate_v4() NOT NULL,
    user_id uuid NOT NULL,
    game_id uuid NOT NULL,
    game_week_id uuid NOT NULL,
    starters uuid[] NOT NULL,
    substitutes uuid[] DEFAULT '{}'::uuid[],
    captain_id uuid,
    booster_used integer,
    fatigue_state jsonb DEFAULT '{}'::jsonb,
    total_points numeric(5,1) DEFAULT 0.0,
    created_at timestamp with time zone DEFAULT now(),
    updated_at timestamp with time zone DEFAULT now(),
    booster_target_id uuid,
    player_points jsonb DEFAULT '{}'::jsonb NOT NULL,
    player_positions jsonb DEFAULT '{}'::jsonb NOT NULL,
    player_slots jsonb DEFAULT '{}'::jsonb NOT NULL,
    CONSTRAINT check_starters_length CHECK ((array_length(starters, 1) = 7)),
    CONSTRAINT check_substitutes_length CHECK ((array_length(substitutes, 1) <= 2)),
    CONSTRAINT user_fantasy_teams_booster_used_check CHECK ((booster_used = ANY (ARRAY[1, 2, 3])))
);


--
-- Name: COLUMN user_fantasy_teams.booster_target_id; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON COLUMN public.user_fantasy_teams.booster_target_id IS 'Player UUID targeted by Recovery Boost (booster_used=3). Restores fatigue to 100% if player plays. Refunded if player DNP.';


--
-- Name: user_masterpasses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_masterpasses (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    tier text NOT NULL,
    status text DEFAULT 'available'::text NOT NULL,
    source text,
    used_at timestamp with time zone,
    used_competition_id uuid,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: user_onesignal_players; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_onesignal_players (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    player_id text NOT NULL,
    device_type text,
    is_active boolean DEFAULT true NOT NULL,
    last_seen_at timestamp with time zone DEFAULT now(),
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_onesignal_players_device_type_check CHECK ((device_type = ANY (ARRAY['web'::text, 'ios'::text, 'android'::text])))
);


--
-- Name: TABLE user_onesignal_players; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_onesignal_players IS 'OneSignal Player IDs for each user device. Used to send push notifications.';


--
-- Name: user_profile_stats; Type: VIEW; Schema: public; Owner: -
--

CREATE VIEW public.user_profile_stats WITH (security_invoker='on') AS
 WITH prediction_stats AS (
         SELECT swipe_predictions.user_id,
            count(*) AS predictions_total,
            sum(
                CASE
                    WHEN swipe_predictions.is_correct THEN 1
                    ELSE 0
                END) AS predictions_correct
           FROM public.swipe_predictions
          GROUP BY swipe_predictions.user_id
        ), hpi_stats AS (
         SELECT recent.user_id,
            round(avg(recent.hpi), 2) AS hot_performance_index,
            max(recent.hpi) AS best_hpi,
            (array_agg(recent.prediction_date ORDER BY recent.hpi DESC))[1] AS best_hpi_date
           FROM ( SELECT user_daily_hpi.user_id,
                    user_daily_hpi.hpi,
                    user_daily_hpi.prediction_date,
                    row_number() OVER (PARTITION BY user_daily_hpi.user_id ORDER BY user_daily_hpi.prediction_date DESC) AS rn
                   FROM public.user_daily_hpi) recent
          WHERE (recent.rn <= 10)
          GROUP BY recent.user_id
        ), streak_stats AS (
         SELECT gaps.user_id,
            count(*) AS streak
           FROM ( SELECT user_daily_hpi.user_id,
                    user_daily_hpi.prediction_date,
                    user_daily_hpi.hpi,
                    (user_daily_hpi.prediction_date - lag(user_daily_hpi.prediction_date) OVER (PARTITION BY user_daily_hpi.user_id ORDER BY user_daily_hpi.prediction_date)) AS day_diff
                   FROM public.user_daily_hpi
                  WHERE (user_daily_hpi.hpi >= 1.0)
                  ORDER BY user_daily_hpi.user_id, user_daily_hpi.prediction_date DESC) gaps
          WHERE ((gaps.day_diff IS NULL) OR (gaps.day_diff = 1))
          GROUP BY gaps.user_id
        ), bet_stats AS (
         SELECT ce.user_id,
            round(avg(cb.amount)) AS average_bet_coins,
            round(LEAST((10)::numeric, GREATEST((1)::numeric, ((5)::numeric + (stddev((cb.amount)::numeric) / (100)::numeric)))), 1) AS risk_index
           FROM ((public.challenge_bets cb
             JOIN public.challenge_daily_entries cde ON ((cde.id = cb.daily_entry_id)))
             JOIN public.challenge_entries ce ON ((ce.id = cde.challenge_entry_id)))
          GROUP BY ce.user_id
        ), game_stats AS (
         SELECT cp.user_id,
            count(*) AS games_played,
            sum(
                CASE
                    WHEN (cp.rank = 1) THEN 1
                    ELSE 0
                END) AS gold_podiums,
            sum(
                CASE
                    WHEN (cp.rank = 2) THEN 1
                    ELSE 0
                END) AS silver_podiums,
            sum(
                CASE
                    WHEN (cp.rank = 3) THEN 1
                    ELSE 0
                END) AS bronze_podiums
           FROM public.challenge_participants cp
          WHERE (cp.rank IS NOT NULL)
          GROUP BY cp.user_id
        ), trophy_stats AS (
         SELECT challenge_participants.user_id,
            count(*) AS trophies
           FROM public.challenge_participants
          WHERE (challenge_participants.rank <= 3)
          GROUP BY challenge_participants.user_id
        ), badge_stats AS (
         SELECT ub.user_id,
            count(*) AS badge_count,
            array_agg(b.name ORDER BY ub.earned_at DESC) AS badge_names
           FROM (public.user_badges ub
             JOIN public.badges b ON ((b.id = ub.badge_id)))
          GROUP BY ub.user_id
        ), league_stats AS (
         SELECT DISTINCT ON (sp.user_id) sp.user_id,
            l.name AS most_played_league
           FROM ((public.swipe_predictions sp
             JOIN public.fb_fixtures f ON ((f.id = sp.fixture_id)))
             JOIN public.fb_leagues l ON ((l.id = f.league_id)))
          GROUP BY sp.user_id, l.name
          ORDER BY sp.user_id, (count(*)) DESC
        ), team_stats AS (
         SELECT DISTINCT ON (sp.user_id) sp.user_id,
            COALESCE(( SELECT t.name
                   FROM (public.fb_fixtures f
                     JOIN public.fb_teams t ON (((t.id = f.home_team_id) OR (t.id = f.away_team_id))))
                  WHERE (f.id IN ( SELECT sp2.fixture_id
                           FROM public.swipe_predictions sp2
                          WHERE (sp2.user_id = sp.user_id)))
                  GROUP BY t.name
                  ORDER BY (count(*)) DESC
                 LIMIT 1), 'Unknown'::text) AS most_played_team
           FROM public.swipe_predictions sp
          GROUP BY sp.user_id
        ), game_type_stats AS (
         SELECT DISTINCT ON (cp.user_id) cp.user_id,
            (c.game_type)::text AS favorite_game_type
           FROM (public.challenge_participants cp
             JOIN public.challenges c ON ((c.id = cp.challenge_id)))
          GROUP BY cp.user_id, c.game_type
          ORDER BY cp.user_id, (count(*)) DESC
        ), recent_accuracy AS (
         SELECT swipe_predictions.user_id,
            round(((sum(
                CASE
                    WHEN swipe_predictions.is_correct THEN 1
                    ELSE 0
                END))::numeric / (count(*))::numeric), 2) AS last_10_days_accuracy
           FROM public.swipe_predictions
          WHERE (swipe_predictions.created_at >= (now() - '10 days'::interval))
          GROUP BY swipe_predictions.user_id
        )
 SELECT u.id AS user_id,
    u.username,
    COALESCE(ps.predictions_total, (0)::bigint) AS predictions_total,
    COALESCE(ps.predictions_correct, (0)::bigint) AS predictions_correct,
    COALESCE(hpi.hot_performance_index, (0)::numeric) AS hot_performance_index,
    COALESCE(hpi.best_hpi, (0)::numeric) AS best_hpi,
    hpi.best_hpi_date,
    COALESCE(ss.streak, (0)::bigint) AS streak,
    COALESCE(bs.average_bet_coins, (0)::numeric) AS average_bet_coins,
    COALESCE(bs.risk_index, 5.0) AS risk_index,
    COALESCE(gs.games_played, (0)::bigint) AS games_played,
    COALESCE(gs.gold_podiums, (0)::bigint) AS gold_podiums,
    COALESCE(gs.silver_podiums, (0)::bigint) AS silver_podiums,
    COALESCE(gs.bronze_podiums, (0)::bigint) AS bronze_podiums,
    COALESCE(ts.trophies, (0)::bigint) AS trophies,
    COALESCE(badges.badge_count, (0)::bigint) AS badge_count,
    COALESCE(badges.badge_names, ARRAY[]::text[]) AS badge_names,
    COALESCE(ls.most_played_league, 'Unknown'::text) AS most_played_league,
    COALESCE(team.most_played_team, 'Unknown'::text) AS most_played_team,
    COALESCE(gt.favorite_game_type, 'Unknown'::text) AS favorite_game_type,
    COALESCE(ra.last_10_days_accuracy, (0)::numeric) AS last_10_days_accuracy
   FROM (((((((((((public.users u
     LEFT JOIN prediction_stats ps ON ((ps.user_id = u.id)))
     LEFT JOIN hpi_stats hpi ON ((hpi.user_id = u.id)))
     LEFT JOIN streak_stats ss ON ((ss.user_id = u.id)))
     LEFT JOIN bet_stats bs ON ((bs.user_id = u.id)))
     LEFT JOIN game_stats gs ON ((gs.user_id = u.id)))
     LEFT JOIN trophy_stats ts ON ((ts.user_id = u.id)))
     LEFT JOIN badge_stats badges ON ((badges.user_id = u.id)))
     LEFT JOIN league_stats ls ON ((ls.user_id = u.id)))
     LEFT JOIN team_stats team ON ((team.user_id = u.id)))
     LEFT JOIN game_type_stats gt ON ((gt.user_id = u.id)))
     LEFT JOIN recent_accuracy ra ON ((ra.user_id = u.id)));


--
-- Name: user_spin_states; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_spin_states (
    user_id uuid NOT NULL,
    pity_counter integer DEFAULT 0 NOT NULL,
    adaptive_multipliers jsonb DEFAULT '{}'::jsonb NOT NULL,
    available_spins jsonb DEFAULT '{"apex": 0, "free": 0, "master": 0, "amateur": 0, "premium": 0}'::jsonb NOT NULL,
    last_free_spin_at timestamp with time zone,
    free_spin_streak integer DEFAULT 0 NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_spin_states_free_spin_streak_check CHECK ((free_spin_streak >= 0)),
    CONSTRAINT user_spin_states_pity_counter_check CHECK ((pity_counter >= 0))
);


--
-- Name: TABLE user_spin_states; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_spin_states IS 'Stores per-user spin wheel state including pity counter, adaptive multipliers, and available spins';


--
-- Name: user_streaks; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_streaks (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    current_day integer DEFAULT 1 NOT NULL,
    last_claimed_at timestamp with time zone DEFAULT now() NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL,
    CONSTRAINT user_streaks_current_day_check CHECK (((current_day >= 1) AND (current_day <= 7)))
);


--
-- Name: user_teams; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_teams (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid,
    fantasy_game_id uuid,
    starters jsonb NOT NULL,
    substitutes jsonb NOT NULL,
    captain_id uuid,
    booster text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: TABLE user_teams; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TABLE public.user_teams IS 'Stores the team composition for each user in a fantasy game.';


--
-- Name: user_tickets; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.user_tickets (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    ticket_type public.ticket_type NOT NULL,
    is_used boolean DEFAULT false NOT NULL,
    used_at timestamp with time zone,
    used_for_challenge_id uuid,
    expires_at timestamp with time zone NOT NULL,
    granted_reason text DEFAULT 'reward'::text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    updated_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_events; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_events (
    id uuid DEFAULT gen_random_uuid() NOT NULL,
    user_id uuid NOT NULL,
    amount integer NOT NULL,
    source_type text NOT NULL,
    source_id text NOT NULL,
    reason text,
    created_at timestamp with time zone DEFAULT now() NOT NULL
);


--
-- Name: xp_formula_config; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.xp_formula_config (
    key text NOT NULL,
    value numeric NOT NULL,
    label text
);


--
-- Name: fantasy_boosters id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_boosters ALTER COLUMN id SET DEFAULT nextval('public.fantasy_boosters_id_seq'::regclass);


--
-- Name: api_sync_config api_sync_config_endpoint_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_sync_config
    ADD CONSTRAINT api_sync_config_endpoint_key UNIQUE (endpoint);


--
-- Name: api_sync_config api_sync_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.api_sync_config
    ADD CONSTRAINT api_sync_config_pkey PRIMARY KEY (id);


--
-- Name: app_config app_config_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_key_key UNIQUE (key);


--
-- Name: app_config app_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_pkey PRIMARY KEY (id);


--
-- Name: badges badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.badges
    ADD CONSTRAINT badges_pkey PRIMARY KEY (id);


--
-- Name: boosters boosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosters
    ADD CONSTRAINT boosters_pkey PRIMARY KEY (id);


--
-- Name: challenge_bets challenge_bets_daily_entry_id_challenge_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_bets
    ADD CONSTRAINT challenge_bets_daily_entry_id_challenge_match_id_key UNIQUE (daily_entry_id, challenge_match_id);


--
-- Name: challenge_bets challenge_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_bets
    ADD CONSTRAINT challenge_bets_pkey PRIMARY KEY (id);


--
-- Name: challenge_configs challenge_configs_challenge_id_config_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_configs
    ADD CONSTRAINT challenge_configs_challenge_id_config_type_key UNIQUE (challenge_id, config_type);


--
-- Name: challenge_configs challenge_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_configs
    ADD CONSTRAINT challenge_configs_pkey PRIMARY KEY (id);


--
-- Name: challenge_daily_entries challenge_daily_entries_challenge_entry_id_day_number_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_entries
    ADD CONSTRAINT challenge_daily_entries_challenge_entry_id_day_number_key UNIQUE (challenge_entry_id, day_number);


--
-- Name: challenge_daily_entries challenge_daily_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_entries
    ADD CONSTRAINT challenge_daily_entries_pkey PRIMARY KEY (id);


--
-- Name: challenge_entries challenge_entries_challenge_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_challenge_id_user_id_key UNIQUE (challenge_id, user_id);


--
-- Name: challenge_entries challenge_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_pkey PRIMARY KEY (id);


--
-- Name: challenge_leagues challenge_leagues_challenge_id_league_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_leagues
    ADD CONSTRAINT challenge_leagues_challenge_id_league_id_key UNIQUE (challenge_id, league_id);


--
-- Name: challenge_leagues challenge_leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_leagues
    ADD CONSTRAINT challenge_leagues_pkey PRIMARY KEY (id);


--
-- Name: challenge_matchdays challenge_matchdays_challenge_id_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matchdays
    ADD CONSTRAINT challenge_matchdays_challenge_id_date_key UNIQUE (challenge_id, date);


--
-- Name: challenge_matchdays challenge_matchdays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matchdays
    ADD CONSTRAINT challenge_matchdays_pkey PRIMARY KEY (id);


--
-- Name: challenge_matches challenge_matches_challenge_id_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matches
    ADD CONSTRAINT challenge_matches_challenge_id_match_id_key UNIQUE (challenge_id, match_id);


--
-- Name: challenge_matches challenge_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matches
    ADD CONSTRAINT challenge_matches_pkey PRIMARY KEY (id);


--
-- Name: challenge_participants challenge_participants_challenge_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_challenge_id_user_id_key UNIQUE (challenge_id, user_id);


--
-- Name: challenge_participants challenge_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_pkey PRIMARY KEY (id);


--
-- Name: challenge_required_badges challenge_required_badges_challenge_id_badge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_required_badges
    ADD CONSTRAINT challenge_required_badges_challenge_id_badge_id_key UNIQUE (challenge_id, badge_id);


--
-- Name: challenge_required_badges challenge_required_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_required_badges
    ADD CONSTRAINT challenge_required_badges_pkey PRIMARY KEY (id);


--
-- Name: challenges challenges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_pkey PRIMARY KEY (id);


--
-- Name: coin_transactions coin_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_pkey PRIMARY KEY (id);


--
-- Name: content_versions content_versions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.content_versions
    ADD CONSTRAINT content_versions_pkey PRIMARY KEY (key);


--
-- Name: countries countries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.countries
    ADD CONSTRAINT countries_pkey PRIMARY KEY (id);


--
-- Name: fantasy_boosters fantasy_boosters_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_boosters
    ADD CONSTRAINT fantasy_boosters_name_key UNIQUE (name);


--
-- Name: fantasy_boosters fantasy_boosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_boosters
    ADD CONSTRAINT fantasy_boosters_pkey PRIMARY KEY (id);


--
-- Name: fantasy_configs fantasy_configs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_configs
    ADD CONSTRAINT fantasy_configs_pkey PRIMARY KEY (id);


--
-- Name: fantasy_game_weeks fantasy_game_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_game_weeks
    ADD CONSTRAINT fantasy_game_weeks_pkey PRIMARY KEY (id);


--
-- Name: fantasy_games fantasy_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_games
    ADD CONSTRAINT fantasy_games_pkey PRIMARY KEY (id);


--
-- Name: fantasy_leaderboard fantasy_leaderboard_game_id_game_week_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_leaderboard
    ADD CONSTRAINT fantasy_leaderboard_game_id_game_week_id_user_id_key UNIQUE (game_id, game_week_id, user_id);


--
-- Name: fantasy_leaderboard fantasy_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_leaderboard
    ADD CONSTRAINT fantasy_leaderboard_pkey PRIMARY KEY (id);


--
-- Name: fantasy_league_players fantasy_league_players_league_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_league_players
    ADD CONSTRAINT fantasy_league_players_league_id_player_id_key UNIQUE (league_id, player_id);


--
-- Name: fantasy_league_players fantasy_league_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_league_players
    ADD CONSTRAINT fantasy_league_players_pkey PRIMARY KEY (id);


--
-- Name: fantasy_players fantasy_players_api_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_players
    ADD CONSTRAINT fantasy_players_api_player_id_key UNIQUE (api_player_id);


--
-- Name: fantasy_players fantasy_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_players
    ADD CONSTRAINT fantasy_players_pkey PRIMARY KEY (id);


--
-- Name: fb_fixture_events fb_fixture_events_api_fixture_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_events
    ADD CONSTRAINT fb_fixture_events_api_fixture_id_seq_key UNIQUE (api_fixture_id, seq);


--
-- Name: fb_fixture_events fb_fixture_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_events
    ADD CONSTRAINT fb_fixture_events_pkey PRIMARY KEY (id);


--
-- Name: fb_fixture_statistics fb_fixture_statistics_api_fixture_id_team_api_id_stat_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_statistics
    ADD CONSTRAINT fb_fixture_statistics_api_fixture_id_team_api_id_stat_type_key UNIQUE (api_fixture_id, team_api_id, stat_type);


--
-- Name: fb_fixture_statistics fb_fixture_statistics_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_statistics
    ADD CONSTRAINT fb_fixture_statistics_pkey PRIMARY KEY (id);


--
-- Name: fb_fixture_stats fb_fixture_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_stats
    ADD CONSTRAINT fb_fixture_stats_pkey PRIMARY KEY (fixture_id);


--
-- Name: fb_player_season_stats fb_player_season_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_season_stats
    ADD CONSTRAINT fb_player_season_stats_pkey PRIMARY KEY (id);


--
-- Name: fb_player_season_stats fb_player_season_stats_player_id_season_team_api_id_league__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_season_stats
    ADD CONSTRAINT fb_player_season_stats_player_id_season_team_api_id_league__key UNIQUE (player_id, season, team_api_id, league_api_id);


--
-- Name: fb_standings fb_standings_league_api_id_season_team_api_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_standings
    ADD CONSTRAINT fb_standings_league_api_id_season_team_api_id_key UNIQUE (league_api_id, season, team_api_id);


--
-- Name: fb_standings fb_standings_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_standings
    ADD CONSTRAINT fb_standings_pkey PRIMARY KEY (id);


--
-- Name: fb_transfers fb_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_transfers
    ADD CONSTRAINT fb_transfers_pkey PRIMARY KEY (id);


--
-- Name: fb_transfers fb_transfers_player_id_transfer_date_team_in_api_team_out_a_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_transfers
    ADD CONSTRAINT fb_transfers_player_id_transfer_date_team_in_api_team_out_a_key UNIQUE (player_id, transfer_date, team_in_api, team_out_api);


--
-- Name: fixture_sync_log fixture_sync_log_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixture_sync_log
    ADD CONSTRAINT fixture_sync_log_pkey PRIMARY KEY (id);


--
-- Name: fb_fixtures fixtures_api_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixtures
    ADD CONSTRAINT fixtures_api_id_key UNIQUE (api_id);


--
-- Name: fixtures fixtures_api_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_api_id_key1 UNIQUE (api_id);


--
-- Name: fb_fixtures fixtures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixtures
    ADD CONSTRAINT fixtures_pkey PRIMARY KEY (id);


--
-- Name: fixtures fixtures_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fixtures
    ADD CONSTRAINT fixtures_pkey1 PRIMARY KEY (id);


--
-- Name: game_config game_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_config
    ADD CONSTRAINT game_config_pkey PRIMARY KEY (id);


--
-- Name: game_weeks game_weeks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_weeks
    ADD CONSTRAINT game_weeks_pkey PRIMARY KEY (id);


--
-- Name: league_games league_games_league_id_challenge_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_games
    ADD CONSTRAINT league_games_league_id_challenge_id_key UNIQUE (league_id, challenge_id);


--
-- Name: league_games league_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_games
    ADD CONSTRAINT league_games_pkey PRIMARY KEY (id);


--
-- Name: league_members league_members_league_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_league_id_user_id_key UNIQUE (league_id, user_id);


--
-- Name: league_members league_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_pkey PRIMARY KEY (id);


--
-- Name: fb_leagues leagues_api_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_api_id_key UNIQUE (api_id);


--
-- Name: leagues leagues_api_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_api_id_key1 UNIQUE (api_id);


--
-- Name: fb_leagues leagues_api_id_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_api_id_unique UNIQUE (api_id);


--
-- Name: fb_leagues leagues_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_invite_code_key UNIQUE (invite_code);


--
-- Name: fb_leagues leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_pkey PRIMARY KEY (id);


--
-- Name: leagues leagues_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_pkey1 PRIMARY KEY (id);


--
-- Name: levels_config levels_config_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels_config
    ADD CONSTRAINT levels_config_name_key UNIQUE (name);


--
-- Name: levels_config levels_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.levels_config
    ADD CONSTRAINT levels_config_pkey PRIMARY KEY (level);


--
-- Name: lf_activation lf_activation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_activation
    ADD CONSTRAINT lf_activation_pkey PRIMARY KEY (id);


--
-- Name: lf_config lf_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_config
    ADD CONSTRAINT lf_config_pkey PRIMARY KEY (id);


--
-- Name: lf_game_players lf_game_players_game_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_game_players
    ADD CONSTRAINT lf_game_players_game_id_player_id_key UNIQUE (game_id, player_id);


--
-- Name: lf_game_players lf_game_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_game_players
    ADD CONSTRAINT lf_game_players_pkey PRIMARY KEY (id);


--
-- Name: lf_games lf_games_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_games
    ADD CONSTRAINT lf_games_fixture_id_key UNIQUE (fixture_id);


--
-- Name: lf_games lf_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_games
    ADD CONSTRAINT lf_games_pkey PRIMARY KEY (id);


--
-- Name: lf_notify lf_notify_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_notify
    ADD CONSTRAINT lf_notify_pkey PRIMARY KEY (id);


--
-- Name: lf_notify lf_notify_user_id_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_notify
    ADD CONSTRAINT lf_notify_user_id_fixture_id_key UNIQUE (user_id, fixture_id);


--
-- Name: lf_team_players lf_team_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_team_players
    ADD CONSTRAINT lf_team_players_pkey PRIMARY KEY (id);


--
-- Name: lf_team_players lf_team_players_team_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_team_players
    ADD CONSTRAINT lf_team_players_team_id_player_id_key UNIQUE (team_id, player_id);


--
-- Name: lf_teams lf_teams_game_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_teams
    ADD CONSTRAINT lf_teams_game_id_user_id_key UNIQUE (game_id, user_id);


--
-- Name: lf_teams lf_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_teams
    ADD CONSTRAINT lf_teams_pkey PRIMARY KEY (id);


--
-- Name: live_game_bets live_game_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_bets
    ADD CONSTRAINT live_game_bets_pkey PRIMARY KEY (id);


--
-- Name: live_game_entries live_game_entries_live_game_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_entries
    ADD CONSTRAINT live_game_entries_live_game_id_user_id_key UNIQUE (live_game_id, user_id);


--
-- Name: live_game_entries live_game_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_entries
    ADD CONSTRAINT live_game_entries_pkey PRIMARY KEY (id);


--
-- Name: live_game_tier_limits live_game_tier_limits_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_tier_limits
    ADD CONSTRAINT live_game_tier_limits_pkey PRIMARY KEY (id);


--
-- Name: live_game_tier_limits live_game_tier_limits_tier_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_tier_limits
    ADD CONSTRAINT live_game_tier_limits_tier_key UNIQUE (tier);


--
-- Name: live_games live_games_friend_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_games
    ADD CONSTRAINT live_games_friend_code_key UNIQUE (friend_code);


--
-- Name: live_games live_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_games
    ADD CONSTRAINT live_games_pkey PRIMARY KEY (id);


--
-- Name: live_pred_config live_pred_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_pred_config
    ADD CONSTRAINT live_pred_config_pkey PRIMARY KEY (id);


--
-- Name: match_bets match_bets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_bets
    ADD CONSTRAINT match_bets_pkey PRIMARY KEY (id);


--
-- Name: match_bets match_bets_user_id_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_bets
    ADD CONSTRAINT match_bets_user_id_fixture_id_key UNIQUE (user_id, fixture_id);


--
-- Name: matchday_fixtures matchday_fixtures_matchday_id_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_fixtures
    ADD CONSTRAINT matchday_fixtures_matchday_id_fixture_id_key UNIQUE (matchday_id, fixture_id);


--
-- Name: matchday_fixtures matchday_fixtures_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_fixtures
    ADD CONSTRAINT matchday_fixtures_pkey PRIMARY KEY (id);


--
-- Name: matchday_participants matchday_participants_matchday_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_participants
    ADD CONSTRAINT matchday_participants_matchday_id_user_id_key UNIQUE (matchday_id, user_id);


--
-- Name: matchday_participants matchday_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_participants
    ADD CONSTRAINT matchday_participants_pkey PRIMARY KEY (id);


--
-- Name: matches matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_pkey PRIMARY KEY (id);


--
-- Name: mr_activation mr_activation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_activation
    ADD CONSTRAINT mr_activation_pkey PRIMARY KEY (id);


--
-- Name: mr_activation mr_activation_scope_target_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_activation
    ADD CONSTRAINT mr_activation_scope_target_id_key UNIQUE (scope, target_id);


--
-- Name: mr_answers mr_answers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_answers
    ADD CONSTRAINT mr_answers_pkey PRIMARY KEY (id);


--
-- Name: mr_answers mr_answers_question_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_answers
    ADD CONSTRAINT mr_answers_question_id_user_id_key UNIQUE (question_id, user_id);


--
-- Name: mr_config mr_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_config
    ADD CONSTRAINT mr_config_pkey PRIMARY KEY (id);


--
-- Name: mr_event_catalog mr_event_catalog_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_event_catalog
    ADD CONSTRAINT mr_event_catalog_key_key UNIQUE (key);


--
-- Name: mr_event_catalog mr_event_catalog_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_event_catalog
    ADD CONSTRAINT mr_event_catalog_pkey PRIMARY KEY (id);


--
-- Name: mr_games mr_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_games
    ADD CONSTRAINT mr_games_pkey PRIMARY KEY (id);


--
-- Name: mr_participants mr_participants_game_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_participants
    ADD CONSTRAINT mr_participants_game_id_user_id_key UNIQUE (game_id, user_id);


--
-- Name: mr_participants mr_participants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_participants
    ADD CONSTRAINT mr_participants_pkey PRIMARY KEY (id);


--
-- Name: mr_pot_assignments mr_pot_assignments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_pot_assignments
    ADD CONSTRAINT mr_pot_assignments_pkey PRIMARY KEY (id);


--
-- Name: mr_pot_profiles mr_pot_profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_pot_profiles
    ADD CONSTRAINT mr_pot_profiles_pkey PRIMARY KEY (id);


--
-- Name: mr_questions mr_questions_game_id_seq_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_questions
    ADD CONSTRAINT mr_questions_game_id_seq_key UNIQUE (game_id, seq);


--
-- Name: mr_questions mr_questions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_questions
    ADD CONSTRAINT mr_questions_pkey PRIMARY KEY (id);


--
-- Name: notification_preferences notification_preferences_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_pkey PRIMARY KEY (user_id);


--
-- Name: notifications notifications_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_pkey PRIMARY KEY (id);


--
-- Name: fb_odds odds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_odds
    ADD CONSTRAINT odds_pkey PRIMARY KEY (id);


--
-- Name: odds odds_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.odds
    ADD CONSTRAINT odds_pkey1 PRIMARY KEY (id);


--
-- Name: fb_player_match_stats player_match_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_match_stats
    ADD CONSTRAINT player_match_stats_pkey PRIMARY KEY (id);


--
-- Name: player_match_stats player_match_stats_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_stats
    ADD CONSTRAINT player_match_stats_pkey1 PRIMARY KEY (id);


--
-- Name: fb_player_match_stats player_match_stats_player_id_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_match_stats
    ADD CONSTRAINT player_match_stats_player_id_fixture_id_key UNIQUE (player_id, fixture_id);


--
-- Name: player_match_stats player_match_stats_player_id_fixture_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_stats
    ADD CONSTRAINT player_match_stats_player_id_fixture_id_key1 UNIQUE (player_id, fixture_id);


--
-- Name: player_season_stats player_season_stats_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_stats
    ADD CONSTRAINT player_season_stats_pkey1 PRIMARY KEY (id);


--
-- Name: player_season_stats player_season_stats_player_id_season_team_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_stats
    ADD CONSTRAINT player_season_stats_player_id_season_team_id_key1 UNIQUE (player_id, season, team_id);


--
-- Name: fb_player_team_association player_team_association_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_team_association
    ADD CONSTRAINT player_team_association_pkey PRIMARY KEY (id);


--
-- Name: fb_player_team_association player_team_association_player_team_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_team_association
    ADD CONSTRAINT player_team_association_player_team_unique UNIQUE (player_id, team_id);


--
-- Name: player_transfers player_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_transfers
    ADD CONSTRAINT player_transfers_pkey PRIMARY KEY (id);


--
-- Name: player_transfers player_transfers_player_id_transfer_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_transfers
    ADD CONSTRAINT player_transfers_player_id_transfer_date_key UNIQUE (player_id, transfer_date);


--
-- Name: fb_players players_api_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_players
    ADD CONSTRAINT players_api_id_key UNIQUE (api_id);


--
-- Name: players players_api_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_api_id_key1 UNIQUE (api_id);


--
-- Name: fb_players players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_players
    ADD CONSTRAINT players_pkey PRIMARY KEY (id);


--
-- Name: players players_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.players
    ADD CONSTRAINT players_pkey1 PRIMARY KEY (id);


--
-- Name: premium_daily_claims premium_daily_claims_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_daily_claims
    ADD CONSTRAINT premium_daily_claims_pkey PRIMARY KEY (user_id, claim_date);


--
-- Name: profiles profiles_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_pkey PRIMARY KEY (id);


--
-- Name: profiles profiles_referralcode_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_referralcode_key UNIQUE (referralcode);


--
-- Name: profiles profiles_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_username_key UNIQUE (username);


--
-- Name: puzzle_config puzzle_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_config
    ADD CONSTRAINT puzzle_config_pkey PRIMARY KEY (id);


--
-- Name: puzzle_daily_prizes puzzle_daily_prizes_level_puzzle_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_daily_prizes
    ADD CONSTRAINT puzzle_daily_prizes_level_puzzle_date_key UNIQUE (level, puzzle_date);


--
-- Name: puzzle_daily_prizes puzzle_daily_prizes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_daily_prizes
    ADD CONSTRAINT puzzle_daily_prizes_pkey PRIMARY KEY (id);


--
-- Name: puzzle_games puzzle_games_game_type_level_puzzle_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_games
    ADD CONSTRAINT puzzle_games_game_type_level_puzzle_date_key UNIQUE (game_type, level, puzzle_date);


--
-- Name: puzzle_games puzzle_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_games
    ADD CONSTRAINT puzzle_games_pkey PRIMARY KEY (id);


--
-- Name: puzzle_monthly_grants puzzle_monthly_grants_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_monthly_grants
    ADD CONSTRAINT puzzle_monthly_grants_pkey PRIMARY KEY (user_id, period, day_key);


--
-- Name: puzzle_plays puzzle_plays_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_plays
    ADD CONSTRAINT puzzle_plays_pkey PRIMARY KEY (id);


--
-- Name: puzzle_plays puzzle_plays_user_id_game_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_plays
    ADD CONSTRAINT puzzle_plays_user_id_game_id_key UNIQUE (user_id, game_id);


--
-- Name: puzzle_progress puzzle_progress_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_progress
    ADD CONSTRAINT puzzle_progress_pkey PRIMARY KEY (user_id, game_type, level);


--
-- Name: puzzle_round_attempts puzzle_round_attempts_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_round_attempts
    ADD CONSTRAINT puzzle_round_attempts_pkey PRIMARY KEY (id);


--
-- Name: puzzle_round_attempts puzzle_round_attempts_play_id_round_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_round_attempts
    ADD CONSTRAINT puzzle_round_attempts_play_id_round_no_key UNIQUE (play_id, round_no);


--
-- Name: puzzle_rounds puzzle_rounds_game_id_round_no_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_rounds
    ADD CONSTRAINT puzzle_rounds_game_id_round_no_key UNIQUE (game_id, round_no);


--
-- Name: puzzle_rounds puzzle_rounds_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_rounds
    ADD CONSTRAINT puzzle_rounds_pkey PRIMARY KEY (id);


--
-- Name: puzzle_user_prefs puzzle_user_prefs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_user_prefs
    ADD CONSTRAINT puzzle_user_prefs_pkey PRIMARY KEY (user_id, game_type);


--
-- Name: reward_fulfillments reward_fulfillments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_fulfillments
    ADD CONSTRAINT reward_fulfillments_pkey PRIMARY KEY (id);


--
-- Name: reward_packs reward_packs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.reward_packs
    ADD CONSTRAINT reward_packs_pkey PRIMARY KEY (id);


--
-- Name: scores scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_pkey PRIMARY KEY (id);


--
-- Name: season_logs season_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_logs
    ADD CONSTRAINT season_logs_pkey PRIMARY KEY (id);


--
-- Name: seasons seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seasons
    ADD CONSTRAINT seasons_pkey PRIMARY KEY (id);


--
-- Name: seed_runs seed_runs_league_api_id_season_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seed_runs
    ADD CONSTRAINT seed_runs_league_api_id_season_phase_key UNIQUE (league_api_id, season, phase);


--
-- Name: seed_runs seed_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.seed_runs
    ADD CONSTRAINT seed_runs_pkey PRIMARY KEY (id);


--
-- Name: spin_history spin_history_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spin_history
    ADD CONSTRAINT spin_history_pkey PRIMARY KEY (id);


--
-- Name: spin_segments spin_segments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spin_segments
    ADD CONSTRAINT spin_segments_pkey PRIMARY KEY (id);


--
-- Name: squad_blocks squad_blocks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_blocks
    ADD CONSTRAINT squad_blocks_pkey PRIMARY KEY (id);


--
-- Name: squad_blocks squad_blocks_squad_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_blocks
    ADD CONSTRAINT squad_blocks_squad_id_user_id_key UNIQUE (squad_id, user_id);


--
-- Name: squad_feed_likes squad_feed_likes_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed_likes
    ADD CONSTRAINT squad_feed_likes_pkey PRIMARY KEY (id);


--
-- Name: squad_feed_likes squad_feed_likes_post_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed_likes
    ADD CONSTRAINT squad_feed_likes_post_id_user_id_key UNIQUE (post_id, user_id);


--
-- Name: squad_feed squad_feed_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed
    ADD CONSTRAINT squad_feed_pkey PRIMARY KEY (id);


--
-- Name: squad_games squad_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_games
    ADD CONSTRAINT squad_games_pkey PRIMARY KEY (id);


--
-- Name: squad_games squad_games_squad_id_game_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_games
    ADD CONSTRAINT squad_games_squad_id_game_id_key UNIQUE (squad_id, game_id);


--
-- Name: squad_leaderboard_snapshots squad_leaderboard_snapshots_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_leaderboard_snapshots
    ADD CONSTRAINT squad_leaderboard_snapshots_pkey PRIMARY KEY (id);


--
-- Name: squad_members squad_members_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_pkey PRIMARY KEY (id);


--
-- Name: squad_members squad_members_squad_id_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_squad_id_user_id_key UNIQUE (squad_id, user_id);


--
-- Name: squad_private_games squad_private_games_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_private_games
    ADD CONSTRAINT squad_private_games_pkey PRIMARY KEY (id);


--
-- Name: squads squads_invite_code_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squads
    ADD CONSTRAINT squads_invite_code_key UNIQUE (invite_code);


--
-- Name: squads squads_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squads
    ADD CONSTRAINT squads_pkey PRIMARY KEY (id);


--
-- Name: swipe_predictions swipe_predictions_challenge_id_user_id_fixture_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_challenge_id_user_id_fixture_id_key UNIQUE (challenge_id, user_id, fixture_id);


--
-- Name: swipe_predictions swipe_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_pkey PRIMARY KEY (id);


--
-- Name: fb_team_league_participation team_league_participation_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_team_league_participation
    ADD CONSTRAINT team_league_participation_pkey PRIMARY KEY (id);


--
-- Name: fb_team_league_participation team_league_participation_unique; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_team_league_participation
    ADD CONSTRAINT team_league_participation_unique UNIQUE (team_id, league_id, season);


--
-- Name: team_popularity team_popularity_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.team_popularity
    ADD CONSTRAINT team_popularity_pkey PRIMARY KEY (team_api_id);


--
-- Name: fb_teams teams_api_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_teams
    ADD CONSTRAINT teams_api_id_key UNIQUE (api_id);


--
-- Name: teams teams_api_id_key1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_api_id_key1 UNIQUE (api_id);


--
-- Name: fb_teams teams_api_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_teams
    ADD CONSTRAINT teams_api_team_id_key UNIQUE (api_team_id);


--
-- Name: fb_teams teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_teams
    ADD CONSTRAINT teams_pkey PRIMARY KEY (id);


--
-- Name: teams teams_pkey1; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.teams
    ADD CONSTRAINT teams_pkey1 PRIMARY KEY (id);


--
-- Name: ticket_transactions ticket_transactions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_transactions
    ADD CONSTRAINT ticket_transactions_pkey PRIMARY KEY (id);


--
-- Name: tm_club_seasons tm_club_seasons_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_club_seasons
    ADD CONSTRAINT tm_club_seasons_pkey PRIMARY KEY (league_id, season, club_id);


--
-- Name: tm_clubs tm_clubs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_clubs
    ADD CONSTRAINT tm_clubs_pkey PRIMARY KEY (club_id);


--
-- Name: tm_leagues tm_leagues_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_leagues
    ADD CONSTRAINT tm_leagues_pkey PRIMARY KEY (league_id);


--
-- Name: tm_lineups tm_lineups_match_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_lineups
    ADD CONSTRAINT tm_lineups_match_id_player_id_key UNIQUE (match_id, player_id);


--
-- Name: tm_lineups tm_lineups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_lineups
    ADD CONSTRAINT tm_lineups_pkey PRIMARY KEY (id);


--
-- Name: tm_market_values tm_market_values_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_market_values
    ADD CONSTRAINT tm_market_values_pkey PRIMARY KEY (id);


--
-- Name: tm_market_values tm_market_values_player_id_value_date_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_market_values
    ADD CONSTRAINT tm_market_values_player_id_value_date_key UNIQUE (player_id, value_date);


--
-- Name: tm_matches tm_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_matches
    ADD CONSTRAINT tm_matches_pkey PRIMARY KEY (match_id);


--
-- Name: tm_player_season_stats tm_player_season_stats_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_player_season_stats
    ADD CONSTRAINT tm_player_season_stats_pkey PRIMARY KEY (id);


--
-- Name: tm_player_season_stats tm_player_season_stats_player_id_season_club_id_league_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_player_season_stats
    ADD CONSTRAINT tm_player_season_stats_player_id_season_club_id_league_id_key UNIQUE (player_id, season, club_id, league_id);


--
-- Name: tm_players tm_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_players
    ADD CONSTRAINT tm_players_pkey PRIMARY KEY (player_id);


--
-- Name: tm_seed_runs tm_seed_runs_league_id_season_phase_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_seed_runs
    ADD CONSTRAINT tm_seed_runs_league_id_season_phase_key UNIQUE (league_id, season, phase);


--
-- Name: tm_seed_runs tm_seed_runs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_seed_runs
    ADD CONSTRAINT tm_seed_runs_pkey PRIMARY KEY (id);


--
-- Name: tm_squad_memberships tm_squad_memberships_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_squad_memberships
    ADD CONSTRAINT tm_squad_memberships_pkey PRIMARY KEY (id);


--
-- Name: tm_squad_memberships tm_squad_memberships_player_id_club_id_season_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_squad_memberships
    ADD CONSTRAINT tm_squad_memberships_player_id_club_id_season_key UNIQUE (player_id, club_id, season);


--
-- Name: tm_transfers tm_transfers_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_transfers
    ADD CONSTRAINT tm_transfers_pkey PRIMARY KEY (id);


--
-- Name: tm_transfers tm_transfers_player_id_transfer_date_to_club_id_from_club_i_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_transfers
    ADD CONSTRAINT tm_transfers_player_id_transfer_date_to_club_id_from_club_i_key UNIQUE (player_id, transfer_date, to_club_id, from_club_id);


--
-- Name: tm_trophies tm_trophies_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_trophies
    ADD CONSTRAINT tm_trophies_pkey PRIMARY KEY (id);


--
-- Name: tm_trophies tm_trophies_scope_player_id_club_id_trophy_season_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_trophies
    ADD CONSTRAINT tm_trophies_scope_player_id_club_id_trophy_season_key UNIQUE (scope, player_id, club_id, trophy, season);


--
-- Name: tq_announcements tq_announcements_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_announcements
    ADD CONSTRAINT tq_announcements_pkey PRIMARY KEY (id);


--
-- Name: tq_bracket_predictions tq_bracket_predictions_entry_id_round_key_predicted_winner__key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_bracket_predictions
    ADD CONSTRAINT tq_bracket_predictions_entry_id_round_key_predicted_winner__key UNIQUE (entry_id, round_key, predicted_winner_team_id);


--
-- Name: tq_bracket_predictions tq_bracket_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_bracket_predictions
    ADD CONSTRAINT tq_bracket_predictions_pkey PRIMARY KEY (id);


--
-- Name: tq_competitions tq_competitions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_competitions
    ADD CONSTRAINT tq_competitions_pkey PRIMARY KEY (id);


--
-- Name: tq_competitions tq_competitions_slug_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_competitions
    ADD CONSTRAINT tq_competitions_slug_key UNIQUE (slug);


--
-- Name: tq_daily_predictions tq_daily_predictions_entry_id_match_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_daily_predictions
    ADD CONSTRAINT tq_daily_predictions_entry_id_match_id_key UNIQUE (entry_id, match_id);


--
-- Name: tq_daily_predictions tq_daily_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_daily_predictions
    ADD CONSTRAINT tq_daily_predictions_pkey PRIMARY KEY (id);


--
-- Name: tq_entries tq_entries_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_entries
    ADD CONSTRAINT tq_entries_pkey PRIMARY KEY (id);


--
-- Name: tq_entries tq_entries_user_id_competition_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_entries
    ADD CONSTRAINT tq_entries_user_id_competition_id_key UNIQUE (user_id, competition_id);


--
-- Name: tq_group_predictions tq_group_predictions_entry_id_group_id_predicted_position_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_predictions
    ADD CONSTRAINT tq_group_predictions_entry_id_group_id_predicted_position_key UNIQUE (entry_id, group_id, predicted_position);


--
-- Name: tq_group_predictions tq_group_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_predictions
    ADD CONSTRAINT tq_group_predictions_pkey PRIMARY KEY (id);


--
-- Name: tq_group_teams tq_group_teams_group_id_team_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_teams
    ADD CONSTRAINT tq_group_teams_group_id_team_id_key UNIQUE (group_id, team_id);


--
-- Name: tq_group_teams tq_group_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_teams
    ADD CONSTRAINT tq_group_teams_pkey PRIMARY KEY (id);


--
-- Name: tq_groups tq_groups_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_groups
    ADD CONSTRAINT tq_groups_pkey PRIMARY KEY (id);


--
-- Name: tq_leaderboard tq_leaderboard_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_leaderboard
    ADD CONSTRAINT tq_leaderboard_pkey PRIMARY KEY (competition_id, entry_id);


--
-- Name: tq_long_term_predictions tq_long_term_predictions_entry_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_entry_id_key UNIQUE (entry_id);


--
-- Name: tq_long_term_predictions tq_long_term_predictions_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_pkey PRIMARY KEY (id);


--
-- Name: tq_masterpass_invites tq_masterpass_invites_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_pkey PRIMARY KEY (id);


--
-- Name: tq_masterpass_invites tq_masterpass_invites_token_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_token_key UNIQUE (token);


--
-- Name: tq_matches tq_matches_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_pkey PRIMARY KEY (id);


--
-- Name: tq_phase_windows tq_phase_windows_competition_id_phase_key_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_phase_windows
    ADD CONSTRAINT tq_phase_windows_competition_id_phase_key_key UNIQUE (competition_id, phase_key);


--
-- Name: tq_phase_windows tq_phase_windows_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_phase_windows
    ADD CONSTRAINT tq_phase_windows_pkey PRIMARY KEY (id);


--
-- Name: tq_players tq_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_players
    ADD CONSTRAINT tq_players_pkey PRIMARY KEY (id);


--
-- Name: tq_scoring_events tq_scoring_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_scoring_events
    ADD CONSTRAINT tq_scoring_events_pkey PRIMARY KEY (id);


--
-- Name: tq_teams tq_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_teams
    ADD CONSTRAINT tq_teams_pkey PRIMARY KEY (id);


--
-- Name: game_config unique_category_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_config
    ADD CONSTRAINT unique_category_key UNIQUE (category, key);


--
-- Name: fb_odds unique_fixture_bookmaker; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_odds
    ADD CONSTRAINT unique_fixture_bookmaker UNIQUE (fixture_id, bookmaker_name);


--
-- Name: user_activity_logs user_activity_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_pkey PRIMARY KEY (id);


--
-- Name: user_activity_logs user_activity_logs_user_id_week_start_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_week_start_key UNIQUE (user_id, week_start);


--
-- Name: user_badges user_badges_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_pkey PRIMARY KEY (id);


--
-- Name: user_fantasy_boosters user_fantasy_boosters_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_boosters
    ADD CONSTRAINT user_fantasy_boosters_pkey PRIMARY KEY (id);


--
-- Name: user_fantasy_boosters user_fantasy_boosters_user_id_challenge_id_booster_type_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_boosters
    ADD CONSTRAINT user_fantasy_boosters_user_id_challenge_id_booster_type_key UNIQUE (user_id, challenge_id, booster_type);


--
-- Name: user_fantasy_scores user_fantasy_scores_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_scores
    ADD CONSTRAINT user_fantasy_scores_pkey PRIMARY KEY (id);


--
-- Name: user_fantasy_scores user_fantasy_scores_user_id_challenge_id_game_week_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_scores
    ADD CONSTRAINT user_fantasy_scores_user_id_challenge_id_game_week_id_key UNIQUE (user_id, challenge_id, game_week_id);


--
-- Name: user_fantasy_teams user_fantasy_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_pkey PRIMARY KEY (id);


--
-- Name: user_fantasy_teams user_fantasy_teams_user_id_game_id_game_week_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_user_id_game_id_game_week_id_key UNIQUE (user_id, game_id, game_week_id);


--
-- Name: user_masterpasses user_masterpasses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_masterpasses
    ADD CONSTRAINT user_masterpasses_pkey PRIMARY KEY (id);


--
-- Name: user_onesignal_players user_onesignal_players_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onesignal_players
    ADD CONSTRAINT user_onesignal_players_pkey PRIMARY KEY (id);


--
-- Name: user_onesignal_players user_onesignal_players_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onesignal_players
    ADD CONSTRAINT user_onesignal_players_player_id_key UNIQUE (player_id);


--
-- Name: user_onesignal_players user_onesignal_players_user_id_player_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onesignal_players
    ADD CONSTRAINT user_onesignal_players_user_id_player_id_key UNIQUE (user_id, player_id);


--
-- Name: user_spin_states user_spin_states_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spin_states
    ADD CONSTRAINT user_spin_states_pkey PRIMARY KEY (user_id);


--
-- Name: user_streaks user_streaks_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_pkey PRIMARY KEY (id);


--
-- Name: user_streaks user_streaks_user_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_user_id_key UNIQUE (user_id);


--
-- Name: user_teams user_teams_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_pkey PRIMARY KEY (id);


--
-- Name: user_tickets user_tickets_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tickets
    ADD CONSTRAINT user_tickets_pkey PRIMARY KEY (id);


--
-- Name: users users_email_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_email_key UNIQUE (email);


--
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- Name: xp_events xp_events_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_events
    ADD CONSTRAINT xp_events_pkey PRIMARY KEY (id);


--
-- Name: xp_events xp_events_user_id_source_type_source_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_events
    ADD CONSTRAINT xp_events_user_id_source_type_source_id_key UNIQUE (user_id, source_type, source_id);


--
-- Name: xp_formula_config xp_formula_config_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_formula_config
    ADD CONSTRAINT xp_formula_config_pkey PRIMARY KEY (key);


--
-- Name: idx_activity_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_user_id ON public.user_activity_logs USING btree (user_id);


--
-- Name: idx_activity_logs_week_start; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_activity_logs_week_start ON public.user_activity_logs USING btree (week_start);


--
-- Name: idx_badges_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_badges_is_active ON public.badges USING btree (is_active);


--
-- Name: idx_challenge_bets_daily_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_bets_daily_entry ON public.challenge_bets USING btree (daily_entry_id);


--
-- Name: idx_challenge_bets_match_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_bets_match_status ON public.challenge_bets USING btree (challenge_match_id, status);


--
-- Name: idx_challenge_bets_odds_snapshot; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_bets_odds_snapshot ON public.challenge_bets USING gin (odds_snapshot);


--
-- Name: idx_challenge_daily_entries_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_daily_entries_entry ON public.challenge_daily_entries USING btree (challenge_entry_id);


--
-- Name: idx_challenge_entries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_entries_user ON public.challenge_entries USING btree (user_id, challenge_id);


--
-- Name: idx_challenge_matchdays_challenge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_matchdays_challenge ON public.challenge_matchdays USING btree (challenge_id);


--
-- Name: idx_challenge_matchdays_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_matchdays_date ON public.challenge_matchdays USING btree (date);


--
-- Name: idx_challenge_matchdays_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_matchdays_status ON public.challenge_matchdays USING btree (status);


--
-- Name: idx_challenge_matches_challenge_day; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_matches_challenge_day ON public.challenge_matches USING btree (challenge_id, day_number);


--
-- Name: idx_challenge_participants_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_participants_leaderboard ON public.challenge_participants USING btree (challenge_id, points DESC, created_at);


--
-- Name: idx_challenge_required_badges_badge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_required_badges_badge ON public.challenge_required_badges USING btree (badge_id);


--
-- Name: idx_challenge_required_badges_challenge; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenge_required_badges_challenge ON public.challenge_required_badges USING btree (challenge_id);


--
-- Name: idx_challenges_publish_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_challenges_publish_date ON public.challenges USING btree (publish_date) WHERE (publish_date IS NOT NULL);


--
-- Name: idx_coin_transactions_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_created ON public.coin_transactions USING btree (created_at DESC);


--
-- Name: idx_coin_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_type ON public.coin_transactions USING btree (transaction_type);


--
-- Name: idx_coin_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_coin_transactions_user_id ON public.coin_transactions USING btree (user_id);


--
-- Name: idx_fantasy_game_weeks_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_game_weeks_dates ON public.fantasy_game_weeks USING btree (start_date, end_date);


--
-- Name: idx_fantasy_game_weeks_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_game_weeks_game ON public.fantasy_game_weeks USING btree (fantasy_game_id);


--
-- Name: idx_fantasy_game_weeks_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_game_weeks_status ON public.fantasy_game_weeks USING btree (status);


--
-- Name: idx_fantasy_games_dates; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_dates ON public.fantasy_games USING btree (start_date, end_date);


--
-- Name: idx_fantasy_games_duration; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_duration ON public.fantasy_games USING btree (duration_type);


--
-- Name: idx_fantasy_games_league; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_league ON public.fantasy_games USING btree (league_id);


--
-- Name: idx_fantasy_games_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_level ON public.fantasy_games USING btree (minimum_level);


--
-- Name: idx_fantasy_games_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_status ON public.fantasy_games USING btree (status);


--
-- Name: idx_fantasy_games_subscription; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_subscription ON public.fantasy_games USING btree (requires_subscription);


--
-- Name: idx_fantasy_games_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_games_tier ON public.fantasy_games USING btree (tier);


--
-- Name: idx_fantasy_leaderboard_gw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_leaderboard_gw ON public.fantasy_leaderboard USING btree (game_week_id);


--
-- Name: idx_fantasy_leaderboard_points; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_leaderboard_points ON public.fantasy_leaderboard USING btree (game_week_id, total_points DESC);


--
-- Name: idx_fantasy_leaderboard_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_leaderboard_rank ON public.fantasy_leaderboard USING btree (game_week_id, rank);


--
-- Name: idx_fantasy_league_players_available; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_league_players_available ON public.fantasy_league_players USING btree (is_available) WHERE (is_available = true);


--
-- Name: idx_fantasy_league_players_league; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_league_players_league ON public.fantasy_league_players USING btree (league_id);


--
-- Name: idx_fantasy_league_players_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_league_players_player ON public.fantasy_league_players USING btree (player_id);


--
-- Name: idx_fantasy_league_players_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_league_players_status ON public.fantasy_league_players USING btree (status);


--
-- Name: idx_fantasy_players_fatigue; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_players_fatigue ON public.fantasy_players USING btree (fatigue) WHERE (fatigue > 0);


--
-- Name: idx_fantasy_players_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_players_position ON public.fantasy_players USING btree ("position");


--
-- Name: idx_fantasy_players_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fantasy_players_status ON public.fantasy_players USING btree (status);


--
-- Name: idx_fb_fixtures_away_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_fixtures_away_team_id ON public.fb_fixtures USING btree (away_team_id);


--
-- Name: idx_fb_fixtures_home_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_fixtures_home_team_id ON public.fb_fixtures USING btree (home_team_id);


--
-- Name: idx_fb_fixtures_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_fixtures_round ON public.fb_fixtures USING btree (round);


--
-- Name: idx_fb_fixtures_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_fixtures_season ON public.fb_fixtures USING btree (league_id, season);


--
-- Name: idx_fb_players_normalized_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_players_normalized_name ON public.fb_players USING btree (public.normalize_name(name));


--
-- Name: idx_fb_players_team_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_players_team_id ON public.fb_players USING btree (team_id);


--
-- Name: idx_fb_pss_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_pss_player ON public.fb_player_season_stats USING btree (player_id);


--
-- Name: idx_fb_pss_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_pss_season ON public.fb_player_season_stats USING btree (league_api_id, season);


--
-- Name: idx_fb_standings_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_standings_season ON public.fb_standings USING btree (league_api_id, season);


--
-- Name: idx_fb_transfers_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fb_transfers_player ON public.fb_transfers USING btree (player_id);


--
-- Name: idx_fixture_sync_log_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixture_sync_log_created_at ON public.fixture_sync_log USING btree (created_at DESC);


--
-- Name: idx_fixtures_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixtures_date ON public.fixtures USING btree (date);


--
-- Name: idx_fixtures_league; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixtures_league ON public.fixtures USING btree (league_id);


--
-- Name: idx_fixtures_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixtures_season ON public.fixtures USING btree (season);


--
-- Name: idx_fixtures_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fixtures_status ON public.fixtures USING btree (status);


--
-- Name: idx_fx_events_api; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fx_events_api ON public.fb_fixture_events USING btree (api_fixture_id);


--
-- Name: idx_fx_events_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fx_events_fixture ON public.fb_fixture_events USING btree (fixture_id);


--
-- Name: idx_fx_stats_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_fx_stats_fixture ON public.fb_fixture_statistics USING btree (fixture_id);


--
-- Name: idx_game_config_category; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_config_category ON public.game_config USING btree (category);


--
-- Name: idx_game_config_is_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_config_is_active ON public.game_config USING btree (is_active);


--
-- Name: idx_game_config_key; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_config_key ON public.game_config USING btree (key);


--
-- Name: idx_game_config_version; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_game_config_version ON public.game_config USING btree (version);


--
-- Name: idx_leagues_country; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leagues_country ON public.leagues USING btree (country_or_region);


--
-- Name: idx_leagues_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_leagues_type ON public.leagues USING btree (type);


--
-- Name: idx_lf_games_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_games_status ON public.lf_games USING btree (status);


--
-- Name: idx_lf_gp_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_gp_game ON public.lf_game_players USING btree (game_id);


--
-- Name: idx_lf_teams_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_teams_game ON public.lf_teams USING btree (game_id, score DESC);


--
-- Name: idx_lf_tp_team; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_lf_tp_team ON public.lf_team_players USING btree (team_id);


--
-- Name: idx_live_game_bets_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_game_bets_entry ON public.live_game_bets USING btree (entry_id);


--
-- Name: idx_live_game_bets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_game_bets_status ON public.live_game_bets USING btree (status);


--
-- Name: idx_live_game_entries_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_game_entries_game ON public.live_game_entries USING btree (live_game_id);


--
-- Name: idx_live_game_entries_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_game_entries_user ON public.live_game_entries USING btree (user_id);


--
-- Name: idx_live_games_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_games_fixture ON public.live_games USING btree (fixture_id);


--
-- Name: idx_live_games_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_live_games_status ON public.live_games USING btree (status);


--
-- Name: idx_match_bets_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_bets_fixture ON public.match_bets USING btree (fixture_id);


--
-- Name: idx_match_bets_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_bets_status ON public.match_bets USING btree (status);


--
-- Name: idx_match_bets_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_match_bets_user ON public.match_bets USING btree (user_id);


--
-- Name: idx_matchday_fixtures_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matchday_fixtures_fixture ON public.matchday_fixtures USING btree (fixture_id);


--
-- Name: idx_matchday_fixtures_matchday; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matchday_fixtures_matchday ON public.matchday_fixtures USING btree (matchday_id);


--
-- Name: idx_matchday_participants_leaderboard; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matchday_participants_leaderboard ON public.matchday_participants USING btree (matchday_id, points_earned DESC, created_at);


--
-- Name: idx_matchday_participants_matchday; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matchday_participants_matchday ON public.matchday_participants USING btree (matchday_id);


--
-- Name: idx_matchday_participants_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_matchday_participants_user ON public.matchday_participants USING btree (user_id);


--
-- Name: idx_mp_invites_inviter; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mp_invites_inviter ON public.tq_masterpass_invites USING btree (inviter_id, status);


--
-- Name: idx_mr_answers_q; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mr_answers_q ON public.mr_answers USING btree (question_id);


--
-- Name: idx_mr_assign_scope; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mr_assign_scope ON public.mr_pot_assignments USING btree (scope, is_active);


--
-- Name: idx_mr_participants_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mr_participants_game ON public.mr_participants USING btree (game_id, status);


--
-- Name: idx_mr_questions_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_mr_questions_game ON public.mr_questions USING btree (game_id, status);


--
-- Name: idx_notifications_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_created_at ON public.notifications USING btree (created_at DESC);


--
-- Name: idx_notifications_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_type ON public.notifications USING btree (type);


--
-- Name: idx_notifications_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_id ON public.notifications USING btree (user_id);


--
-- Name: idx_notifications_user_unread; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_notifications_user_unread ON public.notifications USING btree (user_id, is_read) WHERE (NOT is_read);


--
-- Name: idx_player_match_stats_clean_sheet; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_match_stats_clean_sheet ON public.fb_player_match_stats USING btree (clean_sheet) WHERE (clean_sheet = true);


--
-- Name: idx_player_match_stats_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_match_stats_fixture ON public.fb_player_match_stats USING btree (fixture_id);


--
-- Name: idx_player_match_stats_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_match_stats_player ON public.fb_player_match_stats USING btree (player_id);


--
-- Name: idx_player_match_stats_rating; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_match_stats_rating ON public.fb_player_match_stats USING btree (rating DESC NULLS LAST);


--
-- Name: idx_player_season_stats_league; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_season_stats_league ON public.player_season_stats USING btree (league_id);


--
-- Name: idx_player_transfers_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_transfers_date ON public.player_transfers USING btree (transfer_date DESC);


--
-- Name: idx_player_transfers_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_player_transfers_player ON public.player_transfers USING btree (player_id);


--
-- Name: idx_players_position; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_players_position ON public.players USING btree ("position");


--
-- Name: idx_puzzle_games_date; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_puzzle_games_date ON public.puzzle_games USING btree (level, puzzle_date);


--
-- Name: idx_reward_fulfillments_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_fulfillments_status ON public.reward_fulfillments USING btree (status);


--
-- Name: idx_reward_fulfillments_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_reward_fulfillments_user ON public.reward_fulfillments USING btree (user_id);


--
-- Name: idx_season_logs_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_season_logs_season_id ON public.season_logs USING btree (season_id);


--
-- Name: idx_season_logs_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_season_logs_user_id ON public.season_logs USING btree (user_id);


--
-- Name: idx_spin_history_created; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spin_history_created ON public.spin_history USING btree (created_at DESC);


--
-- Name: idx_spin_history_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spin_history_tier ON public.spin_history USING btree (tier);


--
-- Name: idx_spin_history_user_time; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spin_history_user_time ON public.spin_history USING btree (user_id, created_at DESC);


--
-- Name: idx_spin_segments_tier; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_spin_segments_tier ON public.spin_segments USING btree (tier, sort_order);


--
-- Name: idx_squad_feed_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_feed_created_at ON public.squad_feed USING btree (squad_id, created_at DESC);


--
-- Name: idx_squad_feed_likes_post_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_feed_likes_post_id ON public.squad_feed_likes USING btree (post_id);


--
-- Name: idx_squad_feed_likes_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_feed_likes_user_id ON public.squad_feed_likes USING btree (user_id);


--
-- Name: idx_squad_feed_squad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_feed_squad_id ON public.squad_feed USING btree (squad_id);


--
-- Name: idx_squad_feed_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_feed_user_id ON public.squad_feed USING btree (user_id);


--
-- Name: idx_squad_games_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_games_game_id ON public.squad_games USING btree (game_id);


--
-- Name: idx_squad_games_linked_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_games_linked_at ON public.squad_games USING btree (squad_id, linked_at DESC);


--
-- Name: idx_squad_games_squad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_games_squad_id ON public.squad_games USING btree (squad_id);


--
-- Name: idx_squad_members_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_members_role ON public.squad_members USING btree (squad_id, role);


--
-- Name: idx_squad_members_squad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_members_squad_id ON public.squad_members USING btree (squad_id);


--
-- Name: idx_squad_members_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_members_user_id ON public.squad_members USING btree (user_id);


--
-- Name: idx_squad_private_games_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_private_games_created_at ON public.squad_private_games USING btree (created_at DESC);


--
-- Name: idx_squad_private_games_squad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_private_games_squad_id ON public.squad_private_games USING btree (squad_id);


--
-- Name: idx_squad_private_games_status; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_private_games_status ON public.squad_private_games USING btree (status);


--
-- Name: idx_squad_snapshots_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_snapshots_created_at ON public.squad_leaderboard_snapshots USING btree (squad_id, created_at DESC);


--
-- Name: idx_squad_snapshots_game_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_snapshots_game_id ON public.squad_leaderboard_snapshots USING btree (game_id);


--
-- Name: idx_squad_snapshots_squad_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squad_snapshots_squad_id ON public.squad_leaderboard_snapshots USING btree (squad_id);


--
-- Name: idx_squads_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squads_created_at ON public.squads USING btree (created_at DESC);


--
-- Name: idx_squads_created_by; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_squads_created_by ON public.squads USING btree (created_by);


--
-- Name: idx_swipe_predictions_challenge_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swipe_predictions_challenge_user ON public.swipe_predictions USING btree (challenge_id, user_id);


--
-- Name: idx_swipe_predictions_fixture; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swipe_predictions_fixture ON public.swipe_predictions USING btree (fixture_id);


--
-- Name: idx_swipe_predictions_matchday; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swipe_predictions_matchday ON public.swipe_predictions USING btree (matchday_id);


--
-- Name: idx_swipe_predictions_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_swipe_predictions_user ON public.swipe_predictions USING btree (user_id);


--
-- Name: idx_ticket_transactions_created_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_transactions_created_at ON public.ticket_transactions USING btree (created_at);


--
-- Name: idx_ticket_transactions_ticket_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_transactions_ticket_id ON public.ticket_transactions USING btree (ticket_id);


--
-- Name: idx_ticket_transactions_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_transactions_type ON public.ticket_transactions USING btree (transaction_type);


--
-- Name: idx_ticket_transactions_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_ticket_transactions_user_id ON public.ticket_transactions USING btree (user_id);


--
-- Name: idx_tm_club_seasons_club; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_club_seasons_club ON public.tm_club_seasons USING btree (club_id);


--
-- Name: idx_tm_lineups_match; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_lineups_match ON public.tm_lineups USING btree (match_id);


--
-- Name: idx_tm_lineups_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_lineups_player ON public.tm_lineups USING btree (player_id);


--
-- Name: idx_tm_matches_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_matches_season ON public.tm_matches USING btree (league_id, season);


--
-- Name: idx_tm_mv_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_mv_player ON public.tm_market_values USING btree (player_id);


--
-- Name: idx_tm_players_name; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_players_name ON public.tm_players USING btree (name);


--
-- Name: idx_tm_pss_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_pss_player ON public.tm_player_season_stats USING btree (player_id);


--
-- Name: idx_tm_pss_season; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_pss_season ON public.tm_player_season_stats USING btree (league_id, season);


--
-- Name: idx_tm_squad_club; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_squad_club ON public.tm_squad_memberships USING btree (club_id, season);


--
-- Name: idx_tm_squad_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_squad_player ON public.tm_squad_memberships USING btree (player_id);


--
-- Name: idx_tm_transfers_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_transfers_player ON public.tm_transfers USING btree (player_id, seq);


--
-- Name: idx_tm_trophies_club; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_trophies_club ON public.tm_trophies USING btree (club_id);


--
-- Name: idx_tm_trophies_player; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tm_trophies_player ON public.tm_trophies USING btree (player_id);


--
-- Name: idx_tq_announcements_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_announcements_comp ON public.tq_announcements USING btree (competition_id);


--
-- Name: idx_tq_brk_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_brk_entry ON public.tq_bracket_predictions USING btree (entry_id);


--
-- Name: idx_tq_daily_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_daily_entry ON public.tq_daily_predictions USING btree (entry_id);


--
-- Name: idx_tq_entries_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_entries_comp ON public.tq_entries USING btree (competition_id);


--
-- Name: idx_tq_group_teams_g; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_group_teams_g ON public.tq_group_teams USING btree (group_id);


--
-- Name: idx_tq_groups_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_groups_comp ON public.tq_groups USING btree (competition_id);


--
-- Name: idx_tq_grp_pred_entry; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_grp_pred_entry ON public.tq_group_predictions USING btree (entry_id);


--
-- Name: idx_tq_lb_rank; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_lb_rank ON public.tq_leaderboard USING btree (competition_id, total_score DESC);


--
-- Name: idx_tq_matches_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_matches_comp ON public.tq_matches USING btree (competition_id);


--
-- Name: idx_tq_matches_quest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_matches_quest ON public.tq_matches USING btree (competition_id, is_official_quest_match);


--
-- Name: idx_tq_matches_round; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_matches_round ON public.tq_matches USING btree (competition_id, knockout_round);


--
-- Name: idx_tq_players_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_players_comp ON public.tq_players USING btree (competition_id);


--
-- Name: idx_tq_teams_comp; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_tq_teams_comp ON public.tq_teams USING btree (competition_id);


--
-- Name: idx_user_badges_season_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_badges_season_id ON public.user_badges USING btree (season_id);


--
-- Name: idx_user_daily_hpi_unique; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX idx_user_daily_hpi_unique ON public.user_daily_hpi USING btree (user_id, prediction_date);


--
-- Name: idx_user_fantasy_teams_booster_target; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fantasy_teams_booster_target ON public.user_fantasy_teams USING btree (booster_target_id);


--
-- Name: idx_user_fantasy_teams_game; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fantasy_teams_game ON public.user_fantasy_teams USING btree (game_id);


--
-- Name: idx_user_fantasy_teams_gw; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fantasy_teams_gw ON public.user_fantasy_teams USING btree (game_week_id);


--
-- Name: idx_user_fantasy_teams_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_fantasy_teams_user ON public.user_fantasy_teams USING btree (user_id);


--
-- Name: idx_user_masterpasses_owner; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_masterpasses_owner ON public.user_masterpasses USING btree (user_id, status, tier);


--
-- Name: idx_user_onesignal_players_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onesignal_players_active ON public.user_onesignal_players USING btree (user_id, is_active) WHERE (is_active = true);


--
-- Name: idx_user_onesignal_players_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_onesignal_players_user_id ON public.user_onesignal_players USING btree (user_id);


--
-- Name: idx_user_tickets_expires_at; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tickets_expires_at ON public.user_tickets USING btree (expires_at);


--
-- Name: idx_user_tickets_is_used; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tickets_is_used ON public.user_tickets USING btree (is_used);


--
-- Name: idx_user_tickets_ticket_type; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tickets_ticket_type ON public.user_tickets USING btree (ticket_type);


--
-- Name: idx_user_tickets_user_id; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tickets_user_id ON public.user_tickets USING btree (user_id);


--
-- Name: idx_user_tickets_user_type_active; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_user_tickets_user_type_active ON public.user_tickets USING btree (user_id, ticket_type, is_used, expires_at);


--
-- Name: idx_users_current_level; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_current_level ON public.users USING btree (current_level);


--
-- Name: idx_users_role; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_role ON public.users USING btree (role);


--
-- Name: idx_users_timezone; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_timezone ON public.users USING btree (timezone);


--
-- Name: idx_users_xp_total; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_users_xp_total ON public.users USING btree (xp_total);


--
-- Name: idx_xp_events_user; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_xp_events_user ON public.xp_events USING btree (user_id, created_at DESC);


--
-- Name: leagues_api_league_id_uidx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX leagues_api_league_id_uidx ON public.fb_leagues USING btree (api_league_id);


--
-- Name: player_team_association_player_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_team_association_player_id_idx ON public.fb_player_team_association USING btree (player_id);


--
-- Name: player_team_association_team_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX player_team_association_team_id_idx ON public.fb_player_team_association USING btree (team_id);


--
-- Name: team_league_participation_league_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_league_participation_league_id_idx ON public.fb_team_league_participation USING btree (league_id);


--
-- Name: team_league_participation_team_id_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX team_league_participation_team_id_idx ON public.fb_team_league_participation USING btree (team_id);


--
-- Name: user_badges auto_award_badge_xp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_award_badge_xp AFTER INSERT ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.trigger_award_badge_xp();


--
-- Name: user_badges auto_track_badge_earned; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER auto_track_badge_earned AFTER INSERT ON public.user_badges FOR EACH ROW EXECUTE FUNCTION public.trigger_track_badge_earned();


--
-- Name: game_weeks handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.game_weeks FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: user_teams handle_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at BEFORE UPDATE ON public.user_teams FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: boosters handle_updated_at_boosters; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_boosters BEFORE UPDATE ON public.boosters FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: game_weeks handle_updated_at_game_weeks; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_game_weeks BEFORE UPDATE ON public.game_weeks FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: scores handle_updated_at_scores; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_scores BEFORE UPDATE ON public.scores FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: user_fantasy_boosters handle_updated_at_user_fantasy_boosters; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_user_fantasy_boosters BEFORE UPDATE ON public.user_fantasy_boosters FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: user_fantasy_scores handle_updated_at_user_fantasy_scores; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_user_fantasy_scores BEFORE UPDATE ON public.user_fantasy_scores FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: user_teams handle_updated_at_user_teams; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER handle_updated_at_user_teams BEFORE UPDATE ON public.user_teams FOR EACH ROW EXECUTE FUNCTION extensions.moddatetime('updated_at');


--
-- Name: live_game_tier_limits live_game_tier_limits_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_game_tier_limits_updated_at BEFORE UPDATE ON public.live_game_tier_limits FOR EACH ROW EXECUTE FUNCTION public.update_live_game_tier_limits_updated_at();


--
-- Name: live_games live_games_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER live_games_updated_at BEFORE UPDATE ON public.live_games FOR EACH ROW EXECUTE FUNCTION public.update_live_games_updated_at();


--
-- Name: challenges on_challenge_finalized_distribute_prizes; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_challenge_finalized_distribute_prizes AFTER UPDATE ON public.challenges FOR EACH ROW EXECUTE FUNCTION public.trigger_distribute_prizes_on_finalize();


--
-- Name: challenge_participants on_challenge_participants_update; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_challenge_participants_update BEFORE UPDATE ON public.challenge_participants FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


--
-- Name: fb_leagues on_league_created; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_league_created AFTER INSERT ON public.fb_leagues FOR EACH ROW EXECUTE FUNCTION public.handle_new_league();


--
-- Name: matches on_match_finished_recalculate_points; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_match_finished_recalculate_points AFTER UPDATE ON public.matches FOR EACH ROW EXECUTE FUNCTION public.trigger_recalculate_challenge_points();


--
-- Name: squads on_squad_created_add_admin; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_squad_created_add_admin AFTER INSERT ON public.squads FOR EACH ROW EXECUTE FUNCTION public.auto_add_squad_creator_as_admin();


--
-- Name: users on_user_created_create_notification_prefs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER on_user_created_create_notification_prefs AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.create_default_notification_preferences();


--
-- Name: fb_fixtures trg_auto_link_fixture_to_matchdays; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_auto_link_fixture_to_matchdays AFTER INSERT OR UPDATE ON public.fb_fixtures FOR EACH ROW EXECUTE FUNCTION public.auto_link_fixture_to_matchdays();


--
-- Name: users trg_sync_user_role_flags; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_sync_user_role_flags BEFORE INSERT OR UPDATE ON public.users FOR EACH ROW EXECUTE FUNCTION public.sync_user_role_flags();


--
-- Name: badges trg_version_badges; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_badges AFTER INSERT OR DELETE OR UPDATE ON public.badges FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('badges');


--
-- Name: levels_config trg_version_levels; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_levels AFTER INSERT OR DELETE OR UPDATE ON public.levels_config FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('levels_config');


--
-- Name: reward_packs trg_version_reward_packs; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_reward_packs AFTER INSERT OR DELETE OR UPDATE ON public.reward_packs FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('reward_packs');


--
-- Name: spin_segments trg_version_spin_segments; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_spin_segments AFTER INSERT OR DELETE OR UPDATE ON public.spin_segments FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('spin_segments');


--
-- Name: xp_formula_config trg_version_xp; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_version_xp AFTER INSERT OR DELETE OR UPDATE ON public.xp_formula_config FOR EACH STATEMENT EXECUTE FUNCTION public.bump_content_version('xp_formula_config');


--
-- Name: live_game_entries trg_xp_live_settled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_live_settled AFTER UPDATE ON public.live_game_entries FOR EACH ROW EXECUTE FUNCTION public.xp_on_live_settled();


--
-- Name: match_bets trg_xp_match_bet_settled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_match_bet_settled AFTER UPDATE ON public.match_bets FOR EACH ROW EXECUTE FUNCTION public.xp_on_match_bet_settled();


--
-- Name: swipe_predictions trg_xp_swipe_settled; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_xp_swipe_settled AFTER UPDATE ON public.swipe_predictions FOR EACH ROW EXECUTE FUNCTION public.xp_on_swipe_settled();


--
-- Name: game_config trigger_game_config_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_game_config_updated_at BEFORE UPDATE ON public.game_config FOR EACH ROW EXECUTE FUNCTION public.update_game_config_updated_at();


--
-- Name: users trigger_initialize_spin_state; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_initialize_spin_state AFTER INSERT ON public.users FOR EACH ROW EXECUTE FUNCTION public.initialize_spin_state();


--
-- Name: fb_odds trigger_sync_fb_odds_to_odds; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_sync_fb_odds_to_odds AFTER INSERT OR UPDATE ON public.fb_odds FOR EACH ROW EXECUTE FUNCTION public.sync_fb_odds_to_odds();


--
-- Name: TRIGGER trigger_sync_fb_odds_to_odds ON fb_odds; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON TRIGGER trigger_sync_fb_odds_to_odds ON public.fb_odds IS 'Trigger automatique pour synchroniser fb_odds → odds';


--
-- Name: player_season_stats trigger_update_player_season_stats; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_player_season_stats BEFORE INSERT OR UPDATE ON public.player_season_stats FOR EACH ROW EXECUTE FUNCTION public.update_player_season_stats();


--
-- Name: swipe_predictions trigger_update_stats_on_prediction; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trigger_update_stats_on_prediction AFTER INSERT OR UPDATE ON public.swipe_predictions FOR EACH ROW EXECUTE FUNCTION public.on_swipe_prediction_change();


--
-- Name: fantasy_league_players update_fantasy_league_players_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_fantasy_league_players_updated_at BEFORE UPDATE ON public.fantasy_league_players FOR EACH ROW EXECUTE FUNCTION public.update_fantasy_league_players_updated_at();


--
-- Name: user_tickets update_user_tickets_updated_at; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER update_user_tickets_updated_at BEFORE UPDATE ON public.user_tickets FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


--
-- Name: app_config app_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.app_config
    ADD CONSTRAINT app_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: boosters boosters_used_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosters
    ADD CONSTRAINT boosters_used_by_fkey FOREIGN KEY (used_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: boosters boosters_used_on_week_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.boosters
    ADD CONSTRAINT boosters_used_on_week_fkey FOREIGN KEY (used_on_week) REFERENCES public.game_weeks(id) ON DELETE CASCADE;


--
-- Name: challenge_bets challenge_bets_daily_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_bets
    ADD CONSTRAINT challenge_bets_daily_entry_id_fkey FOREIGN KEY (daily_entry_id) REFERENCES public.challenge_daily_entries(id) ON DELETE CASCADE;


--
-- Name: challenge_configs challenge_configs_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_configs
    ADD CONSTRAINT challenge_configs_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_daily_entries challenge_daily_entries_challenge_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_daily_entries
    ADD CONSTRAINT challenge_daily_entries_challenge_entry_id_fkey FOREIGN KEY (challenge_entry_id) REFERENCES public.challenge_entries(id) ON DELETE CASCADE;


--
-- Name: challenge_entries challenge_entries_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_entries challenge_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_entries
    ADD CONSTRAINT challenge_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: challenge_leagues challenge_leagues_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_leagues
    ADD CONSTRAINT challenge_leagues_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_leagues challenge_leagues_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_leagues
    ADD CONSTRAINT challenge_leagues_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fb_leagues(id) ON DELETE CASCADE;


--
-- Name: challenge_matchdays challenge_matchdays_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matchdays
    ADD CONSTRAINT challenge_matchdays_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_matches challenge_matches_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matches
    ADD CONSTRAINT challenge_matches_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenge_matches challenge_matches_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_matches
    ADD CONSTRAINT challenge_matches_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.matches(id) ON DELETE CASCADE;


--
-- Name: challenge_participants challenge_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_participants
    ADD CONSTRAINT challenge_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: challenge_required_badges challenge_required_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_required_badges
    ADD CONSTRAINT challenge_required_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: challenge_required_badges challenge_required_badges_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenge_required_badges
    ADD CONSTRAINT challenge_required_badges_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: challenges challenges_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.challenges
    ADD CONSTRAINT challenges_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fb_leagues(id) ON DELETE SET NULL;


--
-- Name: coin_transactions coin_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.coin_transactions
    ADD CONSTRAINT coin_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fantasy_game_weeks fantasy_game_weeks_fantasy_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_game_weeks
    ADD CONSTRAINT fantasy_game_weeks_fantasy_game_id_fkey FOREIGN KEY (fantasy_game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE;


--
-- Name: fantasy_games fantasy_games_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_games
    ADD CONSTRAINT fantasy_games_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE SET NULL;


--
-- Name: fantasy_leaderboard fantasy_leaderboard_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_leaderboard
    ADD CONSTRAINT fantasy_leaderboard_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE;


--
-- Name: fantasy_leaderboard fantasy_leaderboard_game_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_leaderboard
    ADD CONSTRAINT fantasy_leaderboard_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.fantasy_game_weeks(id) ON DELETE CASCADE;


--
-- Name: fantasy_leaderboard fantasy_leaderboard_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_leaderboard
    ADD CONSTRAINT fantasy_leaderboard_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fantasy_league_players fantasy_league_players_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_league_players
    ADD CONSTRAINT fantasy_league_players_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: fantasy_league_players fantasy_league_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fantasy_league_players
    ADD CONSTRAINT fantasy_league_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: fb_fixture_events fb_fixture_events_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_events
    ADD CONSTRAINT fb_fixture_events_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: fb_fixture_statistics fb_fixture_statistics_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_statistics
    ADD CONSTRAINT fb_fixture_statistics_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: fb_fixture_stats fb_fixture_stats_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixture_stats
    ADD CONSTRAINT fb_fixture_stats_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: fb_fixtures fb_fixtures_away_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixtures
    ADD CONSTRAINT fb_fixtures_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.fb_teams(id) ON DELETE CASCADE;


--
-- Name: fb_fixtures fb_fixtures_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixtures
    ADD CONSTRAINT fb_fixtures_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.fb_teams(id) ON DELETE CASCADE;


--
-- Name: fb_fixtures fb_fixtures_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_fixtures
    ADD CONSTRAINT fb_fixtures_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fb_leagues(id) ON DELETE CASCADE;


--
-- Name: game_config game_config_updated_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.game_config
    ADD CONSTRAINT game_config_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES auth.users(id);


--
-- Name: league_games league_games_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_games
    ADD CONSTRAINT league_games_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: league_games league_games_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_games
    ADD CONSTRAINT league_games_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: league_games league_games_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_games
    ADD CONSTRAINT league_games_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fb_leagues(id) ON DELETE CASCADE;


--
-- Name: league_members league_members_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.fb_leagues(id) ON DELETE CASCADE;


--
-- Name: league_members league_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.league_members
    ADD CONSTRAINT league_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: fb_leagues leagues_country_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_country_id_fkey FOREIGN KEY (country_id) REFERENCES public.countries(id) ON DELETE SET NULL;


--
-- Name: fb_leagues leagues_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_leagues
    ADD CONSTRAINT leagues_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: leagues leagues_created_by_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.leagues
    ADD CONSTRAINT leagues_created_by_fkey1 FOREIGN KEY (created_by) REFERENCES public.users(id);


--
-- Name: lf_game_players lf_game_players_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_game_players
    ADD CONSTRAINT lf_game_players_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.lf_games(id) ON DELETE CASCADE;


--
-- Name: lf_game_players lf_game_players_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_game_players
    ADD CONSTRAINT lf_game_players_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: lf_games lf_games_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_games
    ADD CONSTRAINT lf_games_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: lf_team_players lf_team_players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_team_players
    ADD CONSTRAINT lf_team_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.lf_teams(id) ON DELETE CASCADE;


--
-- Name: lf_teams lf_teams_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.lf_teams
    ADD CONSTRAINT lf_teams_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.lf_games(id) ON DELETE CASCADE;


--
-- Name: live_game_bets live_game_bets_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_bets
    ADD CONSTRAINT live_game_bets_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.live_game_entries(id) ON DELETE CASCADE;


--
-- Name: live_game_entries live_game_entries_live_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_entries
    ADD CONSTRAINT live_game_entries_live_game_id_fkey FOREIGN KEY (live_game_id) REFERENCES public.live_games(id) ON DELETE CASCADE;


--
-- Name: live_game_entries live_game_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_game_entries
    ADD CONSTRAINT live_game_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: live_games live_games_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_games
    ADD CONSTRAINT live_games_created_by_fkey FOREIGN KEY (created_by) REFERENCES auth.users(id);


--
-- Name: live_games live_games_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.live_games
    ADD CONSTRAINT live_games_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: match_bets match_bets_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_bets
    ADD CONSTRAINT match_bets_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: match_bets match_bets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.match_bets
    ADD CONSTRAINT match_bets_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: matchday_fixtures matchday_fixtures_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_fixtures
    ADD CONSTRAINT matchday_fixtures_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: matchday_fixtures matchday_fixtures_matchday_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_fixtures
    ADD CONSTRAINT matchday_fixtures_matchday_id_fkey FOREIGN KEY (matchday_id) REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE;


--
-- Name: matchday_participants matchday_participants_matchday_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_participants
    ADD CONSTRAINT matchday_participants_matchday_id_fkey FOREIGN KEY (matchday_id) REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE;


--
-- Name: matchday_participants matchday_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matchday_participants
    ADD CONSTRAINT matchday_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: matches matches_away_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_away_team_id_fkey FOREIGN KEY (away_team_id) REFERENCES public.fb_teams(id) ON DELETE SET NULL;


--
-- Name: matches matches_home_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.matches
    ADD CONSTRAINT matches_home_team_id_fkey FOREIGN KEY (home_team_id) REFERENCES public.fb_teams(id) ON DELETE SET NULL;


--
-- Name: mr_answers mr_answers_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_answers
    ADD CONSTRAINT mr_answers_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.mr_games(id) ON DELETE CASCADE;


--
-- Name: mr_answers mr_answers_question_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_answers
    ADD CONSTRAINT mr_answers_question_id_fkey FOREIGN KEY (question_id) REFERENCES public.mr_questions(id) ON DELETE CASCADE;


--
-- Name: mr_answers mr_answers_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_answers
    ADD CONSTRAINT mr_answers_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mr_games mr_games_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_games
    ADD CONSTRAINT mr_games_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE SET NULL;


--
-- Name: mr_participants mr_participants_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_participants
    ADD CONSTRAINT mr_participants_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.mr_games(id) ON DELETE CASCADE;


--
-- Name: mr_participants mr_participants_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_participants
    ADD CONSTRAINT mr_participants_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: mr_pot_assignments mr_pot_assignments_pot_profile_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_pot_assignments
    ADD CONSTRAINT mr_pot_assignments_pot_profile_id_fkey FOREIGN KEY (pot_profile_id) REFERENCES public.mr_pot_profiles(id) ON DELETE CASCADE;


--
-- Name: mr_questions mr_questions_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.mr_questions
    ADD CONSTRAINT mr_questions_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.mr_games(id) ON DELETE CASCADE;


--
-- Name: notification_preferences notification_preferences_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notification_preferences
    ADD CONSTRAINT notification_preferences_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: notifications notifications_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.notifications
    ADD CONSTRAINT notifications_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fb_odds odds_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_odds
    ADD CONSTRAINT odds_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: odds odds_fixture_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.odds
    ADD CONSTRAINT odds_fixture_id_fkey1 FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;


--
-- Name: fb_player_match_stats player_match_stats_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_match_stats
    ADD CONSTRAINT player_match_stats_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: player_match_stats player_match_stats_fixture_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_stats
    ADD CONSTRAINT player_match_stats_fixture_id_fkey1 FOREIGN KEY (fixture_id) REFERENCES public.fixtures(id) ON DELETE CASCADE;


--
-- Name: fb_player_match_stats player_match_stats_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_match_stats
    ADD CONSTRAINT player_match_stats_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.fb_players(id) ON DELETE CASCADE;


--
-- Name: player_match_stats player_match_stats_player_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_stats
    ADD CONSTRAINT player_match_stats_player_id_fkey1 FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: fb_player_match_stats player_match_stats_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_match_stats
    ADD CONSTRAINT player_match_stats_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.fb_teams(id) ON DELETE CASCADE;


--
-- Name: player_match_stats player_match_stats_team_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_match_stats
    ADD CONSTRAINT player_match_stats_team_id_fkey1 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: player_season_stats player_season_stats_league_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_stats
    ADD CONSTRAINT player_season_stats_league_id_fkey1 FOREIGN KEY (league_id) REFERENCES public.leagues(id) ON DELETE CASCADE;


--
-- Name: player_season_stats player_season_stats_player_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_stats
    ADD CONSTRAINT player_season_stats_player_id_fkey1 FOREIGN KEY (player_id) REFERENCES public.players(id) ON DELETE CASCADE;


--
-- Name: player_season_stats player_season_stats_team_id_fkey1; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_season_stats
    ADD CONSTRAINT player_season_stats_team_id_fkey1 FOREIGN KEY (team_id) REFERENCES public.teams(id) ON DELETE CASCADE;


--
-- Name: fb_player_team_association player_team_association_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_team_association
    ADD CONSTRAINT player_team_association_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.fb_players(id) ON DELETE CASCADE;


--
-- Name: fb_player_team_association player_team_association_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_player_team_association
    ADD CONSTRAINT player_team_association_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.fb_teams(id) ON DELETE CASCADE;


--
-- Name: player_transfers player_transfers_from_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_transfers
    ADD CONSTRAINT player_transfers_from_team_id_fkey FOREIGN KEY (from_team_id) REFERENCES public.fb_teams(id) ON DELETE SET NULL;


--
-- Name: player_transfers player_transfers_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_transfers
    ADD CONSTRAINT player_transfers_player_id_fkey FOREIGN KEY (player_id) REFERENCES public.fb_players(id) ON DELETE CASCADE;


--
-- Name: player_transfers player_transfers_to_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.player_transfers
    ADD CONSTRAINT player_transfers_to_team_id_fkey FOREIGN KEY (to_team_id) REFERENCES public.fb_teams(id) ON DELETE SET NULL;


--
-- Name: fb_players players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_players
    ADD CONSTRAINT players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.fb_teams(id) ON DELETE SET NULL;


--
-- Name: premium_daily_claims premium_daily_claims_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.premium_daily_claims
    ADD CONSTRAINT premium_daily_claims_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: profiles profiles_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.profiles
    ADD CONSTRAINT profiles_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: puzzle_plays puzzle_plays_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_plays
    ADD CONSTRAINT puzzle_plays_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.puzzle_games(id) ON DELETE CASCADE;


--
-- Name: puzzle_plays puzzle_plays_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_plays
    ADD CONSTRAINT puzzle_plays_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: puzzle_progress puzzle_progress_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_progress
    ADD CONSTRAINT puzzle_progress_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: puzzle_round_attempts puzzle_round_attempts_play_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_round_attempts
    ADD CONSTRAINT puzzle_round_attempts_play_id_fkey FOREIGN KEY (play_id) REFERENCES public.puzzle_plays(id) ON DELETE CASCADE;


--
-- Name: puzzle_rounds puzzle_rounds_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_rounds
    ADD CONSTRAINT puzzle_rounds_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.puzzle_games(id) ON DELETE CASCADE;


--
-- Name: puzzle_user_prefs puzzle_user_prefs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.puzzle_user_prefs
    ADD CONSTRAINT puzzle_user_prefs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: scores scores_game_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE;


--
-- Name: scores scores_user_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.scores
    ADD CONSTRAINT scores_user_team_id_fkey FOREIGN KEY (user_team_id) REFERENCES public.user_teams(id) ON DELETE CASCADE;


--
-- Name: season_logs season_logs_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_logs
    ADD CONSTRAINT season_logs_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE CASCADE;


--
-- Name: season_logs season_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.season_logs
    ADD CONSTRAINT season_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: spin_history spin_history_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.spin_history
    ADD CONSTRAINT spin_history_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_blocks squad_blocks_blocked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_blocks
    ADD CONSTRAINT squad_blocks_blocked_by_fkey FOREIGN KEY (blocked_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: squad_blocks squad_blocks_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_blocks
    ADD CONSTRAINT squad_blocks_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_blocks squad_blocks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_blocks
    ADD CONSTRAINT squad_blocks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_feed_likes squad_feed_likes_post_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed_likes
    ADD CONSTRAINT squad_feed_likes_post_id_fkey FOREIGN KEY (post_id) REFERENCES public.squad_feed(id) ON DELETE CASCADE;


--
-- Name: squad_feed_likes squad_feed_likes_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed_likes
    ADD CONSTRAINT squad_feed_likes_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_feed squad_feed_related_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed
    ADD CONSTRAINT squad_feed_related_game_id_fkey FOREIGN KEY (related_game_id) REFERENCES public.challenges(id) ON DELETE SET NULL;


--
-- Name: squad_feed squad_feed_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed
    ADD CONSTRAINT squad_feed_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_feed squad_feed_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_feed
    ADD CONSTRAINT squad_feed_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_games squad_games_linked_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_games
    ADD CONSTRAINT squad_games_linked_by_fkey FOREIGN KEY (linked_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_games squad_games_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_games
    ADD CONSTRAINT squad_games_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_leaderboard_snapshots squad_leaderboard_snapshots_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_leaderboard_snapshots
    ADD CONSTRAINT squad_leaderboard_snapshots_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: squad_leaderboard_snapshots squad_leaderboard_snapshots_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_leaderboard_snapshots
    ADD CONSTRAINT squad_leaderboard_snapshots_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_members squad_members_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squad_members squad_members_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_members
    ADD CONSTRAINT squad_members_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_private_games squad_private_games_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_private_games
    ADD CONSTRAINT squad_private_games_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: squad_private_games squad_private_games_squad_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squad_private_games
    ADD CONSTRAINT squad_private_games_squad_id_fkey FOREIGN KEY (squad_id) REFERENCES public.squads(id) ON DELETE CASCADE;


--
-- Name: squads squads_created_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.squads
    ADD CONSTRAINT squads_created_by_fkey FOREIGN KEY (created_by) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: swipe_predictions swipe_predictions_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: swipe_predictions swipe_predictions_fixture_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_fixture_id_fkey FOREIGN KEY (fixture_id) REFERENCES public.fb_fixtures(id) ON DELETE CASCADE;


--
-- Name: swipe_predictions swipe_predictions_matchday_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_matchday_id_fkey FOREIGN KEY (matchday_id) REFERENCES public.challenge_matchdays(id) ON DELETE CASCADE;


--
-- Name: swipe_predictions swipe_predictions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.swipe_predictions
    ADD CONSTRAINT swipe_predictions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: fb_team_league_participation team_league_participation_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.fb_team_league_participation
    ADD CONSTRAINT team_league_participation_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.fb_teams(id) ON DELETE CASCADE;


--
-- Name: ticket_transactions ticket_transactions_ticket_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_transactions
    ADD CONSTRAINT ticket_transactions_ticket_id_fkey FOREIGN KEY (ticket_id) REFERENCES public.user_tickets(id) ON DELETE SET NULL;


--
-- Name: ticket_transactions ticket_transactions_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.ticket_transactions
    ADD CONSTRAINT ticket_transactions_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tm_club_seasons tm_club_seasons_league_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tm_club_seasons
    ADD CONSTRAINT tm_club_seasons_league_id_fkey FOREIGN KEY (league_id) REFERENCES public.tm_leagues(league_id) ON DELETE CASCADE;


--
-- Name: tq_announcements tq_announcements_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_announcements
    ADD CONSTRAINT tq_announcements_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_bracket_predictions tq_bracket_predictions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_bracket_predictions
    ADD CONSTRAINT tq_bracket_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_bracket_predictions tq_bracket_predictions_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_bracket_predictions
    ADD CONSTRAINT tq_bracket_predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tq_matches(id) ON DELETE SET NULL;


--
-- Name: tq_bracket_predictions tq_bracket_predictions_predicted_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_bracket_predictions
    ADD CONSTRAINT tq_bracket_predictions_predicted_winner_team_id_fkey FOREIGN KEY (predicted_winner_team_id) REFERENCES public.tq_teams(id) ON DELETE CASCADE;


--
-- Name: tq_daily_predictions tq_daily_predictions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_daily_predictions
    ADD CONSTRAINT tq_daily_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_daily_predictions tq_daily_predictions_match_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_daily_predictions
    ADD CONSTRAINT tq_daily_predictions_match_id_fkey FOREIGN KEY (match_id) REFERENCES public.tq_matches(id) ON DELETE CASCADE;


--
-- Name: tq_daily_predictions tq_daily_predictions_predicted_first_scorer_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_daily_predictions
    ADD CONSTRAINT tq_daily_predictions_predicted_first_scorer_team_id_fkey FOREIGN KEY (predicted_first_scorer_team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_entries tq_entries_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_entries
    ADD CONSTRAINT tq_entries_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_entries tq_entries_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_entries
    ADD CONSTRAINT tq_entries_user_id_fkey FOREIGN KEY (user_id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: tq_group_predictions tq_group_predictions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_predictions
    ADD CONSTRAINT tq_group_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_group_predictions tq_group_predictions_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_predictions
    ADD CONSTRAINT tq_group_predictions_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tq_groups(id) ON DELETE CASCADE;


--
-- Name: tq_group_predictions tq_group_predictions_predicted_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_predictions
    ADD CONSTRAINT tq_group_predictions_predicted_team_id_fkey FOREIGN KEY (predicted_team_id) REFERENCES public.tq_teams(id) ON DELETE CASCADE;


--
-- Name: tq_group_teams tq_group_teams_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_teams
    ADD CONSTRAINT tq_group_teams_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tq_groups(id) ON DELETE CASCADE;


--
-- Name: tq_group_teams tq_group_teams_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_group_teams
    ADD CONSTRAINT tq_group_teams_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tq_teams(id) ON DELETE CASCADE;


--
-- Name: tq_groups tq_groups_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_groups
    ADD CONSTRAINT tq_groups_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_leaderboard tq_leaderboard_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_leaderboard
    ADD CONSTRAINT tq_leaderboard_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_leaderboard tq_leaderboard_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_leaderboard
    ADD CONSTRAINT tq_leaderboard_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_long_term_predictions tq_long_term_predictions_champion_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_champion_team_id_fkey FOREIGN KEY (champion_team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_long_term_predictions tq_long_term_predictions_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_long_term_predictions tq_long_term_predictions_finalist_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_finalist_team_id_fkey FOREIGN KEY (finalist_team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_long_term_predictions tq_long_term_predictions_top_scorer_player_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_long_term_predictions
    ADD CONSTRAINT tq_long_term_predictions_top_scorer_player_id_fkey FOREIGN KEY (top_scorer_player_id) REFERENCES public.tq_players(id) ON DELETE SET NULL;


--
-- Name: tq_masterpass_invites tq_masterpass_invites_claimed_by_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_claimed_by_fkey FOREIGN KEY (claimed_by) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tq_masterpass_invites tq_masterpass_invites_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_masterpass_invites tq_masterpass_invites_invitee_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_invitee_user_id_fkey FOREIGN KEY (invitee_user_id) REFERENCES public.users(id) ON DELETE SET NULL;


--
-- Name: tq_masterpass_invites tq_masterpass_invites_inviter_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_inviter_id_fkey FOREIGN KEY (inviter_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: tq_masterpass_invites tq_masterpass_invites_masterpass_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_masterpass_invites
    ADD CONSTRAINT tq_masterpass_invites_masterpass_id_fkey FOREIGN KEY (masterpass_id) REFERENCES public.user_masterpasses(id) ON DELETE SET NULL;


--
-- Name: tq_matches tq_matches_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_matches tq_matches_first_scorer_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_first_scorer_team_id_fkey FOREIGN KEY (first_scorer_team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_matches tq_matches_group_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_group_id_fkey FOREIGN KEY (group_id) REFERENCES public.tq_groups(id) ON DELETE SET NULL;


--
-- Name: tq_matches tq_matches_team_a_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_team_a_id_fkey FOREIGN KEY (team_a_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_matches tq_matches_team_b_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_team_b_id_fkey FOREIGN KEY (team_b_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_matches tq_matches_winner_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_matches
    ADD CONSTRAINT tq_matches_winner_team_id_fkey FOREIGN KEY (winner_team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_phase_windows tq_phase_windows_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_phase_windows
    ADD CONSTRAINT tq_phase_windows_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_players tq_players_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_players
    ADD CONSTRAINT tq_players_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: tq_players tq_players_team_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_players
    ADD CONSTRAINT tq_players_team_id_fkey FOREIGN KEY (team_id) REFERENCES public.tq_teams(id) ON DELETE SET NULL;


--
-- Name: tq_scoring_events tq_scoring_events_entry_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_scoring_events
    ADD CONSTRAINT tq_scoring_events_entry_id_fkey FOREIGN KEY (entry_id) REFERENCES public.tq_entries(id) ON DELETE CASCADE;


--
-- Name: tq_teams tq_teams_competition_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.tq_teams
    ADD CONSTRAINT tq_teams_competition_id_fkey FOREIGN KEY (competition_id) REFERENCES public.tq_competitions(id) ON DELETE CASCADE;


--
-- Name: user_activity_logs user_activity_logs_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_activity_logs
    ADD CONSTRAINT user_activity_logs_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_badge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_badge_id_fkey FOREIGN KEY (badge_id) REFERENCES public.badges(id) ON DELETE CASCADE;


--
-- Name: user_badges user_badges_season_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_season_id_fkey FOREIGN KEY (season_id) REFERENCES public.seasons(id) ON DELETE SET NULL;


--
-- Name: user_badges user_badges_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_badges
    ADD CONSTRAINT user_badges_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_boosters user_fantasy_boosters_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_boosters
    ADD CONSTRAINT user_fantasy_boosters_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_boosters user_fantasy_boosters_used_in_gameweek_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_boosters
    ADD CONSTRAINT user_fantasy_boosters_used_in_gameweek_id_fkey FOREIGN KEY (used_in_gameweek_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_boosters user_fantasy_boosters_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_boosters
    ADD CONSTRAINT user_fantasy_boosters_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_scores user_fantasy_scores_challenge_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_scores
    ADD CONSTRAINT user_fantasy_scores_challenge_id_fkey FOREIGN KEY (challenge_id) REFERENCES public.challenges(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_scores user_fantasy_scores_game_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_scores
    ADD CONSTRAINT user_fantasy_scores_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.game_weeks(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_scores user_fantasy_scores_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_scores
    ADD CONSTRAINT user_fantasy_scores_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_teams user_fantasy_teams_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.players(id) ON DELETE SET NULL;


--
-- Name: user_fantasy_teams user_fantasy_teams_game_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_game_id_fkey FOREIGN KEY (game_id) REFERENCES public.fantasy_games(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_teams user_fantasy_teams_game_week_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_game_week_id_fkey FOREIGN KEY (game_week_id) REFERENCES public.fantasy_game_weeks(id) ON DELETE CASCADE;


--
-- Name: user_fantasy_teams user_fantasy_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_fantasy_teams
    ADD CONSTRAINT user_fantasy_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_masterpasses user_masterpasses_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_masterpasses
    ADD CONSTRAINT user_masterpasses_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_onesignal_players user_onesignal_players_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_onesignal_players
    ADD CONSTRAINT user_onesignal_players_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_spin_states user_spin_states_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_spin_states
    ADD CONSTRAINT user_spin_states_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_streaks user_streaks_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_streaks
    ADD CONSTRAINT user_streaks_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_teams user_teams_captain_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_captain_id_fkey FOREIGN KEY (captain_id) REFERENCES public.fb_players(id);


--
-- Name: user_teams user_teams_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_teams
    ADD CONSTRAINT user_teams_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_tickets user_tickets_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.user_tickets
    ADD CONSTRAINT user_tickets_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: users users_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;


--
-- Name: xp_events xp_events_user_id_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.xp_events
    ADD CONSTRAINT xp_events_user_id_fkey FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE;


--
-- Name: user_teams Admin can manage all teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage all teams" ON public.user_teams USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.is_admin = true))));


--
-- Name: game_weeks Admin can manage game weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage game weeks" ON public.game_weeks USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.is_admin = true))));


--
-- Name: scores Admin can manage scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin can manage scores" ON public.scores USING ((auth.uid() IN ( SELECT users.id
   FROM public.users
  WHERE (users.is_admin = true))));


--
-- Name: challenge_bets Admin read challenge bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read challenge bets" ON public.challenge_bets FOR SELECT USING (public.is_admin());


--
-- Name: challenge_daily_entries Admin read challenge daily entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read challenge daily entries" ON public.challenge_daily_entries FOR SELECT USING (public.is_admin());


--
-- Name: challenge_entries Admin read challenge entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admin read challenge entries" ON public.challenge_entries FOR SELECT USING (public.is_admin());


--
-- Name: fb_leagues Admins can delete their own leagues.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can delete their own leagues." ON public.fb_leagues FOR DELETE USING ((( SELECT league_members.role
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid()))) = 'admin'::public.league_role));


--
-- Name: game_weeks Admins can manage game weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage game weeks" ON public.game_weeks USING (public.is_admin());


--
-- Name: user_fantasy_scores Admins can manage scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can manage scores" ON public.user_fantasy_scores USING (public.is_admin());


--
-- Name: fb_leagues Admins can update their own leagues.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can update their own leagues." ON public.fb_leagues FOR UPDATE USING ((( SELECT league_members.role
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid()))) = 'admin'::public.league_role));


--
-- Name: user_streaks Admins can view all streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all streaks" ON public.user_streaks FOR SELECT USING (public.is_admin());


--
-- Name: coin_transactions Admins can view all transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Admins can view all transactions" ON public.coin_transactions FOR SELECT USING (public.is_admin());


--
-- Name: user_activity_logs Allow admin full access to activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access to activity logs" ON public.user_activity_logs USING (public.is_admin());


--
-- Name: season_logs Allow admin full access to season logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access to season logs" ON public.season_logs USING (public.is_admin());


--
-- Name: seasons Allow admin full access to seasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin full access to seasons" ON public.seasons USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: POLICY "Allow admin full access to seasons" ON seasons; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Allow admin full access to seasons" ON public.seasons IS 'Admins have full control over seasons';


--
-- Name: badges Allow admin to manage badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to manage badges" ON public.badges USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: POLICY "Allow admin to manage badges" ON badges; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Allow admin to manage badges" ON public.badges IS 'Admins have full control over badges';


--
-- Name: challenge_required_badges Allow admin to manage challenge badge requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to manage challenge badge requirements" ON public.challenge_required_badges USING (public.is_admin());


--
-- Name: challenge_participants Allow admin to manage challenge participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to manage challenge participants" ON public.challenge_participants USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: leagues Allow admin to manage leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to manage leagues" ON public.leagues USING ((EXISTS ( SELECT 1
   FROM public.users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));


--
-- Name: matchday_fixtures Allow admin to manage matchday_fixtures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin to manage matchday_fixtures" ON public.matchday_fixtures USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: POLICY "Allow admin to manage matchday_fixtures" ON matchday_fixtures; Type: COMMENT; Schema: public; Owner: -
--

COMMENT ON POLICY "Allow admin to manage matchday_fixtures" ON public.matchday_fixtures IS 'Admins have full control over matchday fixtures';


--
-- Name: fantasy_configs Allow admin write access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin write access" ON public.fantasy_configs USING ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true));


--
-- Name: api_sync_config Allow admin write for sync config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admin write for sync config" ON public.api_sync_config USING (false);


--
-- Name: boosters Allow admins full access to boosters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins full access to boosters" ON public.boosters USING ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true));


--
-- Name: user_teams Allow admins full access to user_teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins full access to user_teams" ON public.user_teams USING ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true));


--
-- Name: squad_private_games Allow admins to create private games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to create private games" ON public.squad_private_games FOR INSERT WITH CHECK (((auth.uid() = created_by) AND (EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_private_games.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text))))));


--
-- Name: squad_leaderboard_snapshots Allow admins to create snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to create snapshots" ON public.squad_leaderboard_snapshots FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_leaderboard_snapshots.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text)))));


--
-- Name: squad_private_games Allow admins to delete private games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to delete private games" ON public.squad_private_games FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_private_games.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text)))));


--
-- Name: fb_leagues Allow admins to delete their leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to delete their leagues" ON public.fb_leagues FOR DELETE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid()) AND (league_members.role = 'admin'::public.league_role)))));


--
-- Name: squad_games Allow admins to link games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to link games" ON public.squad_games FOR INSERT WITH CHECK (((auth.uid() = linked_by) AND (EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_games.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text))))));


--
-- Name: game_weeks Allow admins to manage game_weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to manage game_weeks" ON public.game_weeks USING ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true)) WITH CHECK ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true));


--
-- Name: scores Allow admins to manage scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to manage scores" ON public.scores USING ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true)) WITH CHECK ((( SELECT users.is_admin
   FROM public.users
  WHERE (users.id = auth.uid())) = true));


--
-- Name: squad_games Allow admins to unlink games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to unlink games" ON public.squad_games FOR DELETE USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_games.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text)))));


--
-- Name: squad_private_games Allow admins to update private games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to update private games" ON public.squad_private_games FOR UPDATE USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_private_games.squad_id) AND (squad_members.user_id = auth.uid()) AND (squad_members.role = 'admin'::text)))));


--
-- Name: fb_leagues Allow admins to update their leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow admins to update their leagues" ON public.fb_leagues FOR UPDATE TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid()) AND (league_members.role = 'admin'::public.league_role))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid()) AND (league_members.role = 'admin'::public.league_role)))));


--
-- Name: badges Allow all authenticated to read badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow all authenticated to read badges" ON public.badges FOR SELECT TO authenticated USING (true);


--
-- Name: fb_fixtures Allow anon read access for fb_fixtures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anon read access for fb_fixtures" ON public.fb_fixtures FOR SELECT TO anon USING (true);


--
-- Name: squad_feed_likes Allow anyone to view likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow anyone to view likes" ON public.squad_feed_likes FOR SELECT USING (true);


--
-- Name: badges Allow authenticated read access to all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to all" ON public.badges FOR SELECT TO authenticated USING (true);


--
-- Name: fb_player_match_stats Allow authenticated read access to player_match_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to player_match_stats" ON public.fb_player_match_stats FOR SELECT TO authenticated USING (true);


--
-- Name: player_match_stats Allow authenticated read access to player_match_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to player_match_stats" ON public.player_match_stats FOR SELECT TO authenticated USING (true);


--
-- Name: player_season_stats Allow authenticated read access to player_season_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to player_season_stats" ON public.player_season_stats FOR SELECT TO authenticated USING (true);


--
-- Name: player_transfers Allow authenticated read access to player_transfers; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read access to player_transfers" ON public.player_transfers FOR SELECT TO authenticated USING (true);


--
-- Name: api_sync_config Allow authenticated read for sync config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated read for sync config" ON public.api_sync_config FOR SELECT TO authenticated USING (true);


--
-- Name: fb_leagues Allow authenticated users to create leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to create leagues" ON public.fb_leagues FOR INSERT TO authenticated WITH CHECK ((auth.uid() = created_by));


--
-- Name: challenge_participants Allow authenticated users to join challenges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to join challenges" ON public.challenge_participants FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: squad_feed_likes Allow authenticated users to like posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to like posts" ON public.squad_feed_likes FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: fantasy_games Allow authenticated users to read fantasy_games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read fantasy_games" ON public.fantasy_games FOR SELECT TO authenticated USING (true);


--
-- Name: user_badges Allow authenticated users to read their own badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read their own badges" ON public.user_badges FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Allow authenticated users to read their own user record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to read their own user record" ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: users Allow authenticated users to update their own user record; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow authenticated users to update their own user record" ON public.users FOR UPDATE USING ((auth.uid() = id));


--
-- Name: league_games Allow league admins to link/unlink games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow league admins to link/unlink games" ON public.league_games USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = league_games.league_id) AND (league_members.user_id = auth.uid()) AND (league_members.role = 'admin'::public.league_role)))));


--
-- Name: league_games Allow members to read their league's linked games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow members to read their league's linked games" ON public.league_games FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = league_games.league_id) AND (league_members.user_id = auth.uid())))));


--
-- Name: fb_leagues Allow members to read their own leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow members to read their own leagues" ON public.fb_leagues FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid())))));


--
-- Name: fb_leagues Allow members to view their leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow members to view their leagues" ON public.fb_leagues FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid())))));


--
-- Name: season_logs Allow owner to read their season logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow owner to read their season logs" ON public.season_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: fantasy_configs Allow public read access; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access" ON public.fantasy_configs FOR SELECT USING (true);


--
-- Name: app_config Allow public read access for app_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access for app_config" ON public.app_config FOR SELECT USING (true);


--
-- Name: fb_fixtures Allow public read access for fixtures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access for fixtures" ON public.fb_fixtures FOR SELECT USING (true);


--
-- Name: fb_odds Allow public read access for odds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access for odds" ON public.fb_odds FOR SELECT USING (true);


--
-- Name: odds Allow public read access for odds; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access for odds" ON public.odds FOR SELECT USING (true);


--
-- Name: badges Allow public read access to badges; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to badges" ON public.badges FOR SELECT USING (true);


--
-- Name: challenge_required_badges Allow public read access to challenge badge requirements; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge badge requirements" ON public.challenge_required_badges FOR SELECT USING (true);


--
-- Name: challenge_participants Allow public read access to challenge participants; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge participants" ON public.challenge_participants FOR SELECT USING (true);


--
-- Name: challenge_configs Allow public read access to challenge_configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge_configs" ON public.challenge_configs FOR SELECT USING (true);


--
-- Name: challenge_leagues Allow public read access to challenge_leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge_leagues" ON public.challenge_leagues FOR SELECT USING (true);


--
-- Name: challenge_matchdays Allow public read access to challenge_matchdays; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge_matchdays" ON public.challenge_matchdays FOR SELECT USING (true);


--
-- Name: challenge_matches Allow public read access to challenge_matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to challenge_matches" ON public.challenge_matches FOR SELECT USING (true);


--
-- Name: game_config Allow public read access to game configs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to game configs" ON public.game_config FOR SELECT USING (true);


--
-- Name: fb_leagues Allow public read access to leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to leagues" ON public.fb_leagues FOR SELECT USING (true);


--
-- Name: leagues Allow public read access to leagues; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to leagues" ON public.leagues FOR SELECT USING (true);


--
-- Name: levels_config Allow public read access to levels; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to levels" ON public.levels_config FOR SELECT USING (true);


--
-- Name: matchday_fixtures Allow public read access to matchday_fixtures; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to matchday_fixtures" ON public.matchday_fixtures FOR SELECT USING (true);


--
-- Name: matches Allow public read access to matches; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to matches" ON public.matches FOR SELECT USING (true);


--
-- Name: fb_player_team_association Allow public read access to player associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to player associations" ON public.fb_player_team_association FOR SELECT USING (true);


--
-- Name: fb_players Allow public read access to players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to players" ON public.fb_players FOR SELECT USING (true);


--
-- Name: fixture_sync_log Allow public read access to sync log; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to sync log" ON public.fixture_sync_log FOR SELECT USING (true);


--
-- Name: fb_team_league_participation Allow public read access to team participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to team participations" ON public.fb_team_league_participation FOR SELECT USING (true);


--
-- Name: fb_teams Allow public read access to teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read access to teams" ON public.fb_teams FOR SELECT USING (true);


--
-- Name: matchday_participants Allow public read for leaderboard; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read for leaderboard" ON public.matchday_participants FOR SELECT USING (true);


--
-- Name: swipe_predictions Allow public read for leaderboard calculation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read for leaderboard calculation" ON public.swipe_predictions FOR SELECT USING (true);


--
-- Name: seasons Allow public read-only access to seasons; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public read-only access to seasons" ON public.seasons FOR SELECT USING (true);


--
-- Name: fb_player_team_association Allow public select access to player team associations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select access to player team associations" ON public.fb_player_team_association FOR SELECT USING (true);


--
-- Name: fb_player_team_association Allow public select access to player_team_association; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select access to player_team_association" ON public.fb_player_team_association FOR SELECT USING (true);


--
-- Name: fb_players Allow public select access to players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select access to players" ON public.fb_players FOR SELECT USING (true);


--
-- Name: fb_team_league_participation Allow public select access to team participations; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow public select access to team participations" ON public.fb_team_league_participation FOR SELECT USING (true);


--
-- Name: player_match_stats Allow read access to player_match_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to player_match_stats" ON public.player_match_stats FOR SELECT USING (true);


--
-- Name: player_season_stats Allow read access to player_season_stats; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow read access to player_season_stats" ON public.player_season_stats FOR SELECT USING (true);


--
-- Name: app_config Allow service_role full access for app_config; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow service_role full access for app_config" ON public.app_config USING ((auth.role() = 'service_role'::text));


--
-- Name: squad_feed Allow squad members to create posts; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow squad members to create posts" ON public.squad_feed FOR INSERT WITH CHECK (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_feed.squad_id) AND (squad_members.user_id = auth.uid()))))));


--
-- Name: squad_feed Allow squad members to view feed; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow squad members to view feed" ON public.squad_feed FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_feed.squad_id) AND (squad_members.user_id = auth.uid())))));


--
-- Name: squad_games Allow squad members to view linked games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow squad members to view linked games" ON public.squad_games FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_games.squad_id) AND (squad_members.user_id = auth.uid())))));


--
-- Name: squad_private_games Allow squad members to view private games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow squad members to view private games" ON public.squad_private_games FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_private_games.squad_id) AND (squad_members.user_id = auth.uid())))));


--
-- Name: squad_leaderboard_snapshots Allow squad members to view snapshots; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow squad members to view snapshots" ON public.squad_leaderboard_snapshots FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.squad_members
  WHERE ((squad_members.squad_id = squad_leaderboard_snapshots.squad_id) AND (squad_members.user_id = auth.uid())))));


--
-- Name: user_activity_logs Allow users to insert their own activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to insert their own activity logs" ON public.user_activity_logs FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: boosters Allow users to manage their own boosters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to manage their own boosters" ON public.boosters USING ((auth.uid() = used_by)) WITH CHECK ((auth.uid() = used_by));


--
-- Name: user_teams Allow users to manage their own teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to manage their own teams" ON public.user_teams USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_activity_logs Allow users to read their own activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to read their own activity logs" ON public.user_activity_logs FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: squad_feed_likes Allow users to unlike their own likes; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to unlike their own likes" ON public.squad_feed_likes FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: challenge_participants Allow users to update own participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update own participation" ON public.challenge_participants FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_activity_logs Allow users to update their own activity logs; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow users to update their own activity logs" ON public.user_activity_logs FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Allow viewing of fellow league members; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Allow viewing of fellow league members" ON public.users FOR SELECT TO authenticated USING ((EXISTS ( SELECT 1
   FROM (public.league_members lm_viewer
     JOIN public.league_members lm_viewed ON ((lm_viewer.league_id = lm_viewed.league_id)))
  WHERE ((lm_viewer.user_id = auth.uid()) AND (lm_viewed.user_id = users.id)))));


--
-- Name: live_game_tier_limits Anyone can read tier limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can read tier limits" ON public.live_game_tier_limits FOR SELECT USING (true);


--
-- Name: live_game_entries Anyone can view game entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view game entries" ON public.live_game_entries FOR SELECT USING (true);


--
-- Name: live_games Anyone can view live games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Anyone can view live games" ON public.live_games FOR SELECT USING (true);


--
-- Name: live_games Authenticated users can create live games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can create live games" ON public.live_games FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: live_game_entries Authenticated users can join games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can join games" ON public.live_game_entries FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Authenticated users can view all user profiles.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Authenticated users can view all user profiles." ON public.users FOR SELECT TO authenticated USING (true);


--
-- Name: live_games Creator can update their live games; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Creator can update their live games" ON public.live_games FOR UPDATE USING ((auth.uid() = created_by));


--
-- Name: users Disallow users from deleting their records; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Disallow users from deleting their records" ON public.users FOR DELETE USING (false);


--
-- Name: fantasy_league_players Fantasy league players are viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Fantasy league players are viewable by everyone" ON public.fantasy_league_players FOR SELECT USING (true);


--
-- Name: fixtures Fixtures viewable by everyone; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Fixtures viewable by everyone" ON public.fixtures FOR SELECT USING (true);


--
-- Name: live_game_tier_limits Only service role can delete tier limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can delete tier limits" ON public.live_game_tier_limits FOR DELETE USING (false);


--
-- Name: live_game_tier_limits Only service role can modify tier limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can modify tier limits" ON public.live_game_tier_limits FOR INSERT WITH CHECK (false);


--
-- Name: live_game_tier_limits Only service role can update tier limits; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Only service role can update tier limits" ON public.live_game_tier_limits FOR UPDATE USING (false);


--
-- Name: game_weeks Public can read game weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read game weeks" ON public.game_weeks FOR SELECT USING (true);


--
-- Name: scores Public can read scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read scores" ON public.scores FOR SELECT USING (true);


--
-- Name: user_fantasy_scores Public can read scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public can read scores" ON public.user_fantasy_scores FOR SELECT USING (true);


--
-- Name: game_weeks Public read access for game weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for game weeks" ON public.game_weeks FOR SELECT USING (true);


--
-- Name: game_weeks Public read access for game_weeks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for game_weeks" ON public.game_weeks FOR SELECT USING (true);


--
-- Name: scores Public read access for scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Public read access for scores" ON public.scores FOR SELECT USING (true);


--
-- Name: fantasy_league_players Service role can manage fantasy league players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Service role can manage fantasy league players" ON public.fantasy_league_players USING (((auth.jwt() ->> 'role'::text) = 'service_role'::text));


--
-- Name: users Super admins can manage users; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Super admins can manage users" ON public.users USING (public.is_super_admin());


--
-- Name: spin_history Users can insert own spin history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own spin history" ON public.spin_history FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_spin_states Users can insert own spin state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert own spin state" ON public.user_spin_states FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_onesignal_players Users can insert their own OneSignal players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own OneSignal players" ON public.user_onesignal_players FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can insert their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own notification preferences" ON public.notification_preferences FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: swipe_predictions Users can insert their own predictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own predictions" ON public.swipe_predictions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: users Users can insert their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile" ON public.users FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: users Users can insert their own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own profile." ON public.users FOR INSERT WITH CHECK ((auth.uid() = id));


--
-- Name: user_streaks Users can insert their own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own streaks" ON public.user_streaks FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: ticket_transactions Users can insert their own ticket transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own ticket transactions" ON public.ticket_transactions FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_tickets Users can insert their own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can insert their own tickets" ON public.user_tickets FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: boosters Users can manage their own boosters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own boosters" ON public.boosters USING ((auth.uid() = used_by)) WITH CHECK ((auth.uid() = used_by));


--
-- Name: user_fantasy_boosters Users can manage their own boosters; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own boosters" ON public.user_fantasy_boosters USING ((auth.uid() = user_id));


--
-- Name: user_teams Users can manage their own teams; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can manage their own teams" ON public.user_teams USING ((auth.uid() = user_id));


--
-- Name: live_game_bets Users can place bets on their entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can place bets on their entries" ON public.live_game_bets FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM public.live_game_entries
  WHERE ((live_game_entries.id = live_game_bets.entry_id) AND (live_game_entries.user_id = auth.uid())))));


--
-- Name: fb_leagues Users can read leagues they are a member of.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can read leagues they are a member of." ON public.fb_leagues FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.league_members
  WHERE ((league_members.league_id = fb_leagues.id) AND (league_members.user_id = auth.uid())))));


--
-- Name: users Users can see profiles of fellow league members.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see profiles of fellow league members." ON public.users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM (public.league_members lm1
     JOIN public.league_members lm2 ON ((lm1.league_id = lm2.league_id)))
  WHERE ((lm1.user_id = auth.uid()) AND (lm2.user_id = users.id)))));


--
-- Name: users Users can see their own profile and league-mates.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own profile and league-mates." ON public.users FOR SELECT USING (((auth.uid() = id) OR (EXISTS ( SELECT 1
   FROM (public.league_members lm1
     JOIN public.league_members lm2 ON ((lm1.league_id = lm2.league_id)))
  WHERE ((lm1.user_id = auth.uid()) AND (lm2.user_id = users.id))))));


--
-- Name: users Users can see their own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can see their own profile." ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: user_spin_states Users can update own spin state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update own spin state" ON public.user_spin_states FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: user_onesignal_players Users can update their own OneSignal players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own OneSignal players" ON public.user_onesignal_players FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: live_game_entries Users can update their own entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own entries" ON public.live_game_entries FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can update their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notification preferences" ON public.notification_preferences FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: notifications Users can update their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own notifications" ON public.notifications FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: swipe_predictions Users can update their own predictions before deadline; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own predictions before deadline" ON public.swipe_predictions FOR UPDATE USING (((auth.uid() = user_id) AND (EXISTS ( SELECT 1
   FROM public.challenge_matchdays
  WHERE ((challenge_matchdays.id = swipe_predictions.matchday_id) AND ((challenge_matchdays.deadline IS NULL) OR (challenge_matchdays.deadline > now())))))));


--
-- Name: profiles Users can update their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile" ON public.profiles FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: users Users can update their own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own profile." ON public.users FOR UPDATE USING ((auth.uid() = id)) WITH CHECK ((auth.uid() = id));


--
-- Name: user_streaks Users can update their own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own streaks" ON public.user_streaks FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_tickets Users can update their own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can update their own tickets" ON public.user_tickets FOR UPDATE USING ((auth.uid() = user_id));


--
-- Name: spin_history Users can view own spin history; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own spin history" ON public.spin_history FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_spin_states Users can view own spin state; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own spin state" ON public.user_spin_states FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: coin_transactions Users can view own transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view own transactions" ON public.coin_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: users Users can view profiles of fellow league members.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view profiles of fellow league members." ON public.users FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.league_members lm
  WHERE ((lm.user_id = users.id) AND (lm.league_id IN ( SELECT public.get_user_leagues() AS get_user_leagues))))));


--
-- Name: user_onesignal_players Users can view their own OneSignal players; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own OneSignal players" ON public.user_onesignal_players FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: live_game_bets Users can view their own bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own bets" ON public.live_game_bets FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.live_game_entries
  WHERE ((live_game_entries.id = live_game_bets.entry_id) AND (live_game_entries.user_id = auth.uid())))));


--
-- Name: matchday_participants Users can view their own matchday participation; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own matchday participation" ON public.matchday_participants FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notification_preferences Users can view their own notification preferences; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notification preferences" ON public.notification_preferences FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: notifications Users can view their own notifications; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own notifications" ON public.notifications FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: swipe_predictions Users can view their own predictions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own predictions" ON public.swipe_predictions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: profiles Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.profiles FOR SELECT USING ((auth.uid() = id));


--
-- Name: users Users can view their own profile; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile" ON public.users FOR SELECT TO authenticated USING ((auth.uid() = id));


--
-- Name: users Users can view their own profile and profiles of league co-memb; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile and profiles of league co-memb" ON public.users FOR SELECT USING (((auth.uid() = id) OR (EXISTS ( SELECT 1
   FROM (public.league_members lm1
     JOIN public.league_members lm2 ON ((lm1.league_id = lm2.league_id)))
  WHERE ((lm1.user_id = auth.uid()) AND (lm2.user_id = users.id))))));


--
-- Name: users Users can view their own profile.; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own profile." ON public.users FOR SELECT USING ((auth.uid() = id));


--
-- Name: scores Users can view their own scores; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own scores" ON public.scores FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.user_teams
  WHERE ((user_teams.id = scores.user_team_id) AND (user_teams.user_id = auth.uid())))));


--
-- Name: user_streaks Users can view their own streaks; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own streaks" ON public.user_streaks FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: ticket_transactions Users can view their own ticket transactions; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own ticket transactions" ON public.ticket_transactions FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_tickets Users can view their own tickets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users can view their own tickets" ON public.user_tickets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: challenge_bets Users manage own challenge bets; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own challenge bets" ON public.challenge_bets USING ((EXISTS ( SELECT 1
   FROM (public.challenge_daily_entries cde
     JOIN public.challenge_entries ce ON ((ce.id = cde.challenge_entry_id)))
  WHERE ((cde.id = challenge_bets.daily_entry_id) AND (ce.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM (public.challenge_daily_entries cde
     JOIN public.challenge_entries ce ON ((ce.id = cde.challenge_entry_id)))
  WHERE ((cde.id = challenge_bets.daily_entry_id) AND (ce.user_id = auth.uid())))));


--
-- Name: challenge_entries Users manage own challenge entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own challenge entries" ON public.challenge_entries USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: challenge_daily_entries Users manage own daily challenge entries; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY "Users manage own daily challenge entries" ON public.challenge_daily_entries USING ((EXISTS ( SELECT 1
   FROM public.challenge_entries ce
  WHERE ((ce.id = challenge_daily_entries.challenge_entry_id) AND (ce.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.challenge_entries ce
  WHERE ((ce.id = challenge_daily_entries.challenge_entry_id) AND (ce.user_id = auth.uid())))));


--
-- Name: api_sync_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.api_sync_config ENABLE ROW LEVEL SECURITY;

--
-- Name: app_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.app_config ENABLE ROW LEVEL SECURITY;

--
-- Name: badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.badges ENABLE ROW LEVEL SECURITY;

--
-- Name: badges badges_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY badges_admin ON public.badges USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: boosters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.boosters ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_daily_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_daily_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_matchdays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_matchdays ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: challenge_required_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenge_required_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: challenges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.challenges ENABLE ROW LEVEL SECURITY;

--
-- Name: coin_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.coin_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: content_versions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.content_versions ENABLE ROW LEVEL SECURITY;

--
-- Name: content_versions content_versions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY content_versions_read ON public.content_versions FOR SELECT USING (true);


--
-- Name: countries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.countries ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_boosters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_boosters ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_boosters fantasy_boosters_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fantasy_boosters_select_public ON public.fantasy_boosters FOR SELECT USING (true);


--
-- Name: fantasy_configs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_configs ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_game_weeks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_game_weeks ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_game_weeks fantasy_game_weeks_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fantasy_game_weeks_select_public ON public.fantasy_game_weeks FOR SELECT USING (true);


--
-- Name: fantasy_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_games ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_games fantasy_games_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fantasy_games_select_public ON public.fantasy_games FOR SELECT USING (true);


--
-- Name: fantasy_leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_leaderboard fantasy_leaderboard_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fantasy_leaderboard_select_public ON public.fantasy_leaderboard FOR SELECT USING (true);


--
-- Name: fantasy_league_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_league_players ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fantasy_players ENABLE ROW LEVEL SECURITY;

--
-- Name: fantasy_players fantasy_players_select_public; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fantasy_players_select_public ON public.fantasy_players FOR SELECT USING (true);


--
-- Name: fb_fixture_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_fixture_events ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_fixture_statistics; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_fixture_statistics ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_fixture_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_fixture_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_fixture_stats fb_fixture_stats_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_fixture_stats_read ON public.fb_fixture_stats FOR SELECT USING (true);


--
-- Name: fb_fixtures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_fixtures ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_fixtures fb_fixtures_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_fixtures_admin_write ON public.fb_fixtures USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_leagues fb_leagues_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_leagues_admin_write ON public.fb_leagues USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_odds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_odds ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_player_match_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_player_match_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_player_season_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_player_season_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_player_season_stats fb_player_season_stats_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_player_season_stats_read ON public.fb_player_season_stats FOR SELECT USING (true);


--
-- Name: fb_player_team_association; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_player_team_association ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_player_team_association fb_player_team_association_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_player_team_association_admin_write ON public.fb_player_team_association USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_players ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_players fb_players_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_players_admin_write ON public.fb_players USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_standings; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_standings ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_standings fb_standings_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_standings_read ON public.fb_standings FOR SELECT USING (true);


--
-- Name: fb_team_league_participation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_team_league_participation ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_team_league_participation fb_team_league_participation_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_team_league_participation_admin_write ON public.fb_team_league_participation USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_teams fb_teams_admin_write; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_teams_admin_write ON public.fb_teams USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: fb_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fb_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_transfers fb_transfers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fb_transfers_read ON public.fb_transfers FOR SELECT USING (true);


--
-- Name: fixture_sync_log; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixture_sync_log ENABLE ROW LEVEL SECURITY;

--
-- Name: fixtures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.fixtures ENABLE ROW LEVEL SECURITY;

--
-- Name: fb_fixture_events fx_events_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fx_events_read ON public.fb_fixture_events FOR SELECT USING (true);


--
-- Name: fb_fixture_statistics fx_stats_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY fx_stats_read ON public.fb_fixture_statistics FOR SELECT USING (true);


--
-- Name: game_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_config ENABLE ROW LEVEL SECURITY;

--
-- Name: game_config game_config_select_all; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY game_config_select_all ON public.game_config FOR SELECT USING (true);


--
-- Name: game_weeks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.game_weeks ENABLE ROW LEVEL SECURITY;

--
-- Name: league_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.league_games ENABLE ROW LEVEL SECURITY;

--
-- Name: league_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.league_members ENABLE ROW LEVEL SECURITY;

--
-- Name: leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: levels_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.levels_config ENABLE ROW LEVEL SECURITY;

--
-- Name: levels_config levels_config_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY levels_config_admin ON public.levels_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: lf_activation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_activation ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_activation lf_activation_r; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_activation_r ON public.lf_activation FOR SELECT USING (true);


--
-- Name: lf_activation lf_activation_w; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_activation_w ON public.lf_activation USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: lf_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_config ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_config lf_config_r; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_config_r ON public.lf_config FOR SELECT USING (true);


--
-- Name: lf_config lf_config_w; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_config_w ON public.lf_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: lf_game_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_game_players ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_game_players lf_game_players_r; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_game_players_r ON public.lf_game_players FOR SELECT USING (true);


--
-- Name: lf_game_players lf_game_players_w; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_game_players_w ON public.lf_game_players USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: lf_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_games ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_games lf_games_r; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_games_r ON public.lf_games FOR SELECT USING (true);


--
-- Name: lf_games lf_games_w; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_games_w ON public.lf_games USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: lf_notify; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_notify ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_notify lf_notify_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_notify_own ON public.lf_notify USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: lf_team_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_team_players ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.lf_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: lf_teams lf_teams_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_teams_own ON public.lf_teams USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: lf_teams lf_teams_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_teams_read ON public.lf_teams FOR SELECT USING (true);


--
-- Name: lf_team_players lf_tp_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_tp_own ON public.lf_team_players USING ((EXISTS ( SELECT 1
   FROM public.lf_teams t
  WHERE ((t.id = lf_team_players.team_id) AND (t.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.lf_teams t
  WHERE ((t.id = lf_team_players.team_id) AND (t.user_id = auth.uid())))));


--
-- Name: lf_team_players lf_tp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lf_tp_read ON public.lf_team_players FOR SELECT USING (true);


--
-- Name: badges lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.badges FOR SELECT TO authenticated, anon USING (true);


--
-- Name: challenge_matches lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.challenge_matches FOR SELECT TO authenticated, anon USING (true);


--
-- Name: challenge_participants lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.challenge_participants FOR SELECT TO authenticated, anon USING (true);


--
-- Name: challenges lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.challenges FOR SELECT USING (true);


--
-- Name: countries lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.countries FOR SELECT USING (true);


--
-- Name: fantasy_games lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.fantasy_games FOR SELECT TO authenticated, anon USING (true);


--
-- Name: fb_fixtures lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.fb_fixtures FOR SELECT TO authenticated, anon USING (true);


--
-- Name: league_members lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.league_members FOR SELECT USING (true);


--
-- Name: players lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.players FOR SELECT TO authenticated, anon USING (true);


--
-- Name: teams lint_public_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lint_public_read ON public.teams FOR SELECT TO authenticated, anon USING (true);


--
-- Name: live_game_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_game_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: live_game_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_game_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: live_game_tier_limits; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_game_tier_limits ENABLE ROW LEVEL SECURITY;

--
-- Name: live_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_games ENABLE ROW LEVEL SECURITY;

--
-- Name: live_pred_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.live_pred_config ENABLE ROW LEVEL SECURITY;

--
-- Name: live_pred_config lpc_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lpc_admin ON public.live_pred_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: live_pred_config lpc_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY lpc_read ON public.live_pred_config FOR SELECT USING (true);


--
-- Name: match_bets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.match_bets ENABLE ROW LEVEL SECURITY;

--
-- Name: match_bets match_bets_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY match_bets_select_own ON public.match_bets FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: matchday_fixtures; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchday_fixtures ENABLE ROW LEVEL SECURITY;

--
-- Name: matchday_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matchday_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_masterpass_invites mp_invites_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mp_invites_read ON public.tq_masterpass_invites FOR SELECT USING (((inviter_id = auth.uid()) OR (invitee_user_id = auth.uid())));


--
-- Name: mr_activation; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_activation ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_activation mr_activation_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_activation_admin ON public.mr_activation USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_activation mr_activation_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_activation_read ON public.mr_activation FOR SELECT USING (true);


--
-- Name: mr_answers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_answers ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_answers mr_answers_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_answers_own ON public.mr_answers FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: mr_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_config ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_config mr_config_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_config_admin ON public.mr_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_config mr_config_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_config_read ON public.mr_config FOR SELECT USING (true);


--
-- Name: mr_event_catalog; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_event_catalog ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_event_catalog mr_event_catalog_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_event_catalog_admin ON public.mr_event_catalog USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_event_catalog mr_event_catalog_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_event_catalog_read ON public.mr_event_catalog FOR SELECT USING (true);


--
-- Name: mr_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_games ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_games mr_games_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_games_admin ON public.mr_games USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_games mr_games_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_games_read ON public.mr_games FOR SELECT USING (true);


--
-- Name: mr_participants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_participants ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_participants mr_participants_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_participants_read ON public.mr_participants FOR SELECT USING (true);


--
-- Name: mr_pot_assignments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_pot_assignments ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_pot_assignments mr_pot_assignments_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_pot_assignments_admin ON public.mr_pot_assignments USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_pot_assignments mr_pot_assignments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_pot_assignments_read ON public.mr_pot_assignments FOR SELECT USING (true);


--
-- Name: mr_pot_profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_pot_profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_pot_profiles mr_pot_profiles_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_pot_profiles_admin ON public.mr_pot_profiles USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_pot_profiles mr_pot_profiles_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_pot_profiles_read ON public.mr_pot_profiles FOR SELECT USING (true);


--
-- Name: mr_questions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.mr_questions ENABLE ROW LEVEL SECURITY;

--
-- Name: mr_questions mr_questions_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_questions_admin ON public.mr_questions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: mr_questions mr_questions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY mr_questions_read ON public.mr_questions FOR SELECT USING (true);


--
-- Name: notification_preferences; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notification_preferences ENABLE ROW LEVEL SECURITY;

--
-- Name: notifications; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

--
-- Name: odds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.odds ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_config pc_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_admin ON public.puzzle_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: puzzle_config pc_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pc_read ON public.puzzle_config FOR SELECT USING (true);


--
-- Name: puzzle_daily_prizes pdp_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pdp_admin ON public.puzzle_daily_prizes USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: puzzle_daily_prizes pdp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pdp_read ON public.puzzle_daily_prizes FOR SELECT USING (true);


--
-- Name: puzzle_games pg_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pg_admin ON public.puzzle_games USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: puzzle_games pg_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pg_read ON public.puzzle_games FOR SELECT USING (true);


--
-- Name: player_match_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_match_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: player_season_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_season_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: player_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.player_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.players ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_monthly_grants pmg_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pmg_own ON public.puzzle_monthly_grants FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: puzzle_plays pp_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pp_own ON public.puzzle_plays FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: puzzle_progress ppr_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY ppr_own ON public.puzzle_progress FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: puzzle_rounds pr_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pr_admin ON public.puzzle_rounds USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: puzzle_round_attempts pra_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pra_own ON public.puzzle_round_attempts FOR SELECT USING ((EXISTS ( SELECT 1
   FROM public.puzzle_plays pl
  WHERE ((pl.id = puzzle_round_attempts.play_id) AND (pl.user_id = auth.uid())))));


--
-- Name: premium_daily_claims; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.premium_daily_claims ENABLE ROW LEVEL SECURITY;

--
-- Name: premium_daily_claims premium_daily_claims_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY premium_daily_claims_own ON public.premium_daily_claims FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: profiles; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_user_prefs pup_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY pup_own ON public.puzzle_user_prefs USING ((user_id = auth.uid())) WITH CHECK ((user_id = auth.uid()));


--
-- Name: puzzle_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_config ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_daily_prizes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_daily_prizes ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_games ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_monthly_grants; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_monthly_grants ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_plays; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_plays ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_progress; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_progress ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_round_attempts; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_round_attempts ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_rounds; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_rounds ENABLE ROW LEVEL SECURITY;

--
-- Name: puzzle_user_prefs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.puzzle_user_prefs ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_fulfillments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_fulfillments ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_fulfillments reward_fulfillments_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_fulfillments_admin ON public.reward_fulfillments USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: reward_fulfillments reward_fulfillments_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_fulfillments_own ON public.reward_fulfillments FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: reward_packs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.reward_packs ENABLE ROW LEVEL SECURITY;

--
-- Name: reward_packs reward_packs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY reward_packs_admin ON public.reward_packs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.scores ENABLE ROW LEVEL SECURITY;

--
-- Name: season_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.season_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: seed_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.seed_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: seed_runs seed_runs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY seed_runs_read ON public.seed_runs FOR SELECT USING (true);


--
-- Name: spin_history; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spin_history ENABLE ROW LEVEL SECURITY;

--
-- Name: spin_segments; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.spin_segments ENABLE ROW LEVEL SECURITY;

--
-- Name: spin_segments spin_segments_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spin_segments_admin ON public.spin_segments USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: spin_segments spin_segments_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY spin_segments_read ON public.spin_segments FOR SELECT USING (true);


--
-- Name: squad_blocks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_blocks ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_feed; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_feed ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_feed_likes; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_feed_likes ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_games ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_leaderboard_snapshots; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_leaderboard_snapshots ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_members; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_members ENABLE ROW LEVEL SECURITY;

--
-- Name: squad_members squad_members_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squad_members_delete_admin ON public.squad_members FOR DELETE USING (public.is_squad_admin(squad_id, auth.uid()));


--
-- Name: squad_members squad_members_delete_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squad_members_delete_self ON public.squad_members FOR DELETE USING ((user_id = auth.uid()));


--
-- Name: squad_members squad_members_insert_self; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squad_members_insert_self ON public.squad_members FOR INSERT WITH CHECK ((user_id = auth.uid()));


--
-- Name: squad_members squad_members_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squad_members_select_own ON public.squad_members FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: squad_members squad_members_select_same_squad; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squad_members_select_same_squad ON public.squad_members FOR SELECT USING ((squad_id IN ( SELECT public.get_user_squad_ids(auth.uid()) AS get_user_squad_ids)));


--
-- Name: squad_private_games; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squad_private_games ENABLE ROW LEVEL SECURITY;

--
-- Name: squads; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.squads ENABLE ROW LEVEL SECURITY;

--
-- Name: squads squads_delete_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_delete_admin ON public.squads FOR DELETE USING (public.is_squad_admin(id, auth.uid()));


--
-- Name: squads squads_insert; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_insert ON public.squads FOR INSERT WITH CHECK ((auth.uid() = created_by));


--
-- Name: squads squads_select_member; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_select_member ON public.squads FOR SELECT USING ((id IN ( SELECT public.get_user_squad_ids(auth.uid()) AS get_user_squad_ids)));


--
-- Name: squads squads_update_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY squads_update_admin ON public.squads FOR UPDATE USING (public.is_squad_admin(id, auth.uid()));


--
-- Name: swipe_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.swipe_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: team_popularity; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.team_popularity ENABLE ROW LEVEL SECURITY;

--
-- Name: teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.teams ENABLE ROW LEVEL SECURITY;

--
-- Name: ticket_transactions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.ticket_transactions ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_club_seasons; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_club_seasons ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_club_seasons tm_club_seasons_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_club_seasons_admin ON public.tm_club_seasons USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_club_seasons tm_club_seasons_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_club_seasons_read ON public.tm_club_seasons FOR SELECT USING (true);


--
-- Name: tm_clubs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_clubs ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_clubs tm_clubs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_clubs_admin ON public.tm_clubs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_clubs tm_clubs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_clubs_read ON public.tm_clubs FOR SELECT USING (true);


--
-- Name: tm_leagues; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_leagues ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_leagues tm_leagues_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_leagues_admin ON public.tm_leagues USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_leagues tm_leagues_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_leagues_read ON public.tm_leagues FOR SELECT USING (true);


--
-- Name: tm_lineups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_lineups ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_lineups tm_lineups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_lineups_admin ON public.tm_lineups USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_lineups tm_lineups_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_lineups_read ON public.tm_lineups FOR SELECT USING (true);


--
-- Name: tm_market_values; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_market_values ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_market_values tm_market_values_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_market_values_admin ON public.tm_market_values USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_market_values tm_market_values_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_market_values_read ON public.tm_market_values FOR SELECT USING (true);


--
-- Name: tm_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_matches tm_matches_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_matches_admin ON public.tm_matches USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_matches tm_matches_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_matches_read ON public.tm_matches FOR SELECT USING (true);


--
-- Name: tm_player_season_stats; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_player_season_stats ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_player_season_stats tm_player_season_stats_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_player_season_stats_admin ON public.tm_player_season_stats USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_player_season_stats tm_player_season_stats_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_player_season_stats_read ON public.tm_player_season_stats FOR SELECT USING (true);


--
-- Name: tm_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_players ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_players tm_players_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_players_admin ON public.tm_players USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_players tm_players_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_players_read ON public.tm_players FOR SELECT USING (true);


--
-- Name: tm_seed_runs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_seed_runs ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_seed_runs tm_seed_runs_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_seed_runs_admin ON public.tm_seed_runs USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_seed_runs tm_seed_runs_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_seed_runs_read ON public.tm_seed_runs FOR SELECT USING (true);


--
-- Name: tm_squad_memberships; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_squad_memberships ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_squad_memberships tm_squad_memberships_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_squad_memberships_admin ON public.tm_squad_memberships USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_squad_memberships tm_squad_memberships_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_squad_memberships_read ON public.tm_squad_memberships FOR SELECT USING (true);


--
-- Name: tm_transfers; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_transfers ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_transfers tm_transfers_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_transfers_admin ON public.tm_transfers USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_transfers tm_transfers_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_transfers_read ON public.tm_transfers FOR SELECT USING (true);


--
-- Name: tm_trophies; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tm_trophies ENABLE ROW LEVEL SECURITY;

--
-- Name: tm_trophies tm_trophies_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_trophies_admin ON public.tm_trophies USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tm_trophies tm_trophies_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tm_trophies_read ON public.tm_trophies FOR SELECT USING (true);


--
-- Name: team_popularity tp_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tp_admin ON public.team_popularity USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: team_popularity tp_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tp_read ON public.team_popularity FOR SELECT USING (true);


--
-- Name: tq_announcements; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_announcements ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_announcements tq_announcements_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_announcements_admin ON public.tq_announcements USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_announcements tq_announcements_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_announcements_read ON public.tq_announcements FOR SELECT USING ((published_at IS NOT NULL));


--
-- Name: tq_bracket_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_bracket_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_bracket_predictions tq_bracket_predictions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_bracket_predictions_owner ON public.tq_bracket_predictions USING ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_bracket_predictions.entry_id) AND (e.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_bracket_predictions.entry_id) AND (e.user_id = auth.uid())))));


--
-- Name: tq_competitions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_competitions ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_competitions tq_competitions_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_competitions_admin ON public.tq_competitions USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_competitions tq_competitions_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_competitions_read ON public.tq_competitions FOR SELECT USING (true);


--
-- Name: tq_daily_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_daily_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_daily_predictions tq_daily_predictions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_daily_predictions_owner ON public.tq_daily_predictions USING ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_daily_predictions.entry_id) AND (e.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_daily_predictions.entry_id) AND (e.user_id = auth.uid())))));


--
-- Name: tq_entries; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_entries ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_entries tq_entries_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_entries_owner ON public.tq_entries USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: tq_group_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_group_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_group_predictions tq_group_predictions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_group_predictions_owner ON public.tq_group_predictions USING ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_group_predictions.entry_id) AND (e.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_group_predictions.entry_id) AND (e.user_id = auth.uid())))));


--
-- Name: tq_group_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_group_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_group_teams tq_group_teams_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_group_teams_admin ON public.tq_group_teams USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_group_teams tq_group_teams_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_group_teams_read ON public.tq_group_teams FOR SELECT USING (true);


--
-- Name: tq_groups; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_groups ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_groups tq_groups_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_groups_admin ON public.tq_groups USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_groups tq_groups_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_groups_read ON public.tq_groups FOR SELECT USING (true);


--
-- Name: tq_leaderboard; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_leaderboard ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_leaderboard tq_leaderboard_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_leaderboard_read ON public.tq_leaderboard FOR SELECT USING (true);


--
-- Name: tq_long_term_predictions; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_long_term_predictions ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_long_term_predictions tq_long_term_predictions_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_long_term_predictions_owner ON public.tq_long_term_predictions USING ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_long_term_predictions.entry_id) AND (e.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_long_term_predictions.entry_id) AND (e.user_id = auth.uid())))));


--
-- Name: tq_masterpass_invites; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_masterpass_invites ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_matches; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_matches ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_matches tq_matches_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_matches_admin ON public.tq_matches USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_matches tq_matches_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_matches_read ON public.tq_matches FOR SELECT USING (true);


--
-- Name: tq_phase_windows; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_phase_windows ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_phase_windows tq_phase_windows_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_phase_windows_admin ON public.tq_phase_windows USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_phase_windows tq_phase_windows_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_phase_windows_read ON public.tq_phase_windows FOR SELECT USING (true);


--
-- Name: tq_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_players ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_players tq_players_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_players_admin ON public.tq_players USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_players tq_players_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_players_read ON public.tq_players FOR SELECT USING (true);


--
-- Name: tq_scoring_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_scoring_events ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_scoring_events tq_scoring_events_owner; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_scoring_events_owner ON public.tq_scoring_events USING ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_scoring_events.entry_id) AND (e.user_id = auth.uid()))))) WITH CHECK ((EXISTS ( SELECT 1
   FROM public.tq_entries e
  WHERE ((e.id = tq_scoring_events.entry_id) AND (e.user_id = auth.uid())))));


--
-- Name: tq_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.tq_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: tq_teams tq_teams_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_teams_admin ON public.tq_teams USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: tq_teams tq_teams_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY tq_teams_read ON public.tq_teams FOR SELECT USING (true);


--
-- Name: user_activity_logs; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_activity_logs ENABLE ROW LEVEL SECURITY;

--
-- Name: user_badges; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_badges ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fantasy_boosters; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_fantasy_boosters ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fantasy_scores; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_fantasy_scores ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fantasy_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_fantasy_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: user_fantasy_teams user_fantasy_teams_delete_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_fantasy_teams_delete_own ON public.user_fantasy_teams FOR DELETE USING ((auth.uid() = user_id));


--
-- Name: user_fantasy_teams user_fantasy_teams_insert_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_fantasy_teams_insert_own ON public.user_fantasy_teams FOR INSERT WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_fantasy_teams user_fantasy_teams_select_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_fantasy_teams_select_own ON public.user_fantasy_teams FOR SELECT USING ((auth.uid() = user_id));


--
-- Name: user_fantasy_teams user_fantasy_teams_update_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_fantasy_teams_update_own ON public.user_fantasy_teams FOR UPDATE USING ((auth.uid() = user_id)) WITH CHECK ((auth.uid() = user_id));


--
-- Name: user_masterpasses; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_masterpasses ENABLE ROW LEVEL SECURITY;

--
-- Name: user_masterpasses user_masterpasses_own; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY user_masterpasses_own ON public.user_masterpasses FOR SELECT USING ((user_id = auth.uid()));


--
-- Name: user_onesignal_players; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_onesignal_players ENABLE ROW LEVEL SECURITY;

--
-- Name: user_spin_states; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_spin_states ENABLE ROW LEVEL SECURITY;

--
-- Name: user_streaks; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_streaks ENABLE ROW LEVEL SECURITY;

--
-- Name: user_teams; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_teams ENABLE ROW LEVEL SECURITY;

--
-- Name: user_tickets; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.user_tickets ENABLE ROW LEVEL SECURITY;

--
-- Name: users; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_events; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_events ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_events xp_events_self_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY xp_events_self_read ON public.xp_events FOR SELECT TO authenticated USING ((user_id = auth.uid()));


--
-- Name: xp_formula_config xp_formula_admin; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY xp_formula_admin ON public.xp_formula_config USING (public.is_admin()) WITH CHECK (public.is_admin());


--
-- Name: xp_formula_config; Type: ROW SECURITY; Schema: public; Owner: -
--

ALTER TABLE public.xp_formula_config ENABLE ROW LEVEL SECURITY;

--
-- Name: xp_formula_config xp_formula_read; Type: POLICY; Schema: public; Owner: -
--

CREATE POLICY xp_formula_read ON public.xp_formula_config FOR SELECT USING (true);


--
-- Name: SCHEMA public; Type: ACL; Schema: -; Owner: -
--

GRANT USAGE ON SCHEMA public TO postgres;
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT USAGE ON SCHEMA public TO service_role;


--
-- Name: FUNCTION _mp_create_entry(p_game_type text, p_game_id uuid, p_user uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._mp_create_entry(p_game_type text, p_game_id uuid, p_user uuid) TO anon;
GRANT ALL ON FUNCTION public._mp_create_entry(p_game_type text, p_game_id uuid, p_user uuid) TO authenticated;
GRANT ALL ON FUNCTION public._mp_create_entry(p_game_type text, p_game_id uuid, p_user uuid) TO service_role;


--
-- Name: FUNCTION _mp_game_tier(p_game_type text, p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public._mp_game_tier(p_game_type text, p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public._mp_game_tier(p_game_type text, p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public._mp_game_tier(p_game_type text, p_game_id uuid) TO service_role;


--
-- Name: FUNCTION _squad_admin_guard(p_actor uuid, p_squad_id uuid, p_target uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public._squad_admin_guard(p_actor uuid, p_squad_id uuid, p_target uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public._squad_admin_guard(p_actor uuid, p_squad_id uuid, p_target uuid) TO service_role;


--
-- Name: FUNCTION add_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.add_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION add_xp_to_user(p_user_id uuid, p_xp_amount integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.add_xp_to_user(p_user_id uuid, p_xp_amount integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.add_xp_to_user(p_user_id uuid, p_xp_amount integer) TO authenticated;
GRANT ALL ON FUNCTION public.add_xp_to_user(p_user_id uuid, p_xp_amount integer) TO service_role;


--
-- Name: FUNCTION aggregate_player_season_stats(p_league_id uuid, p_season integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.aggregate_player_season_stats(p_league_id uuid, p_season integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.aggregate_player_season_stats(p_league_id uuid, p_season integer) TO authenticated;
GRANT ALL ON FUNCTION public.aggregate_player_season_stats(p_league_id uuid, p_season integer) TO service_role;


--
-- Name: FUNCTION auto_add_squad_creator_as_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_add_squad_creator_as_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_add_squad_creator_as_admin() TO service_role;


--
-- Name: FUNCTION auto_link_fixture_to_matchdays(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_link_fixture_to_matchdays() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_link_fixture_to_matchdays() TO service_role;


--
-- Name: FUNCTION auto_publish_scheduled_games(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.auto_publish_scheduled_games() FROM PUBLIC;
GRANT ALL ON FUNCTION public.auto_publish_scheduled_games() TO authenticated;
GRANT ALL ON FUNCTION public.auto_publish_scheduled_games() TO service_role;


--
-- Name: FUNCTION award_xp(p_user_id uuid, p_amount integer, p_source_type text, p_source_id text, p_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_source_type text, p_source_id text, p_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.award_xp(p_user_id uuid, p_amount integer, p_source_type text, p_source_id text, p_reason text) TO service_role;


--
-- Name: FUNCTION bump_content_version(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.bump_content_version() TO anon;
GRANT ALL ON FUNCTION public.bump_content_version() TO authenticated;
GRANT ALL ON FUNCTION public.bump_content_version() TO service_role;


--
-- Name: FUNCTION calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_bet_points(p_prediction text, p_result text, p_odds jsonb, p_amount integer, p_has_booster boolean, p_booster_type text) TO service_role;


--
-- Name: FUNCTION calculate_consistency_score(p_player_id uuid, p_season integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_consistency_score(p_player_id uuid, p_season integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_consistency_score(p_player_id uuid, p_season integer) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_consistency_score(p_player_id uuid, p_season integer) TO service_role;


--
-- Name: FUNCTION calculate_fantasy_leaderboard(p_game_id uuid, p_game_week_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_fantasy_leaderboard(p_game_id uuid, p_game_week_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_fantasy_leaderboard(p_game_id uuid, p_game_week_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_fantasy_leaderboard(p_game_id uuid, p_game_week_id uuid) TO service_role;


--
-- Name: FUNCTION calculate_fantasy_status(pgs_value numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_fantasy_status(pgs_value numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_fantasy_status(pgs_value numeric) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_fantasy_status(pgs_value numeric) TO service_role;


--
-- Name: FUNCTION calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_shots_on_target integer, p_appearances integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_shots_on_target integer, p_appearances integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_shots_on_target integer, p_appearances integer) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_shots_on_target integer, p_appearances integer) TO service_role;


--
-- Name: FUNCTION calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_tackles_interceptions integer, p_shots_on_target integer, p_duels_won integer, p_clean_sheets integer, p_saves integer, p_penalties_saved integer, p_appearances integer, p_position text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_tackles_interceptions integer, p_shots_on_target integer, p_duels_won integer, p_clean_sheets integer, p_saves integer, p_penalties_saved integer, p_appearances integer, p_position text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_tackles_interceptions integer, p_shots_on_target integer, p_duels_won integer, p_clean_sheets integer, p_saves integer, p_penalties_saved integer, p_appearances integer, p_position text) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_impact_score(p_goals integer, p_assists integer, p_passes_key integer, p_dribbles_success integer, p_tackles_total integer, p_tackles_interceptions integer, p_shots_on_target integer, p_duels_won integer, p_clean_sheets integer, p_saves integer, p_penalties_saved integer, p_appearances integer, p_position text) TO service_role;


--
-- Name: FUNCTION calculate_pgs(p_rating numeric, p_impact numeric, p_consistency numeric, p_minutes_played integer, p_appearances integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_pgs(p_rating numeric, p_impact numeric, p_consistency numeric, p_minutes_played integer, p_appearances integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_pgs(p_rating numeric, p_impact numeric, p_consistency numeric, p_minutes_played integer, p_appearances integer) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_pgs(p_rating numeric, p_impact numeric, p_consistency numeric, p_minutes_played integer, p_appearances integer) TO service_role;


--
-- Name: FUNCTION calculate_user_weekly_xp(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.calculate_user_weekly_xp(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.calculate_user_weekly_xp(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.calculate_user_weekly_xp(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION cancel_challenge(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_challenge(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_challenge(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_challenge(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION cancel_match_bet(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cancel_match_bet(p_fixture_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.cancel_match_bet(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.cancel_match_bet(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION check_daily_streak(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_daily_streak(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_daily_streak(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.check_daily_streak(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION check_team_composition(p_starters uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.check_team_composition(p_starters uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.check_team_composition(p_starters uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.check_team_composition(p_starters uuid[]) TO service_role;


--
-- Name: FUNCTION claim_daily_free_spin(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_daily_free_spin(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_daily_free_spin(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_daily_free_spin(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION claim_daily_streak(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.claim_daily_streak(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.claim_daily_streak(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.claim_daily_streak(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION clean_expired_multipliers(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.clean_expired_multipliers(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.clean_expired_multipliers(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.clean_expired_multipliers(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION cleanup_expired_tickets(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.cleanup_expired_tickets() FROM PUBLIC;
GRANT ALL ON FUNCTION public.cleanup_expired_tickets() TO authenticated;
GRANT ALL ON FUNCTION public.cleanup_expired_tickets() TO service_role;


--
-- Name: TABLE users; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.users TO anon;
GRANT ALL ON TABLE public.users TO authenticated;
GRANT ALL ON TABLE public.users TO service_role;


--
-- Name: FUNCTION complete_guest_registration(p_username text, p_display_name text, p_email text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.complete_guest_registration(p_username text, p_display_name text, p_email text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.complete_guest_registration(p_username text, p_display_name text, p_email text) TO authenticated;
GRANT ALL ON FUNCTION public.complete_guest_registration(p_username text, p_display_name text, p_email text) TO service_role;
GRANT ALL ON FUNCTION public.complete_guest_registration(p_username text, p_display_name text, p_email text) TO anon;


--
-- Name: FUNCTION compute_lf_crowd_stats(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_lf_crowd_stats(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.compute_lf_crowd_stats(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.compute_lf_crowd_stats(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION compute_lp_crowd_stats(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_lp_crowd_stats(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.compute_lp_crowd_stats(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.compute_lp_crowd_stats(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION compute_mr_crowd_stats(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.compute_mr_crowd_stats(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.compute_mr_crowd_stats(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.compute_mr_crowd_stats(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.create_challenge(p_name text, p_description text, p_game_type text, p_format text, p_sport text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) TO service_role;


--
-- Name: FUNCTION create_default_notification_preferences(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_default_notification_preferences() FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_default_notification_preferences() TO service_role;


--
-- Name: FUNCTION create_league(p_name text, p_description text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_league(p_name text, p_description text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_league(p_name text, p_description text) TO authenticated;
GRANT ALL ON FUNCTION public.create_league(p_name text, p_description text) TO service_role;


--
-- Name: FUNCTION create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text) TO authenticated;
GRANT ALL ON FUNCTION public.create_notification(p_user_id uuid, p_type text, p_title text, p_message text, p_action_label text, p_action_link text, p_metadata jsonb, p_onesignal_notification_id text) TO service_role;


--
-- Name: FUNCTION generate_invite_code(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_invite_code() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_invite_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_invite_code() TO service_role;


--
-- Name: TABLE squads; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squads TO anon;
GRANT ALL ON TABLE public.squads TO authenticated;
GRANT ALL ON TABLE public.squads TO service_role;


--
-- Name: FUNCTION create_squad(p_user_id uuid, p_name text, p_description text, p_image_url text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.create_squad(p_user_id uuid, p_name text, p_description text, p_image_url text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.create_squad(p_user_id uuid, p_name text, p_description text, p_image_url text) TO authenticated;
GRANT ALL ON FUNCTION public.create_squad(p_user_id uuid, p_name text, p_description text, p_image_url text) TO service_role;


--
-- Name: FUNCTION deduct_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.deduct_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.deduct_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.deduct_coins(p_user_id uuid, p_amount integer, p_transaction_type text, p_metadata jsonb) TO service_role;


--
-- Name: FUNCTION delete_challenge(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.delete_challenge(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.delete_challenge(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.delete_challenge(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION distribute_challenge_prizes(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.distribute_challenge_prizes(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.distribute_challenge_prizes(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.distribute_challenge_prizes(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION distribute_reward_to_user(p_user_id uuid, p_reward jsonb, p_game_type text, p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward jsonb, p_game_type text, p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward jsonb, p_game_type text, p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward jsonb, p_game_type text, p_game_id uuid) TO service_role;


--
-- Name: FUNCTION distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text) TO authenticated;
GRANT ALL ON FUNCTION public.distribute_reward_to_user(p_user_id uuid, p_reward_type text, p_reward_value integer, p_reward_tier text) TO service_role;


--
-- Name: FUNCTION edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer) TO authenticated;
GRANT ALL ON FUNCTION public.edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer) TO service_role;
GRANT ALL ON FUNCTION public.edit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer) TO anon;


--
-- Name: FUNCTION end_of_season_reset(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.end_of_season_reset() FROM PUBLIC;
GRANT ALL ON FUNCTION public.end_of_season_reset() TO authenticated;
GRANT ALL ON FUNCTION public.end_of_season_reset() TO service_role;


--
-- Name: FUNCTION extract_first_initial(name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.extract_first_initial(name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.extract_first_initial(name text) TO authenticated;
GRANT ALL ON FUNCTION public.extract_first_initial(name text) TO service_role;


--
-- Name: FUNCTION extract_last_name(name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.extract_last_name(name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.extract_last_name(name text) TO authenticated;
GRANT ALL ON FUNCTION public.extract_last_name(name text) TO service_role;


--
-- Name: FUNCTION finalize_betting_challenge(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finalize_betting_challenge(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalize_betting_challenge(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.finalize_betting_challenge(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION finalize_challenge(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finalize_challenge(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalize_challenge(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.finalize_challenge(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION finalize_due_challenges(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.finalize_due_challenges() FROM PUBLIC;
GRANT ALL ON FUNCTION public.finalize_due_challenges() TO authenticated;
GRANT ALL ON FUNCTION public.finalize_due_challenges() TO service_role;


--
-- Name: FUNCTION force_resync_odds(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.force_resync_odds() FROM PUBLIC;
GRANT ALL ON FUNCTION public.force_resync_odds() TO authenticated;
GRANT ALL ON FUNCTION public.force_resync_odds() TO service_role;


--
-- Name: FUNCTION freeze_params(p_user uuid, p_base_every integer, p_base_max integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.freeze_params(p_user uuid, p_base_every integer, p_base_max integer) TO anon;
GRANT ALL ON FUNCTION public.freeze_params(p_user uuid, p_base_every integer, p_base_max integer) TO authenticated;
GRANT ALL ON FUNCTION public.freeze_params(p_user uuid, p_base_every integer, p_base_max integer) TO service_role;


--
-- Name: FUNCTION funzone_generate_horizon(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.funzone_generate_horizon() TO anon;
GRANT ALL ON FUNCTION public.funzone_generate_horizon() TO authenticated;
GRANT ALL ON FUNCTION public.funzone_generate_horizon() TO service_role;


--
-- Name: FUNCTION gb_distribute_rewards(p_type text, p_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.gb_distribute_rewards(p_type text, p_id uuid) TO anon;
GRANT ALL ON FUNCTION public.gb_distribute_rewards(p_type text, p_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.gb_distribute_rewards(p_type text, p_id uuid) TO service_role;


--
-- Name: FUNCTION generate_friend_code(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_friend_code() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_friend_code() TO authenticated;
GRANT ALL ON FUNCTION public.generate_friend_code() TO service_role;


--
-- Name: FUNCTION generate_guest_username(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_guest_username() FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_guest_username() TO authenticated;
GRANT ALL ON FUNCTION public.generate_guest_username() TO service_role;


--
-- Name: FUNCTION generate_random_string(length integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.generate_random_string(length integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.generate_random_string(length integer) TO authenticated;
GRANT ALL ON FUNCTION public.generate_random_string(length integer) TO service_role;


--
-- Name: FUNCTION get_available_bookmakers(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_available_bookmakers() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_available_bookmakers() TO authenticated;
GRANT ALL ON FUNCTION public.get_available_bookmakers() TO service_role;


--
-- Name: FUNCTION get_available_fantasy_players(p_game_week_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_available_fantasy_players(p_game_week_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_available_fantasy_players(p_game_week_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_available_fantasy_players(p_game_week_id uuid) TO service_role;


--
-- Name: FUNCTION get_coin_balance(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_coin_balance(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_coin_balance(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_coin_balance(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_fantasy_gameweek_player_stats(p_game_week_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_fantasy_gameweek_player_stats(p_game_week_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_fantasy_gameweek_player_stats(p_game_week_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_fantasy_gameweek_player_stats(p_game_week_id uuid) TO service_role;


--
-- Name: FUNCTION get_fantasy_player_stats(p_player_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_fantasy_player_stats(p_player_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_fantasy_player_stats(p_player_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_fantasy_player_stats(p_player_id uuid) TO service_role;


--
-- Name: FUNCTION get_level_by_xp(p_xp_total integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_level_by_xp(p_xp_total integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_level_by_xp(p_xp_total integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_level_by_xp(p_xp_total integer) TO service_role;


--
-- Name: FUNCTION get_live_game_state(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_live_game_state(p_game_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_live_game_state(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_live_game_state(p_game_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_live_game_state(p_game_id uuid) TO anon;


--
-- Name: FUNCTION get_matches(p_date text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_matches(p_date text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_matches(p_date text) TO authenticated;
GRANT ALL ON FUNCTION public.get_matches(p_date text) TO service_role;


--
-- Name: FUNCTION get_notification_preferences(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_notification_preferences(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_notification_preferences(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_notification_preferences(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_or_create_matchday_participant(p_matchday_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_or_create_matchday_participant(p_matchday_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_or_create_matchday_participant(p_matchday_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_or_create_matchday_participant(p_matchday_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_pgs_category(p_pgs numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_pgs_category(p_pgs numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_pgs_category(p_pgs numeric) TO authenticated;
GRANT ALL ON FUNCTION public.get_pgs_category(p_pgs numeric) TO service_role;


--
-- Name: FUNCTION get_player_transfer_history(p_player_id uuid, p_season integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_player_transfer_history(p_player_id uuid, p_season integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_player_transfer_history(p_player_id uuid, p_season integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_player_transfer_history(p_player_id uuid, p_season integer) TO service_role;


--
-- Name: FUNCTION get_prediction_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_prediction_stats(p_user_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_prediction_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_prediction_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_recent_fixture_changes(p_days_back integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_recent_fixture_changes(p_days_back integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_recent_fixture_changes(p_days_back integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_recent_fixture_changes(p_days_back integer) TO service_role;


--
-- Name: FUNCTION get_spin_history(p_user_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_spin_history(p_user_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_spin_history(p_user_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_spin_history(p_user_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_squad_live_games(p_squad_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.get_squad_live_games(p_squad_id uuid) TO anon;
GRANT ALL ON FUNCTION public.get_squad_live_games(p_squad_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_squad_live_games(p_squad_id uuid) TO service_role;


--
-- Name: FUNCTION get_ticket_counts(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_ticket_counts(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_ticket_counts(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_ticket_counts(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_ticket_rules(p_ticket_type public.ticket_type); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_ticket_rules(p_ticket_type public.ticket_type) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_ticket_rules(p_ticket_type public.ticket_type) TO authenticated;
GRANT ALL ON FUNCTION public.get_ticket_rules(p_ticket_type public.ticket_type) TO service_role;


--
-- Name: FUNCTION get_top_players_by_pgs(p_season integer, p_league_id uuid, p_limit integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_top_players_by_pgs(p_season integer, p_league_id uuid, p_limit integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_top_players_by_pgs(p_season integer, p_league_id uuid, p_limit integer) TO authenticated;
GRANT ALL ON FUNCTION public.get_top_players_by_pgs(p_season integer, p_league_id uuid, p_limit integer) TO service_role;


--
-- Name: FUNCTION get_user_fantasy_team_with_players(p_user_id uuid, p_game_week_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_fantasy_team_with_players(p_user_id uuid, p_game_week_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_fantasy_team_with_players(p_user_id uuid, p_game_week_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_fantasy_team_with_players(p_user_id uuid, p_game_week_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_leagues(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_leagues() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_leagues() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_leagues() TO service_role;


--
-- Name: FUNCTION get_user_live_game_limits(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_live_game_limits(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_live_game_limits(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_live_game_limits(p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.get_user_live_game_limits(p_user_id uuid) TO anon;


--
-- Name: FUNCTION get_user_live_games(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_live_games(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_live_games(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_live_games(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_profile_stats(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_profile_stats(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_profile_stats(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_profile_stats(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_progression_summary(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_progression_summary(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_progression_summary(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_progression_summary(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_role(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_role() FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_role() TO authenticated;
GRANT ALL ON FUNCTION public.get_user_role() TO service_role;


--
-- Name: FUNCTION get_user_spin_state(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_spin_state(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_spin_state(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_spin_state(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_squad_ids(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_squad_ids(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_squad_ids(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_squad_ids(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION get_user_tickets(p_user_id uuid, p_ticket_type public.ticket_type, p_include_expired boolean, p_include_used boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_user_tickets(p_user_id uuid, p_ticket_type public.ticket_type, p_include_expired boolean, p_include_used boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_user_tickets(p_user_id uuid, p_ticket_type public.ticket_type, p_include_expired boolean, p_include_used boolean) TO authenticated;
GRANT ALL ON FUNCTION public.get_user_tickets(p_user_id uuid, p_ticket_type public.ticket_type, p_include_expired boolean, p_include_used boolean) TO service_role;


--
-- Name: FUNCTION get_week_start(p_date timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.get_week_start(p_date timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.get_week_start(p_date timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.get_week_start(p_date timestamp with time zone) TO service_role;


--
-- Name: FUNCTION grant_spin(p_user_id uuid, p_tier text, p_quantity integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.grant_spin(p_user_id uuid, p_tier text, p_quantity integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_spin(p_user_id uuid, p_tier text, p_quantity integer) TO authenticated;
GRANT ALL ON FUNCTION public.grant_spin(p_user_id uuid, p_tier text, p_quantity integer) TO service_role;


--
-- Name: FUNCTION grant_ticket(p_user_id uuid, p_ticket_type public.ticket_type, p_granted_reason text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.grant_ticket(p_user_id uuid, p_ticket_type public.ticket_type, p_granted_reason text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.grant_ticket(p_user_id uuid, p_ticket_type public.ticket_type, p_granted_reason text) TO authenticated;
GRANT ALL ON FUNCTION public.grant_ticket(p_user_id uuid, p_ticket_type public.ticket_type, p_granted_reason text) TO service_role;


--
-- Name: FUNCTION handle_new_league(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_league() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_league() TO service_role;


--
-- Name: FUNCTION handle_new_user(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_new_user() TO service_role;


--
-- Name: FUNCTION handle_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.handle_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.handle_updated_at() TO service_role;


--
-- Name: FUNCTION initialize_spin_state(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.initialize_spin_state() FROM PUBLIC;
GRANT ALL ON FUNCTION public.initialize_spin_state() TO service_role;


--
-- Name: FUNCTION is_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_admin() TO service_role;


--
-- Name: FUNCTION is_league_member(p_league_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_league_member(p_league_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_league_member(p_league_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_league_member(p_league_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_squad_admin(p_squad_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_squad_admin(p_squad_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_squad_admin(p_squad_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.is_squad_admin(p_squad_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION is_super_admin(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.is_super_admin() FROM PUBLIC;
GRANT ALL ON FUNCTION public.is_super_admin() TO authenticated;
GRANT ALL ON FUNCTION public.is_super_admin() TO service_role;


--
-- Name: FUNCTION join_betting_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_betting_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_betting_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_betting_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO service_role;


--
-- Name: FUNCTION join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.join_fantasy_game(p_game_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO anon;


--
-- Name: FUNCTION join_live_game(p_game_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_live_game(p_game_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_live_game(p_game_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_live_game(p_game_id uuid, p_user_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.join_live_game(p_game_id uuid, p_user_id uuid) TO anon;


--
-- Name: FUNCTION join_squad(p_user_id uuid, p_invite_code text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_squad(p_user_id uuid, p_invite_code text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_squad(p_user_id uuid, p_invite_code text) TO authenticated;
GRANT ALL ON FUNCTION public.join_squad(p_user_id uuid, p_invite_code text) TO service_role;


--
-- Name: FUNCTION join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.join_swipe_challenge(p_challenge_id uuid, p_user_id uuid, p_method text, p_ticket_id uuid) TO anon;


--
-- Name: FUNCTION lf_get_game(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_get_game(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_get_game(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_get_game(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION lf_lock(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_lock(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_lock(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_lock(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION lf_notify_me(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_notify_me(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_notify_me(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_notify_me(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION lf_player_points(p_game_id uuid, p_player_id uuid, p_pos text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_player_points(p_game_id uuid, p_player_id uuid, p_pos text) TO anon;
GRANT ALL ON FUNCTION public.lf_player_points(p_game_id uuid, p_player_id uuid, p_pos text) TO authenticated;
GRANT ALL ON FUNCTION public.lf_player_points(p_game_id uuid, p_player_id uuid, p_pos text) TO service_role;


--
-- Name: FUNCTION lf_recalc(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_recalc(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_recalc(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_recalc(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION lf_resolve_pot(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_resolve_pot(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_resolve_pot(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_resolve_pot(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION lf_results(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_results(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_results(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_results(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION lf_save_team(p_game_id uuid, p_gk uuid, p_outfield uuid[], p_captain uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_save_team(p_game_id uuid, p_gk uuid, p_outfield uuid[], p_captain uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_save_team(p_game_id uuid, p_gk uuid, p_outfield uuid[], p_captain uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_save_team(p_game_id uuid, p_gk uuid, p_outfield uuid[], p_captain uuid) TO service_role;


--
-- Name: FUNCTION lf_settle(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_settle(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_settle(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_settle(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION lf_sync_pool(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_sync_pool(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_sync_pool(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_sync_pool(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION lf_tick(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_tick(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_tick(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_tick(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION lf_tick_all(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_tick_all() TO anon;
GRANT ALL ON FUNCTION public.lf_tick_all() TO authenticated;
GRANT ALL ON FUNCTION public.lf_tick_all() TO service_role;


--
-- Name: FUNCTION lf_transfer(p_game_id uuid, p_out uuid, p_in uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lf_transfer(p_game_id uuid, p_out uuid, p_in uuid) TO anon;
GRANT ALL ON FUNCTION public.lf_transfer(p_game_id uuid, p_out uuid, p_in uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lf_transfer(p_game_id uuid, p_out uuid, p_in uuid) TO service_role;


--
-- Name: FUNCTION link_game_to_squads(p_user_id uuid, p_game_id uuid, p_game_type text, p_squad_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.link_game_to_squads(p_user_id uuid, p_game_id uuid, p_game_type text, p_squad_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.link_game_to_squads(p_user_id uuid, p_game_id uuid, p_game_type text, p_squad_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.link_game_to_squads(p_user_id uuid, p_game_id uuid, p_game_type text, p_squad_ids uuid[]) TO service_role;


--
-- Name: FUNCTION live_bonus_correct(p_key text, p_pred jsonb, p_gh integer, p_ga integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.live_bonus_correct(p_key text, p_pred jsonb, p_gh integer, p_ga integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.live_bonus_correct(p_key text, p_pred jsonb, p_gh integer, p_ga integer) TO authenticated;
GRANT ALL ON FUNCTION public.live_bonus_correct(p_key text, p_pred jsonb, p_gh integer, p_ga integer) TO service_role;


--
-- Name: FUNCTION live_bonus_subpool(sit text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.live_bonus_subpool(sit text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.live_bonus_subpool(sit text) TO authenticated;
GRANT ALL ON FUNCTION public.live_bonus_subpool(sit text) TO service_role;


--
-- Name: FUNCTION live_results_index(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.live_results_index(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.live_results_index(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.live_results_index(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION live_situation(h integer, a integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.live_situation(h integer, a integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.live_situation(h integer, a integer) TO authenticated;
GRANT ALL ON FUNCTION public.live_situation(h integer, a integer) TO service_role;


--
-- Name: FUNCTION lp_results(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.lp_results(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.lp_results(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.lp_results(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION match_bet_limit_for_level(p_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.match_bet_limit_for_level(p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.match_bet_limit_for_level(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.match_bet_limit_for_level(p_level text) TO service_role;


--
-- Name: FUNCTION match_players_by_name(p_names text[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.match_players_by_name(p_names text[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.match_players_by_name(p_names text[]) TO authenticated;
GRANT ALL ON FUNCTION public.match_players_by_name(p_names text[]) TO service_role;


--
-- Name: FUNCTION mr_answer(p_question_id uuid, p_option text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_answer(p_question_id uuid, p_option text) TO anon;
GRANT ALL ON FUNCTION public.mr_answer(p_question_id uuid, p_option text) TO authenticated;
GRANT ALL ON FUNCTION public.mr_answer(p_question_id uuid, p_option text) TO service_role;


--
-- Name: FUNCTION mr_autocreate_games(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_autocreate_games() TO anon;
GRANT ALL ON FUNCTION public.mr_autocreate_games() TO authenticated;
GRANT ALL ON FUNCTION public.mr_autocreate_games() TO service_role;


--
-- Name: FUNCTION mr_create_game(p_fixture_id uuid, p_name text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_create_game(p_fixture_id uuid, p_name text) TO anon;
GRANT ALL ON FUNCTION public.mr_create_game(p_fixture_id uuid, p_name text) TO authenticated;
GRANT ALL ON FUNCTION public.mr_create_game(p_fixture_id uuid, p_name text) TO service_role;


--
-- Name: FUNCTION mr_finalize(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_finalize(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_finalize(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_finalize(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION mr_game_counts(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_game_counts(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_game_counts(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_game_counts(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION mr_gen_questions(p_game_id uuid, p_phase text, p_half integer, p_count integer, p_start_seq integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_gen_questions(p_game_id uuid, p_phase text, p_half integer, p_count integer, p_start_seq integer) TO anon;
GRANT ALL ON FUNCTION public.mr_gen_questions(p_game_id uuid, p_phase text, p_half integer, p_count integer, p_start_seq integer) TO authenticated;
GRANT ALL ON FUNCTION public.mr_gen_questions(p_game_id uuid, p_phase text, p_half integer, p_count integer, p_start_seq integer) TO service_role;


--
-- Name: FUNCTION mr_join(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_join(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_join(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_join(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION mr_question_stats(p_question_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_question_stats(p_question_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_question_stats(p_question_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_question_stats(p_question_id uuid) TO service_role;


--
-- Name: FUNCTION mr_resolve(p_game_id uuid, p_force_end boolean); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_resolve(p_game_id uuid, p_force_end boolean) TO anon;
GRANT ALL ON FUNCTION public.mr_resolve(p_game_id uuid, p_force_end boolean) TO authenticated;
GRANT ALL ON FUNCTION public.mr_resolve(p_game_id uuid, p_force_end boolean) TO service_role;


--
-- Name: FUNCTION mr_resolve_pot(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_resolve_pot(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_resolve_pot(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_resolve_pot(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION mr_results(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_results(p_fixture_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_results(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_results(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION mr_snapshot_baselines(p_game_id uuid, p_phase text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_snapshot_baselines(p_game_id uuid, p_phase text) TO anon;
GRANT ALL ON FUNCTION public.mr_snapshot_baselines(p_game_id uuid, p_phase text) TO authenticated;
GRANT ALL ON FUNCTION public.mr_snapshot_baselines(p_game_id uuid, p_phase text) TO service_role;


--
-- Name: FUNCTION mr_source_key(p_catalog_key text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_source_key(p_catalog_key text) TO anon;
GRANT ALL ON FUNCTION public.mr_source_key(p_catalog_key text) TO authenticated;
GRANT ALL ON FUNCTION public.mr_source_key(p_catalog_key text) TO service_role;


--
-- Name: FUNCTION mr_tick(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_tick(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.mr_tick(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.mr_tick(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION mr_tick_all(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.mr_tick_all() TO anon;
GRANT ALL ON FUNCTION public.mr_tick_all() TO authenticated;
GRANT ALL ON FUNCTION public.mr_tick_all() TO service_role;


--
-- Name: FUNCTION normalize_name(name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.normalize_name(name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.normalize_name(name text) TO authenticated;
GRANT ALL ON FUNCTION public.normalize_name(name text) TO service_role;


--
-- Name: FUNCTION on_swipe_prediction_change(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.on_swipe_prediction_change() FROM PUBLIC;
GRANT ALL ON FUNCTION public.on_swipe_prediction_change() TO service_role;


--
-- Name: FUNCTION participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer) TO authenticated;
GRANT ALL ON FUNCTION public.participant_qualifies_for_reward(p_rank integer, p_total_participants integer, p_position_type text, p_tier_start integer, p_tier_end integer) TO service_role;


--
-- Name: FUNCTION place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb, p_entry_method text, p_ticket_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb, p_entry_method text, p_ticket_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb, p_entry_method text, p_ticket_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb, p_entry_method text, p_ticket_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.place_challenge_bets(p_challenge_id uuid, p_user_id uuid, p_day_number integer, p_bets jsonb, p_booster jsonb, p_entry_method text, p_ticket_id uuid) TO anon;


--
-- Name: FUNCTION place_match_bet(p_fixture_id uuid, p_prediction text, p_amount integer, p_odds numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.place_match_bet(p_fixture_id uuid, p_prediction text, p_amount integer, p_odds numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.place_match_bet(p_fixture_id uuid, p_prediction text, p_amount integer, p_odds numeric) TO authenticated;
GRANT ALL ON FUNCTION public.place_match_bet(p_fixture_id uuid, p_prediction text, p_amount integer, p_odds numeric) TO service_role;


--
-- Name: FUNCTION place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text) TO authenticated;
GRANT ALL ON FUNCTION public.place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text) TO service_role;
GRANT ALL ON FUNCTION public.place_swipe_prediction(p_challenge_id uuid, p_matchday_id uuid, p_user_id uuid, p_fixture_id uuid, p_prediction text) TO anon;


--
-- Name: FUNCTION premium_cfg_int(p_key text, p_default integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.premium_cfg_int(p_key text, p_default integer) TO anon;
GRANT ALL ON FUNCTION public.premium_cfg_int(p_key text, p_default integer) TO authenticated;
GRANT ALL ON FUNCTION public.premium_cfg_int(p_key text, p_default integer) TO service_role;


--
-- Name: FUNCTION premium_daily_claim(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.premium_daily_claim() TO anon;
GRANT ALL ON FUNCTION public.premium_daily_claim() TO authenticated;
GRANT ALL ON FUNCTION public.premium_daily_claim() TO service_role;


--
-- Name: FUNCTION puzzle_admin_reset_plays(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_admin_reset_plays() TO anon;
GRANT ALL ON FUNCTION public.puzzle_admin_reset_plays() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_admin_reset_plays() TO service_role;


--
-- Name: FUNCTION puzzle_current_date(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_current_date() TO anon;
GRANT ALL ON FUNCTION public.puzzle_current_date() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_current_date() TO service_role;


--
-- Name: FUNCTION puzzle_distribute_daily(p_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_distribute_daily(p_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_distribute_daily(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_distribute_daily(p_date date) TO service_role;


--
-- Name: FUNCTION puzzle_finish(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_finish(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.puzzle_finish(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_finish(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION puzzle_finish_player(p_game_id uuid, p_rounds_solved integer, p_time_ms integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_finish_player(p_game_id uuid, p_rounds_solved integer, p_time_ms integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_finish_player(p_game_id uuid, p_rounds_solved integer, p_time_ms integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_finish_player(p_game_id uuid, p_rounds_solved integer, p_time_ms integer) TO service_role;


--
-- Name: FUNCTION puzzle_generate_guess_player(p_level text, p_count integer, p_start_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_generate_guess_player(p_level text, p_count integer, p_start_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_generate_guess_player(p_level text, p_count integer, p_start_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_generate_guess_player(p_level text, p_count integer, p_start_date date) TO service_role;


--
-- Name: FUNCTION puzzle_generate_guess_score(p_level text, p_count integer, p_start_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_generate_guess_score(p_level text, p_count integer, p_start_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_generate_guess_score(p_level text, p_count integer, p_start_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_generate_guess_score(p_level text, p_count integer, p_start_date date) TO service_role;


--
-- Name: FUNCTION puzzle_generate_player_tm(p_scope text, p_count integer, p_start_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_generate_player_tm(p_scope text, p_count integer, p_start_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_generate_player_tm(p_scope text, p_count integer, p_start_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_generate_player_tm(p_scope text, p_count integer, p_start_date date) TO service_role;


--
-- Name: FUNCTION puzzle_get_today(p_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today(p_level text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today(p_level text) TO service_role;


--
-- Name: FUNCTION puzzle_get_today_connections(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_connections() TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_connections() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_connections() TO service_role;


--
-- Name: FUNCTION puzzle_get_today_grid(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_grid() TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_grid() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_grid() TO service_role;


--
-- Name: FUNCTION puzzle_get_today_grid(p_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_grid(p_level text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_grid(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_grid(p_level text) TO service_role;


--
-- Name: FUNCTION puzzle_get_today_hl(p_criterion text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_hl(p_criterion text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_hl(p_criterion text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_hl(p_criterion text) TO service_role;


--
-- Name: FUNCTION puzzle_get_today_lineup(p_scope text, p_holes integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_lineup(p_scope text, p_holes integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_lineup(p_scope text, p_holes integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_lineup(p_scope text, p_holes integer) TO service_role;


--
-- Name: FUNCTION puzzle_get_today_player(p_scope text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_player(p_scope text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_player(p_scope text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_player(p_scope text) TO service_role;


--
-- Name: FUNCTION puzzle_get_today_rapid(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_rapid() TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_rapid() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_rapid() TO service_role;


--
-- Name: FUNCTION puzzle_get_today_rapid(p_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_get_today_rapid(p_level text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_get_today_rapid(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_get_today_rapid(p_level text) TO service_role;


--
-- Name: FUNCTION puzzle_giveup_player(p_game_id uuid, p_round_no integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_giveup_player(p_game_id uuid, p_round_no integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_giveup_player(p_game_id uuid, p_round_no integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_giveup_player(p_game_id uuid, p_round_no integer) TO service_role;


--
-- Name: FUNCTION puzzle_grant_monthly(p_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_grant_monthly(p_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_grant_monthly(p_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_grant_monthly(p_date date) TO service_role;


--
-- Name: FUNCTION puzzle_grid_index(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_grid_index() TO anon;
GRANT ALL ON FUNCTION public.puzzle_grid_index() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_grid_index() TO service_role;


--
-- Name: FUNCTION puzzle_guess(p_game_id uuid, p_round_no integer, p_home integer, p_away integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_guess(p_game_id uuid, p_round_no integer, p_home integer, p_away integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_guess(p_game_id uuid, p_round_no integer, p_home integer, p_away integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_guess(p_game_id uuid, p_round_no integer, p_home integer, p_away integer) TO service_role;


--
-- Name: FUNCTION puzzle_guess_player(p_game_id uuid, p_round_no integer, p_player_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_guess_player(p_game_id uuid, p_round_no integer, p_player_id bigint) TO anon;
GRANT ALL ON FUNCTION public.puzzle_guess_player(p_game_id uuid, p_round_no integer, p_player_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_guess_player(p_game_id uuid, p_round_no integer, p_player_id bigint) TO service_role;


--
-- Name: FUNCTION puzzle_heat(gh integer, ga integer, ah integer, aa integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_heat(gh integer, ga integer, ah integer, aa integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_heat(gh integer, ga integer, ah integer, aa integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_heat(gh integer, ga integer, ah integer, aa integer) TO service_role;


--
-- Name: FUNCTION puzzle_hints(h integer, a integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_hints(h integer, a integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_hints(h integer, a integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_hints(h integer, a integer) TO service_role;


--
-- Name: FUNCTION puzzle_lineup_index(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_lineup_index() TO anon;
GRANT ALL ON FUNCTION public.puzzle_lineup_index() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_lineup_index() TO service_role;


--
-- Name: FUNCTION puzzle_my_stats(p_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_my_stats(p_level text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_my_stats(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_my_stats(p_level text) TO service_role;


--
-- Name: FUNCTION puzzle_my_stats(p_scope text, p_game_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_my_stats(p_scope text, p_game_type text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_my_stats(p_scope text, p_game_type text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_my_stats(p_scope text, p_game_type text) TO service_role;


--
-- Name: FUNCTION puzzle_player_index(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_player_index() TO anon;
GRANT ALL ON FUNCTION public.puzzle_player_index() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_player_index() TO service_role;


--
-- Name: FUNCTION puzzle_player_trail(p_player bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_player_trail(p_player bigint) TO anon;
GRANT ALL ON FUNCTION public.puzzle_player_trail(p_player bigint) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_player_trail(p_player bigint) TO service_role;


--
-- Name: FUNCTION puzzle_replay(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_replay(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.puzzle_replay(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_replay(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION puzzle_reschedule(p_game_id uuid, p_new_date date); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_reschedule(p_game_id uuid, p_new_date date) TO anon;
GRANT ALL ON FUNCTION public.puzzle_reschedule(p_game_id uuid, p_new_date date) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_reschedule(p_game_id uuid, p_new_date date) TO service_role;


--
-- Name: FUNCTION puzzle_reveal_letters(p_game_id uuid, p_round_no integer, p_n integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_reveal_letters(p_game_id uuid, p_round_no integer, p_n integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_reveal_letters(p_game_id uuid, p_round_no integer, p_n integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_reveal_letters(p_game_id uuid, p_round_no integer, p_n integer) TO service_role;


--
-- Name: FUNCTION puzzle_set_level(p_level text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_set_level(p_level text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_set_level(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_set_level(p_level text) TO service_role;


--
-- Name: FUNCTION puzzle_set_prefs(p_scope text, p_hint text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text) TO service_role;


--
-- Name: FUNCTION puzzle_set_prefs(p_scope text, p_hint text, p_game_type text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text, p_game_type text) TO anon;
GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text, p_game_type text) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_set_prefs(p_scope text, p_hint text, p_game_type text) TO service_role;


--
-- Name: FUNCTION puzzle_start(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_start(p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.puzzle_start(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_start(p_game_id uuid) TO service_role;


--
-- Name: FUNCTION puzzle_submit_hl(p_game_id uuid, p_streak integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_submit_hl(p_game_id uuid, p_streak integer) TO anon;
GRANT ALL ON FUNCTION public.puzzle_submit_hl(p_game_id uuid, p_streak integer) TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_submit_hl(p_game_id uuid, p_streak integer) TO service_role;


--
-- Name: FUNCTION puzzle_value_index(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.puzzle_value_index() TO anon;
GRANT ALL ON FUNCTION public.puzzle_value_index() TO authenticated;
GRANT ALL ON FUNCTION public.puzzle_value_index() TO service_role;


--
-- Name: FUNCTION recalc_challenge_participant(p_challenge_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalc_challenge_participant(p_challenge_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalc_challenge_participant(p_challenge_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalc_challenge_participant(p_challenge_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION recalculate_all_challenge_points(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalculate_all_challenge_points(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalculate_all_challenge_points(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_all_challenge_points(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION recalculate_challenge_points(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.recalculate_challenge_points(p_challenge_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.record_spin(p_user_id uuid, p_tier public.spin_tier, p_reward_id text, p_reward_label text, p_reward_category text, p_reward_value text, p_was_pity boolean, p_final_chances jsonb) TO service_role;


--
-- Name: FUNCTION refresh_user_daily_hpi(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refresh_user_daily_hpi() FROM PUBLIC;
GRANT ALL ON FUNCTION public.refresh_user_daily_hpi() TO authenticated;
GRANT ALL ON FUNCTION public.refresh_user_daily_hpi() TO service_role;


--
-- Name: FUNCTION refund_challenge_entry(p_challenge_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.refund_challenge_entry(p_challenge_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.refund_challenge_entry(p_challenge_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.refund_challenge_entry(p_challenge_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION remove_name_suffixes(name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.remove_name_suffixes(name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.remove_name_suffixes(name text) TO authenticated;
GRANT ALL ON FUNCTION public.remove_name_suffixes(name text) TO service_role;


--
-- Name: TABLE fb_fixture_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_fixture_stats TO anon;
GRANT ALL ON TABLE public.fb_fixture_stats TO authenticated;
GRANT ALL ON TABLE public.fb_fixture_stats TO service_role;


--
-- Name: FUNCTION resolve_live_bonus(p_key text, s public.fb_fixture_stats); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.resolve_live_bonus(p_key text, s public.fb_fixture_stats) FROM PUBLIC;
GRANT ALL ON FUNCTION public.resolve_live_bonus(p_key text, s public.fb_fixture_stats) TO authenticated;
GRANT ALL ON FUNCTION public.resolve_live_bonus(p_key text, s public.fb_fixture_stats) TO service_role;


--
-- Name: FUNCTION seed_team_popularity(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.seed_team_popularity() TO anon;
GRANT ALL ON FUNCTION public.seed_team_popularity() TO authenticated;
GRANT ALL ON FUNCTION public.seed_team_popularity() TO service_role;


--
-- Name: FUNCTION set_preferred_bookmaker(p_bookmaker_name text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_preferred_bookmaker(p_bookmaker_name text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_preferred_bookmaker(p_bookmaker_name text) TO authenticated;
GRANT ALL ON FUNCTION public.set_preferred_bookmaker(p_bookmaker_name text) TO service_role;


--
-- Name: FUNCTION set_subscription(p_user_id uuid, p_active boolean, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_subscription(p_user_id uuid, p_active boolean, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_subscription(p_user_id uuid, p_active boolean, p_expires_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION set_user_role(p_user_id uuid, p_role public.user_role_enum); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.set_user_role(p_user_id uuid, p_role public.user_role_enum) FROM PUBLIC;
GRANT ALL ON FUNCTION public.set_user_role(p_user_id uuid, p_role public.user_role_enum) TO authenticated;
GRANT ALL ON FUNCTION public.set_user_role(p_user_id uuid, p_role public.user_role_enum) TO service_role;
GRANT ALL ON FUNCTION public.set_user_role(p_user_id uuid, p_role public.user_role_enum) TO anon;


--
-- Name: FUNCTION settle_challenge_bets_for_fixture(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_challenge_bets_for_fixture(p_fixture_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_challenge_bets_for_fixture(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.settle_challenge_bets_for_fixture(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION settle_finished_live_score_games(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_finished_live_score_games() FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_finished_live_score_games() TO authenticated;
GRANT ALL ON FUNCTION public.settle_finished_live_score_games() TO service_role;


--
-- Name: FUNCTION settle_finished_unsettled_bets(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_finished_unsettled_bets() FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_finished_unsettled_bets() TO authenticated;
GRANT ALL ON FUNCTION public.settle_finished_unsettled_bets() TO service_role;


--
-- Name: FUNCTION settle_finished_unsettled_predictions(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_finished_unsettled_predictions() FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_finished_unsettled_predictions() TO authenticated;
GRANT ALL ON FUNCTION public.settle_finished_unsettled_predictions() TO service_role;


--
-- Name: FUNCTION settle_live_game_score(p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_live_game_score(p_game_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_live_game_score(p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.settle_live_game_score(p_game_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.settle_live_game_score(p_game_id uuid) TO anon;


--
-- Name: FUNCTION settle_match_bets(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_match_bets(p_fixture_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_match_bets(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.settle_match_bets(p_fixture_id uuid) TO service_role;


--
-- Name: FUNCTION settle_swipe_predictions_for_fixture(p_fixture_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id uuid) TO service_role;
GRANT ALL ON FUNCTION public.settle_swipe_predictions_for_fixture(p_fixture_id uuid) TO anon;


--
-- Name: FUNCTION spin_wheel(p_tier text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.spin_wheel(p_tier text) TO anon;
GRANT ALL ON FUNCTION public.spin_wheel(p_tier text) TO authenticated;
GRANT ALL ON FUNCTION public.spin_wheel(p_tier text) TO service_role;


--
-- Name: FUNCTION squad_block_member(p_actor uuid, p_squad_id uuid, p_target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.squad_block_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO anon;
GRANT ALL ON FUNCTION public.squad_block_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.squad_block_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO service_role;


--
-- Name: FUNCTION squad_remove_member(p_actor uuid, p_squad_id uuid, p_target uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.squad_remove_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO anon;
GRANT ALL ON FUNCTION public.squad_remove_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO authenticated;
GRANT ALL ON FUNCTION public.squad_remove_member(p_actor uuid, p_squad_id uuid, p_target uuid) TO service_role;


--
-- Name: FUNCTION squad_set_member_role(p_actor uuid, p_squad_id uuid, p_target uuid, p_role text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.squad_set_member_role(p_actor uuid, p_squad_id uuid, p_target uuid, p_role text) TO anon;
GRANT ALL ON FUNCTION public.squad_set_member_role(p_actor uuid, p_squad_id uuid, p_target uuid, p_role text) TO authenticated;
GRANT ALL ON FUNCTION public.squad_set_member_role(p_actor uuid, p_squad_id uuid, p_target uuid, p_role text) TO service_role;


--
-- Name: FUNCTION submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb) FROM PUBLIC;
GRANT ALL ON FUNCTION public.submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb) TO service_role;
GRANT ALL ON FUNCTION public.submit_live_prediction(p_game_id uuid, p_user_id uuid, p_home integer, p_away integer, p_questions jsonb, p_answers jsonb) TO anon;


--
-- Name: FUNCTION swipe_set_booster(p_challenge_id uuid, p_matchday_id uuid, p_fixture_id uuid, p_booster text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.swipe_set_booster(p_challenge_id uuid, p_matchday_id uuid, p_fixture_id uuid, p_booster text) TO anon;
GRANT ALL ON FUNCTION public.swipe_set_booster(p_challenge_id uuid, p_matchday_id uuid, p_fixture_id uuid, p_booster text) TO authenticated;
GRANT ALL ON FUNCTION public.swipe_set_booster(p_challenge_id uuid, p_matchday_id uuid, p_fixture_id uuid, p_booster text) TO service_role;


--
-- Name: FUNCTION sync_fb_odds_to_odds(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_fb_odds_to_odds() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_fb_odds_to_odds() TO service_role;


--
-- Name: FUNCTION sync_preferred_bookmaker_odds(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_preferred_bookmaker_odds() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_preferred_bookmaker_odds() TO authenticated;
GRANT ALL ON FUNCTION public.sync_preferred_bookmaker_odds() TO service_role;


--
-- Name: FUNCTION sync_user_role_flags(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.sync_user_role_flags() FROM PUBLIC;
GRANT ALL ON FUNCTION public.sync_user_role_flags() TO service_role;


--
-- Name: FUNCTION tm_player_trail(p_player_id bigint); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tm_player_trail(p_player_id bigint) TO anon;
GRANT ALL ON FUNCTION public.tm_player_trail(p_player_id bigint) TO authenticated;
GRANT ALL ON FUNCTION public.tm_player_trail(p_player_id bigint) TO service_role;


--
-- Name: FUNCTION tq_admin_advance_round(p_comp uuid, p_from text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_admin_advance_round(p_comp uuid, p_from text) TO anon;
GRANT ALL ON FUNCTION public.tq_admin_advance_round(p_comp uuid, p_from text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_admin_advance_round(p_comp uuid, p_from text) TO service_role;


--
-- Name: FUNCTION tq_admin_generate_bracket(p_comp uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_admin_generate_bracket(p_comp uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_admin_generate_bracket(p_comp uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_admin_generate_bracket(p_comp uuid) TO service_role;


--
-- Name: FUNCTION tq_admin_import_groups(p_comp uuid, p_spec jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_admin_import_groups(p_comp uuid, p_spec jsonb) TO anon;
GRANT ALL ON FUNCTION public.tq_admin_import_groups(p_comp uuid, p_spec jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.tq_admin_import_groups(p_comp uuid, p_spec jsonb) TO service_role;


--
-- Name: FUNCTION tq_admin_resolve(p_comp uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_admin_resolve(p_comp uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_admin_resolve(p_comp uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_admin_resolve(p_comp uuid) TO service_role;


--
-- Name: FUNCTION tq_advance_round(p_comp uuid, p_from text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_advance_round(p_comp uuid, p_from text) TO anon;
GRANT ALL ON FUNCTION public.tq_advance_round(p_comp uuid, p_from text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_advance_round(p_comp uuid, p_from text) TO service_role;


--
-- Name: FUNCTION tq_claim_masterpass_invite(p_token text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_claim_masterpass_invite(p_token text) TO anon;
GRANT ALL ON FUNCTION public.tq_claim_masterpass_invite(p_token text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_claim_masterpass_invite(p_token text) TO service_role;


--
-- Name: FUNCTION tq_detect_format(p_competition_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_detect_format(p_competition_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_detect_format(p_competition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_detect_format(p_competition_id uuid) TO service_role;


--
-- Name: FUNCTION tq_generate_bracket(p_comp uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_generate_bracket(p_comp uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_generate_bracket(p_comp uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_generate_bracket(p_comp uuid) TO service_role;


--
-- Name: FUNCTION tq_get_or_create_entry(p_comp uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_get_or_create_entry(p_comp uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_get_or_create_entry(p_comp uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_get_or_create_entry(p_comp uuid) TO service_role;


--
-- Name: TABLE tq_entries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_entries TO anon;
GRANT ALL ON TABLE public.tq_entries TO authenticated;
GRANT ALL ON TABLE public.tq_entries TO service_role;


--
-- Name: FUNCTION tq_join_competition(p_user_id uuid, p_competition_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_join_competition(p_user_id uuid, p_competition_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_join_competition(p_user_id uuid, p_competition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_join_competition(p_user_id uuid, p_competition_id uuid) TO service_role;


--
-- Name: FUNCTION tq_masterpass_invite_username(p_invite_id uuid, p_username text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_masterpass_invite_username(p_invite_id uuid, p_username text) TO anon;
GRANT ALL ON FUNCTION public.tq_masterpass_invite_username(p_invite_id uuid, p_username text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_masterpass_invite_username(p_invite_id uuid, p_username text) TO service_role;


--
-- Name: FUNCTION tq_phase_open(p_comp uuid, p_phase text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_phase_open(p_comp uuid, p_phase text) TO anon;
GRANT ALL ON FUNCTION public.tq_phase_open(p_comp uuid, p_phase text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_phase_open(p_comp uuid, p_phase text) TO service_role;


--
-- Name: FUNCTION tq_recalc_leaderboard(p_competition_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_recalc_leaderboard(p_competition_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_recalc_leaderboard(p_competition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_recalc_leaderboard(p_competition_id uuid) TO service_role;


--
-- Name: FUNCTION tq_resolve(p_competition_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_resolve(p_competition_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_resolve(p_competition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_resolve(p_competition_id uuid) TO service_role;


--
-- Name: FUNCTION tq_rounds_for(p_participants integer); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_rounds_for(p_participants integer) TO anon;
GRANT ALL ON FUNCTION public.tq_rounds_for(p_participants integer) TO authenticated;
GRANT ALL ON FUNCTION public.tq_rounds_for(p_participants integer) TO service_role;


--
-- Name: FUNCTION tq_save_bracket_prediction(p_comp uuid, p_round_key text, p_team_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_save_bracket_prediction(p_comp uuid, p_round_key text, p_team_ids uuid[]) TO anon;
GRANT ALL ON FUNCTION public.tq_save_bracket_prediction(p_comp uuid, p_round_key text, p_team_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.tq_save_bracket_prediction(p_comp uuid, p_round_key text, p_team_ids uuid[]) TO service_role;


--
-- Name: FUNCTION tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_score_a integer, p_score_b integer, p_bonus text); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_score_a integer, p_score_b integer, p_bonus text) TO anon;
GRANT ALL ON FUNCTION public.tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_score_a integer, p_score_b integer, p_bonus text) TO authenticated;
GRANT ALL ON FUNCTION public.tq_save_daily_prediction(p_comp uuid, p_match_id uuid, p_score_a integer, p_score_b integer, p_bonus text) TO service_role;


--
-- Name: FUNCTION tq_save_group_prediction(p_comp uuid, p_group_id uuid, p_picks jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_save_group_prediction(p_comp uuid, p_group_id uuid, p_picks jsonb) TO anon;
GRANT ALL ON FUNCTION public.tq_save_group_prediction(p_comp uuid, p_group_id uuid, p_picks jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.tq_save_group_prediction(p_comp uuid, p_group_id uuid, p_picks jsonb) TO service_role;


--
-- Name: FUNCTION tq_save_long_term(p_comp uuid, p_champion uuid, p_finalist uuid, p_top_scorer uuid, p_total_goals integer, p_extras jsonb); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_save_long_term(p_comp uuid, p_champion uuid, p_finalist uuid, p_top_scorer uuid, p_total_goals integer, p_extras jsonb) TO anon;
GRANT ALL ON FUNCTION public.tq_save_long_term(p_comp uuid, p_champion uuid, p_finalist uuid, p_top_scorer uuid, p_total_goals integer, p_extras jsonb) TO authenticated;
GRANT ALL ON FUNCTION public.tq_save_long_term(p_comp uuid, p_champion uuid, p_finalist uuid, p_top_scorer uuid, p_total_goals integer, p_extras jsonb) TO service_role;


--
-- Name: FUNCTION tq_score_bracket(p_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_score_bracket(p_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_score_bracket(p_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_score_bracket(p_entry_id uuid) TO service_role;


--
-- Name: FUNCTION tq_score_daily(p_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_score_daily(p_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_score_daily(p_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_score_daily(p_entry_id uuid) TO service_role;


--
-- Name: FUNCTION tq_score_group(p_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_score_group(p_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_score_group(p_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_score_group(p_entry_id uuid) TO service_role;


--
-- Name: FUNCTION tq_score_long_term(p_entry_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_score_long_term(p_entry_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_score_long_term(p_entry_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_score_long_term(p_entry_id uuid) TO service_role;


--
-- Name: FUNCTION tq_use_masterpass(p_competition_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.tq_use_masterpass(p_competition_id uuid) TO anon;
GRANT ALL ON FUNCTION public.tq_use_masterpass(p_competition_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.tq_use_masterpass(p_competition_id uuid) TO service_role;


--
-- Name: FUNCTION track_badge_earned(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_badge_earned(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_badge_earned(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.track_badge_earned(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric) TO authenticated;
GRANT ALL ON FUNCTION public.track_bet(p_user_id uuid, p_bet_amount numeric, p_win_amount numeric, p_odds numeric) TO service_role;


--
-- Name: FUNCTION track_fantasy_game(p_user_id uuid, p_score numeric); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_fantasy_game(p_user_id uuid, p_score numeric) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_fantasy_game(p_user_id uuid, p_score numeric) TO authenticated;
GRANT ALL ON FUNCTION public.track_fantasy_game(p_user_id uuid, p_score numeric) TO service_role;


--
-- Name: FUNCTION track_game_type(p_user_id uuid, p_game_type text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_game_type(p_user_id uuid, p_game_type text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_game_type(p_user_id uuid, p_game_type text) TO authenticated;
GRANT ALL ON FUNCTION public.track_game_type(p_user_id uuid, p_game_type text) TO service_role;


--
-- Name: FUNCTION track_prediction(p_user_id uuid, p_is_correct boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_prediction(p_user_id uuid, p_is_correct boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_prediction(p_user_id uuid, p_is_correct boolean) TO authenticated;
GRANT ALL ON FUNCTION public.track_prediction(p_user_id uuid, p_is_correct boolean) TO service_role;


--
-- Name: FUNCTION track_user_activity(p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.track_user_activity(p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.track_user_activity(p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.track_user_activity(p_user_id uuid) TO service_role;


--
-- Name: FUNCTION trigger_award_badge_xp(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_award_badge_xp() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_award_badge_xp() TO service_role;


--
-- Name: FUNCTION trigger_distribute_prizes_on_finalize(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_distribute_prizes_on_finalize() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_distribute_prizes_on_finalize() TO service_role;


--
-- Name: FUNCTION trigger_fixture_sync(p_days_ahead integer, p_mode text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_fixture_sync(p_days_ahead integer, p_mode text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_fixture_sync(p_days_ahead integer, p_mode text) TO authenticated;
GRANT ALL ON FUNCTION public.trigger_fixture_sync(p_days_ahead integer, p_mode text) TO service_role;


--
-- Name: FUNCTION trigger_recalculate_challenge_points(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_recalculate_challenge_points() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_recalculate_challenge_points() TO service_role;


--
-- Name: FUNCTION trigger_track_badge_earned(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.trigger_track_badge_earned() FROM PUBLIC;
GRANT ALL ON FUNCTION public.trigger_track_badge_earned() TO service_role;


--
-- Name: FUNCTION unlink_squad_game(p_user_id uuid, p_squad_id uuid, p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.unlink_squad_game(p_user_id uuid, p_squad_id uuid, p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.unlink_squad_game(p_user_id uuid, p_squad_id uuid, p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.unlink_squad_game(p_user_id uuid, p_squad_id uuid, p_game_id uuid) TO service_role;


--
-- Name: FUNCTION update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone) TO authenticated;
GRANT ALL ON FUNCTION public.update_adaptive_multipliers(p_user_id uuid, p_category text, p_expires_at timestamp with time zone) TO service_role;


--
-- Name: FUNCTION update_all_weekly_xp(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_all_weekly_xp() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_all_weekly_xp() TO authenticated;
GRANT ALL ON FUNCTION public.update_all_weekly_xp() TO service_role;


--
-- Name: FUNCTION update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer) TO authenticated;
GRANT ALL ON FUNCTION public.update_available_spins(p_user_id uuid, p_tier public.spin_tier, p_delta integer) TO service_role;


--
-- Name: FUNCTION update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) TO authenticated;
GRANT ALL ON FUNCTION public.update_challenge(p_challenge_id uuid, p_name text, p_description text, p_start_date timestamp with time zone, p_end_date timestamp with time zone, p_entry_cost integer, p_prizes jsonb, p_rules jsonb, p_status text, p_entry_conditions jsonb, p_configs jsonb, p_league_ids uuid[], p_match_ids uuid[]) TO service_role;


--
-- Name: FUNCTION update_challenge_participant_points(p_challenge_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_challenge_participant_points(p_challenge_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_challenge_participant_points(p_challenge_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_challenge_participant_points(p_challenge_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION update_challenge_rankings(p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_challenge_rankings(p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_challenge_rankings(p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_challenge_rankings(p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION update_fantasy_league_players_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_fantasy_league_players_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_fantasy_league_players_updated_at() TO service_role;


--
-- Name: FUNCTION update_game_config_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_game_config_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_game_config_updated_at() TO service_role;


--
-- Name: FUNCTION update_live_game_tier_limits_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_live_game_tier_limits_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_live_game_tier_limits_updated_at() TO service_role;


--
-- Name: FUNCTION update_live_games_updated_at(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_live_games_updated_at() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_live_games_updated_at() TO service_role;


--
-- Name: FUNCTION update_matchday_participant_stats(p_matchday_id uuid, p_user_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_matchday_participant_stats(p_matchday_id uuid, p_user_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_matchday_participant_stats(p_matchday_id uuid, p_user_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_matchday_participant_stats(p_matchday_id uuid, p_user_id uuid) TO service_role;


--
-- Name: FUNCTION update_pity_counter(p_user_id uuid, p_reset boolean); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_pity_counter(p_user_id uuid, p_reset boolean) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_pity_counter(p_user_id uuid, p_reset boolean) TO authenticated;
GRANT ALL ON FUNCTION public.update_pity_counter(p_user_id uuid, p_reset boolean) TO service_role;


--
-- Name: FUNCTION update_player_fatigue(p_game_week_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_player_fatigue(p_game_week_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_player_fatigue(p_game_week_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.update_player_fatigue(p_game_week_id uuid) TO service_role;


--
-- Name: FUNCTION update_player_season_stats(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_player_season_stats() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_player_season_stats() TO service_role;


--
-- Name: FUNCTION update_updated_at_column(); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.update_updated_at_column() FROM PUBLIC;
GRANT ALL ON FUNCTION public.update_updated_at_column() TO service_role;


--
-- Name: FUNCTION use_masterpass(p_game_type text, p_game_id uuid); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.use_masterpass(p_game_type text, p_game_id uuid) TO anon;
GRANT ALL ON FUNCTION public.use_masterpass(p_game_type text, p_game_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.use_masterpass(p_game_type text, p_game_id uuid) TO service_role;


--
-- Name: FUNCTION use_ticket(p_user_id uuid, p_ticket_id uuid, p_challenge_id uuid); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.use_ticket(p_user_id uuid, p_ticket_id uuid, p_challenge_id uuid) FROM PUBLIC;
GRANT ALL ON FUNCTION public.use_ticket(p_user_id uuid, p_ticket_id uuid, p_challenge_id uuid) TO authenticated;
GRANT ALL ON FUNCTION public.use_ticket(p_user_id uuid, p_ticket_id uuid, p_challenge_id uuid) TO service_role;


--
-- Name: FUNCTION user_level_rank(p_level text); Type: ACL; Schema: public; Owner: -
--

REVOKE ALL ON FUNCTION public.user_level_rank(p_level text) FROM PUBLIC;
GRANT ALL ON FUNCTION public.user_level_rank(p_level text) TO authenticated;
GRANT ALL ON FUNCTION public.user_level_rank(p_level text) TO service_role;


--
-- Name: FUNCTION xp_coef(p_key text, p_default numeric); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.xp_coef(p_key text, p_default numeric) TO anon;
GRANT ALL ON FUNCTION public.xp_coef(p_key text, p_default numeric) TO authenticated;
GRANT ALL ON FUNCTION public.xp_coef(p_key text, p_default numeric) TO service_role;


--
-- Name: FUNCTION xp_on_live_settled(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.xp_on_live_settled() TO anon;
GRANT ALL ON FUNCTION public.xp_on_live_settled() TO authenticated;
GRANT ALL ON FUNCTION public.xp_on_live_settled() TO service_role;


--
-- Name: FUNCTION xp_on_match_bet_settled(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.xp_on_match_bet_settled() TO anon;
GRANT ALL ON FUNCTION public.xp_on_match_bet_settled() TO authenticated;
GRANT ALL ON FUNCTION public.xp_on_match_bet_settled() TO service_role;


--
-- Name: FUNCTION xp_on_swipe_settled(); Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON FUNCTION public.xp_on_swipe_settled() TO anon;
GRANT ALL ON FUNCTION public.xp_on_swipe_settled() TO authenticated;
GRANT ALL ON FUNCTION public.xp_on_swipe_settled() TO service_role;


--
-- Name: TABLE api_sync_config; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.api_sync_config TO anon;
GRANT ALL ON TABLE public.api_sync_config TO authenticated;
GRANT ALL ON TABLE public.api_sync_config TO service_role;


--
-- Name: TABLE app_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.app_config TO anon;
GRANT ALL ON TABLE public.app_config TO authenticated;
GRANT ALL ON TABLE public.app_config TO service_role;


--
-- Name: TABLE badges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.badges TO anon;
GRANT ALL ON TABLE public.badges TO authenticated;
GRANT ALL ON TABLE public.badges TO service_role;


--
-- Name: TABLE boosters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.boosters TO anon;
GRANT ALL ON TABLE public.boosters TO authenticated;
GRANT ALL ON TABLE public.boosters TO service_role;


--
-- Name: TABLE challenge_bets; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.challenge_bets TO anon;
GRANT ALL ON TABLE public.challenge_bets TO authenticated;
GRANT ALL ON TABLE public.challenge_bets TO service_role;


--
-- Name: TABLE challenge_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_configs TO anon;
GRANT ALL ON TABLE public.challenge_configs TO authenticated;
GRANT ALL ON TABLE public.challenge_configs TO service_role;


--
-- Name: TABLE challenge_daily_entries; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.challenge_daily_entries TO anon;
GRANT ALL ON TABLE public.challenge_daily_entries TO authenticated;
GRANT ALL ON TABLE public.challenge_daily_entries TO service_role;


--
-- Name: TABLE challenge_entries; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.challenge_entries TO anon;
GRANT ALL ON TABLE public.challenge_entries TO authenticated;
GRANT ALL ON TABLE public.challenge_entries TO service_role;


--
-- Name: TABLE challenge_leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_leagues TO anon;
GRANT ALL ON TABLE public.challenge_leagues TO authenticated;
GRANT ALL ON TABLE public.challenge_leagues TO service_role;


--
-- Name: TABLE challenge_matchdays; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_matchdays TO anon;
GRANT ALL ON TABLE public.challenge_matchdays TO authenticated;
GRANT ALL ON TABLE public.challenge_matchdays TO service_role;


--
-- Name: TABLE challenge_matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_matches TO anon;
GRANT ALL ON TABLE public.challenge_matches TO authenticated;
GRANT ALL ON TABLE public.challenge_matches TO service_role;


--
-- Name: TABLE challenge_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_participants TO anon;
GRANT ALL ON TABLE public.challenge_participants TO authenticated;
GRANT ALL ON TABLE public.challenge_participants TO service_role;


--
-- Name: TABLE challenge_required_badges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenge_required_badges TO anon;
GRANT ALL ON TABLE public.challenge_required_badges TO authenticated;
GRANT ALL ON TABLE public.challenge_required_badges TO service_role;


--
-- Name: TABLE challenges; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.challenges TO anon;
GRANT ALL ON TABLE public.challenges TO authenticated;
GRANT ALL ON TABLE public.challenges TO service_role;


--
-- Name: TABLE coin_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.coin_transactions TO anon;
GRANT ALL ON TABLE public.coin_transactions TO authenticated;
GRANT ALL ON TABLE public.coin_transactions TO service_role;


--
-- Name: TABLE content_versions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.content_versions TO anon;
GRANT ALL ON TABLE public.content_versions TO authenticated;
GRANT ALL ON TABLE public.content_versions TO service_role;


--
-- Name: TABLE countries; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.countries TO anon;
GRANT ALL ON TABLE public.countries TO authenticated;
GRANT ALL ON TABLE public.countries TO service_role;


--
-- Name: TABLE fantasy_boosters; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_boosters TO anon;
GRANT ALL ON TABLE public.fantasy_boosters TO authenticated;
GRANT ALL ON TABLE public.fantasy_boosters TO service_role;


--
-- Name: SEQUENCE fantasy_boosters_id_seq; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON SEQUENCE public.fantasy_boosters_id_seq TO anon;
GRANT ALL ON SEQUENCE public.fantasy_boosters_id_seq TO authenticated;
GRANT ALL ON SEQUENCE public.fantasy_boosters_id_seq TO service_role;


--
-- Name: TABLE fantasy_configs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_configs TO anon;
GRANT ALL ON TABLE public.fantasy_configs TO authenticated;
GRANT ALL ON TABLE public.fantasy_configs TO service_role;


--
-- Name: TABLE fantasy_game_weeks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_game_weeks TO anon;
GRANT ALL ON TABLE public.fantasy_game_weeks TO authenticated;
GRANT ALL ON TABLE public.fantasy_game_weeks TO service_role;


--
-- Name: TABLE fantasy_games; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_games TO anon;
GRANT ALL ON TABLE public.fantasy_games TO authenticated;
GRANT ALL ON TABLE public.fantasy_games TO service_role;


--
-- Name: TABLE fantasy_leaderboard; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_leaderboard TO anon;
GRANT ALL ON TABLE public.fantasy_leaderboard TO authenticated;
GRANT ALL ON TABLE public.fantasy_leaderboard TO service_role;


--
-- Name: TABLE fantasy_league_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_league_players TO anon;
GRANT ALL ON TABLE public.fantasy_league_players TO authenticated;
GRANT ALL ON TABLE public.fantasy_league_players TO service_role;


--
-- Name: TABLE fantasy_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fantasy_players TO anon;
GRANT ALL ON TABLE public.fantasy_players TO authenticated;
GRANT ALL ON TABLE public.fantasy_players TO service_role;


--
-- Name: TABLE fb_fixture_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_fixture_events TO anon;
GRANT ALL ON TABLE public.fb_fixture_events TO authenticated;
GRANT ALL ON TABLE public.fb_fixture_events TO service_role;


--
-- Name: TABLE fb_fixture_statistics; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_fixture_statistics TO anon;
GRANT ALL ON TABLE public.fb_fixture_statistics TO authenticated;
GRANT ALL ON TABLE public.fb_fixture_statistics TO service_role;


--
-- Name: TABLE fb_fixtures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_fixtures TO anon;
GRANT ALL ON TABLE public.fb_fixtures TO authenticated;
GRANT ALL ON TABLE public.fb_fixtures TO service_role;


--
-- Name: TABLE fb_leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_leagues TO anon;
GRANT ALL ON TABLE public.fb_leagues TO authenticated;
GRANT ALL ON TABLE public.fb_leagues TO service_role;


--
-- Name: TABLE fb_odds; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_odds TO anon;
GRANT ALL ON TABLE public.fb_odds TO authenticated;
GRANT ALL ON TABLE public.fb_odds TO service_role;


--
-- Name: TABLE fb_player_match_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_player_match_stats TO anon;
GRANT ALL ON TABLE public.fb_player_match_stats TO authenticated;
GRANT ALL ON TABLE public.fb_player_match_stats TO service_role;


--
-- Name: TABLE fb_player_season_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_player_season_stats TO anon;
GRANT ALL ON TABLE public.fb_player_season_stats TO authenticated;
GRANT ALL ON TABLE public.fb_player_season_stats TO service_role;


--
-- Name: TABLE fb_player_team_association; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_player_team_association TO anon;
GRANT ALL ON TABLE public.fb_player_team_association TO authenticated;
GRANT ALL ON TABLE public.fb_player_team_association TO service_role;


--
-- Name: TABLE fb_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_players TO anon;
GRANT ALL ON TABLE public.fb_players TO authenticated;
GRANT ALL ON TABLE public.fb_players TO service_role;


--
-- Name: TABLE fb_standings; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_standings TO anon;
GRANT ALL ON TABLE public.fb_standings TO authenticated;
GRANT ALL ON TABLE public.fb_standings TO service_role;


--
-- Name: TABLE fb_team_league_participation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_team_league_participation TO anon;
GRANT ALL ON TABLE public.fb_team_league_participation TO authenticated;
GRANT ALL ON TABLE public.fb_team_league_participation TO service_role;


--
-- Name: TABLE fb_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_teams TO anon;
GRANT ALL ON TABLE public.fb_teams TO authenticated;
GRANT ALL ON TABLE public.fb_teams TO service_role;


--
-- Name: TABLE fb_transfers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fb_transfers TO anon;
GRANT ALL ON TABLE public.fb_transfers TO authenticated;
GRANT ALL ON TABLE public.fb_transfers TO service_role;


--
-- Name: TABLE fixture_sync_log; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.fixture_sync_log TO anon;
GRANT ALL ON TABLE public.fixture_sync_log TO authenticated;
GRANT ALL ON TABLE public.fixture_sync_log TO service_role;


--
-- Name: TABLE fixture_sync_summary; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.fixture_sync_summary TO anon;
GRANT ALL ON TABLE public.fixture_sync_summary TO authenticated;
GRANT ALL ON TABLE public.fixture_sync_summary TO service_role;


--
-- Name: TABLE fixtures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.fixtures TO anon;
GRANT ALL ON TABLE public.fixtures TO authenticated;
GRANT ALL ON TABLE public.fixtures TO service_role;


--
-- Name: TABLE game_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.game_config TO anon;
GRANT ALL ON TABLE public.game_config TO authenticated;
GRANT ALL ON TABLE public.game_config TO service_role;


--
-- Name: TABLE game_weeks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.game_weeks TO anon;
GRANT ALL ON TABLE public.game_weeks TO authenticated;
GRANT ALL ON TABLE public.game_weeks TO service_role;


--
-- Name: TABLE league_games; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.league_games TO anon;
GRANT ALL ON TABLE public.league_games TO authenticated;
GRANT ALL ON TABLE public.league_games TO service_role;


--
-- Name: TABLE league_members; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.league_members TO anon;
GRANT ALL ON TABLE public.league_members TO authenticated;
GRANT ALL ON TABLE public.league_members TO service_role;


--
-- Name: TABLE leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.leagues TO anon;
GRANT ALL ON TABLE public.leagues TO authenticated;
GRANT ALL ON TABLE public.leagues TO service_role;


--
-- Name: TABLE levels_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.levels_config TO anon;
GRANT ALL ON TABLE public.levels_config TO authenticated;
GRANT ALL ON TABLE public.levels_config TO service_role;


--
-- Name: TABLE lf_activation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_activation TO anon;
GRANT ALL ON TABLE public.lf_activation TO authenticated;
GRANT ALL ON TABLE public.lf_activation TO service_role;


--
-- Name: TABLE lf_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_config TO anon;
GRANT ALL ON TABLE public.lf_config TO authenticated;
GRANT ALL ON TABLE public.lf_config TO service_role;


--
-- Name: TABLE lf_game_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_game_players TO anon;
GRANT ALL ON TABLE public.lf_game_players TO authenticated;
GRANT ALL ON TABLE public.lf_game_players TO service_role;


--
-- Name: TABLE lf_games; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_games TO anon;
GRANT ALL ON TABLE public.lf_games TO authenticated;
GRANT ALL ON TABLE public.lf_games TO service_role;


--
-- Name: TABLE lf_notify; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_notify TO anon;
GRANT ALL ON TABLE public.lf_notify TO authenticated;
GRANT ALL ON TABLE public.lf_notify TO service_role;


--
-- Name: TABLE lf_team_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_team_players TO anon;
GRANT ALL ON TABLE public.lf_team_players TO authenticated;
GRANT ALL ON TABLE public.lf_team_players TO service_role;


--
-- Name: TABLE lf_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.lf_teams TO anon;
GRANT ALL ON TABLE public.lf_teams TO authenticated;
GRANT ALL ON TABLE public.lf_teams TO service_role;


--
-- Name: TABLE live_game_bets; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.live_game_bets TO anon;
GRANT ALL ON TABLE public.live_game_bets TO authenticated;
GRANT ALL ON TABLE public.live_game_bets TO service_role;


--
-- Name: TABLE live_game_entries; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.live_game_entries TO anon;
GRANT ALL ON TABLE public.live_game_entries TO authenticated;
GRANT ALL ON TABLE public.live_game_entries TO service_role;


--
-- Name: TABLE live_game_tier_limits; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_game_tier_limits TO anon;
GRANT ALL ON TABLE public.live_game_tier_limits TO authenticated;
GRANT ALL ON TABLE public.live_game_tier_limits TO service_role;


--
-- Name: TABLE live_games; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_games TO anon;
GRANT ALL ON TABLE public.live_games TO authenticated;
GRANT ALL ON TABLE public.live_games TO service_role;


--
-- Name: TABLE live_pred_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.live_pred_config TO anon;
GRANT ALL ON TABLE public.live_pred_config TO authenticated;
GRANT ALL ON TABLE public.live_pred_config TO service_role;


--
-- Name: TABLE match_bets; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.match_bets TO anon;
GRANT ALL ON TABLE public.match_bets TO authenticated;
GRANT ALL ON TABLE public.match_bets TO service_role;


--
-- Name: TABLE matchday_fixtures; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchday_fixtures TO anon;
GRANT ALL ON TABLE public.matchday_fixtures TO authenticated;
GRANT ALL ON TABLE public.matchday_fixtures TO service_role;


--
-- Name: TABLE matchday_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matchday_participants TO anon;
GRANT ALL ON TABLE public.matchday_participants TO authenticated;
GRANT ALL ON TABLE public.matchday_participants TO service_role;


--
-- Name: TABLE matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.matches TO anon;
GRANT ALL ON TABLE public.matches TO authenticated;
GRANT ALL ON TABLE public.matches TO service_role;


--
-- Name: TABLE mr_activation; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_activation TO anon;
GRANT ALL ON TABLE public.mr_activation TO authenticated;
GRANT ALL ON TABLE public.mr_activation TO service_role;


--
-- Name: TABLE mr_answers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_answers TO anon;
GRANT ALL ON TABLE public.mr_answers TO authenticated;
GRANT ALL ON TABLE public.mr_answers TO service_role;


--
-- Name: TABLE mr_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_config TO anon;
GRANT ALL ON TABLE public.mr_config TO authenticated;
GRANT ALL ON TABLE public.mr_config TO service_role;


--
-- Name: TABLE mr_event_catalog; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_event_catalog TO anon;
GRANT ALL ON TABLE public.mr_event_catalog TO authenticated;
GRANT ALL ON TABLE public.mr_event_catalog TO service_role;


--
-- Name: TABLE mr_games; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_games TO anon;
GRANT ALL ON TABLE public.mr_games TO authenticated;
GRANT ALL ON TABLE public.mr_games TO service_role;


--
-- Name: TABLE mr_participants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_participants TO anon;
GRANT ALL ON TABLE public.mr_participants TO authenticated;
GRANT ALL ON TABLE public.mr_participants TO service_role;


--
-- Name: TABLE mr_pot_assignments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_pot_assignments TO anon;
GRANT ALL ON TABLE public.mr_pot_assignments TO authenticated;
GRANT ALL ON TABLE public.mr_pot_assignments TO service_role;


--
-- Name: TABLE mr_pot_profiles; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_pot_profiles TO anon;
GRANT ALL ON TABLE public.mr_pot_profiles TO authenticated;
GRANT ALL ON TABLE public.mr_pot_profiles TO service_role;


--
-- Name: TABLE mr_questions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.mr_questions TO anon;
GRANT ALL ON TABLE public.mr_questions TO authenticated;
GRANT ALL ON TABLE public.mr_questions TO service_role;


--
-- Name: TABLE notification_preferences; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.notification_preferences TO anon;
GRANT ALL ON TABLE public.notification_preferences TO authenticated;
GRANT ALL ON TABLE public.notification_preferences TO service_role;


--
-- Name: TABLE notifications; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.notifications TO anon;
GRANT ALL ON TABLE public.notifications TO authenticated;
GRANT ALL ON TABLE public.notifications TO service_role;


--
-- Name: TABLE odds; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.odds TO anon;
GRANT ALL ON TABLE public.odds TO authenticated;
GRANT ALL ON TABLE public.odds TO service_role;


--
-- Name: TABLE player_match_stats; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.player_match_stats TO anon;
GRANT ALL ON TABLE public.player_match_stats TO authenticated;
GRANT ALL ON TABLE public.player_match_stats TO service_role;


--
-- Name: TABLE player_season_stats; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.player_season_stats TO anon;
GRANT ALL ON TABLE public.player_season_stats TO authenticated;
GRANT ALL ON TABLE public.player_season_stats TO service_role;


--
-- Name: TABLE player_season_stats_combined; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.player_season_stats_combined TO anon;
GRANT ALL ON TABLE public.player_season_stats_combined TO authenticated;
GRANT ALL ON TABLE public.player_season_stats_combined TO service_role;


--
-- Name: TABLE player_transfers; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.player_transfers TO anon;
GRANT ALL ON TABLE public.player_transfers TO authenticated;
GRANT ALL ON TABLE public.player_transfers TO service_role;


--
-- Name: TABLE players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.players TO anon;
GRANT ALL ON TABLE public.players TO authenticated;
GRANT ALL ON TABLE public.players TO service_role;


--
-- Name: TABLE premium_daily_claims; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.premium_daily_claims TO anon;
GRANT ALL ON TABLE public.premium_daily_claims TO authenticated;
GRANT ALL ON TABLE public.premium_daily_claims TO service_role;


--
-- Name: TABLE profiles; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.profiles TO anon;
GRANT ALL ON TABLE public.profiles TO authenticated;
GRANT ALL ON TABLE public.profiles TO service_role;


--
-- Name: TABLE puzzle_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_config TO anon;
GRANT ALL ON TABLE public.puzzle_config TO authenticated;
GRANT ALL ON TABLE public.puzzle_config TO service_role;


--
-- Name: TABLE puzzle_daily_prizes; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_daily_prizes TO anon;
GRANT ALL ON TABLE public.puzzle_daily_prizes TO authenticated;
GRANT ALL ON TABLE public.puzzle_daily_prizes TO service_role;


--
-- Name: TABLE puzzle_games; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_games TO anon;
GRANT ALL ON TABLE public.puzzle_games TO authenticated;
GRANT ALL ON TABLE public.puzzle_games TO service_role;


--
-- Name: TABLE puzzle_monthly_grants; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_monthly_grants TO anon;
GRANT ALL ON TABLE public.puzzle_monthly_grants TO authenticated;
GRANT ALL ON TABLE public.puzzle_monthly_grants TO service_role;


--
-- Name: TABLE puzzle_plays; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_plays TO anon;
GRANT ALL ON TABLE public.puzzle_plays TO authenticated;
GRANT ALL ON TABLE public.puzzle_plays TO service_role;


--
-- Name: TABLE puzzle_progress; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_progress TO anon;
GRANT ALL ON TABLE public.puzzle_progress TO authenticated;
GRANT ALL ON TABLE public.puzzle_progress TO service_role;


--
-- Name: TABLE puzzle_round_attempts; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_round_attempts TO anon;
GRANT ALL ON TABLE public.puzzle_round_attempts TO authenticated;
GRANT ALL ON TABLE public.puzzle_round_attempts TO service_role;


--
-- Name: TABLE puzzle_rounds; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_rounds TO anon;
GRANT ALL ON TABLE public.puzzle_rounds TO authenticated;
GRANT ALL ON TABLE public.puzzle_rounds TO service_role;


--
-- Name: TABLE puzzle_user_prefs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.puzzle_user_prefs TO anon;
GRANT ALL ON TABLE public.puzzle_user_prefs TO authenticated;
GRANT ALL ON TABLE public.puzzle_user_prefs TO service_role;


--
-- Name: TABLE reward_fulfillments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reward_fulfillments TO anon;
GRANT ALL ON TABLE public.reward_fulfillments TO authenticated;
GRANT ALL ON TABLE public.reward_fulfillments TO service_role;


--
-- Name: TABLE reward_packs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.reward_packs TO anon;
GRANT ALL ON TABLE public.reward_packs TO authenticated;
GRANT ALL ON TABLE public.reward_packs TO service_role;


--
-- Name: TABLE scores; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.scores TO anon;
GRANT ALL ON TABLE public.scores TO authenticated;
GRANT ALL ON TABLE public.scores TO service_role;


--
-- Name: TABLE season_logs; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.season_logs TO anon;
GRANT ALL ON TABLE public.season_logs TO authenticated;
GRANT ALL ON TABLE public.season_logs TO service_role;


--
-- Name: TABLE seasons; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.seasons TO anon;
GRANT ALL ON TABLE public.seasons TO authenticated;
GRANT ALL ON TABLE public.seasons TO service_role;


--
-- Name: TABLE seed_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.seed_runs TO anon;
GRANT ALL ON TABLE public.seed_runs TO authenticated;
GRANT ALL ON TABLE public.seed_runs TO service_role;


--
-- Name: TABLE spin_history; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.spin_history TO anon;
GRANT ALL ON TABLE public.spin_history TO authenticated;
GRANT ALL ON TABLE public.spin_history TO service_role;


--
-- Name: TABLE spin_segments; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.spin_segments TO anon;
GRANT ALL ON TABLE public.spin_segments TO authenticated;
GRANT ALL ON TABLE public.spin_segments TO service_role;


--
-- Name: TABLE squad_blocks; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.squad_blocks TO anon;
GRANT ALL ON TABLE public.squad_blocks TO authenticated;
GRANT ALL ON TABLE public.squad_blocks TO service_role;


--
-- Name: TABLE squad_feed; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_feed TO anon;
GRANT ALL ON TABLE public.squad_feed TO authenticated;
GRANT ALL ON TABLE public.squad_feed TO service_role;


--
-- Name: TABLE squad_feed_likes; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_feed_likes TO anon;
GRANT ALL ON TABLE public.squad_feed_likes TO authenticated;
GRANT ALL ON TABLE public.squad_feed_likes TO service_role;


--
-- Name: TABLE squad_games; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_games TO anon;
GRANT ALL ON TABLE public.squad_games TO authenticated;
GRANT ALL ON TABLE public.squad_games TO service_role;


--
-- Name: TABLE squad_leaderboard_snapshots; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_leaderboard_snapshots TO anon;
GRANT ALL ON TABLE public.squad_leaderboard_snapshots TO authenticated;
GRANT ALL ON TABLE public.squad_leaderboard_snapshots TO service_role;


--
-- Name: TABLE squad_members; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_members TO anon;
GRANT ALL ON TABLE public.squad_members TO authenticated;
GRANT ALL ON TABLE public.squad_members TO service_role;


--
-- Name: TABLE squad_private_games; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.squad_private_games TO anon;
GRANT ALL ON TABLE public.squad_private_games TO authenticated;
GRANT ALL ON TABLE public.squad_private_games TO service_role;


--
-- Name: TABLE swipe_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.swipe_predictions TO anon;
GRANT ALL ON TABLE public.swipe_predictions TO authenticated;
GRANT ALL ON TABLE public.swipe_predictions TO service_role;


--
-- Name: TABLE team_popularity; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.team_popularity TO anon;
GRANT ALL ON TABLE public.team_popularity TO authenticated;
GRANT ALL ON TABLE public.team_popularity TO service_role;


--
-- Name: TABLE teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.teams TO anon;
GRANT ALL ON TABLE public.teams TO authenticated;
GRANT ALL ON TABLE public.teams TO service_role;


--
-- Name: TABLE ticket_transactions; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.ticket_transactions TO anon;
GRANT ALL ON TABLE public.ticket_transactions TO authenticated;
GRANT ALL ON TABLE public.ticket_transactions TO service_role;


--
-- Name: TABLE tm_club_seasons; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_club_seasons TO anon;
GRANT ALL ON TABLE public.tm_club_seasons TO authenticated;
GRANT ALL ON TABLE public.tm_club_seasons TO service_role;


--
-- Name: TABLE tm_clubs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_clubs TO anon;
GRANT ALL ON TABLE public.tm_clubs TO authenticated;
GRANT ALL ON TABLE public.tm_clubs TO service_role;


--
-- Name: TABLE tm_leagues; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_leagues TO anon;
GRANT ALL ON TABLE public.tm_leagues TO authenticated;
GRANT ALL ON TABLE public.tm_leagues TO service_role;


--
-- Name: TABLE tm_lineups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_lineups TO anon;
GRANT ALL ON TABLE public.tm_lineups TO authenticated;
GRANT ALL ON TABLE public.tm_lineups TO service_role;


--
-- Name: TABLE tm_market_values; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_market_values TO anon;
GRANT ALL ON TABLE public.tm_market_values TO authenticated;
GRANT ALL ON TABLE public.tm_market_values TO service_role;


--
-- Name: TABLE tm_matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_matches TO anon;
GRANT ALL ON TABLE public.tm_matches TO authenticated;
GRANT ALL ON TABLE public.tm_matches TO service_role;


--
-- Name: TABLE tm_squad_memberships; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_squad_memberships TO anon;
GRANT ALL ON TABLE public.tm_squad_memberships TO authenticated;
GRANT ALL ON TABLE public.tm_squad_memberships TO service_role;


--
-- Name: TABLE tm_transfers; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_transfers TO anon;
GRANT ALL ON TABLE public.tm_transfers TO authenticated;
GRANT ALL ON TABLE public.tm_transfers TO service_role;


--
-- Name: TABLE tm_player_clubs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_player_clubs TO anon;
GRANT ALL ON TABLE public.tm_player_clubs TO authenticated;
GRANT ALL ON TABLE public.tm_player_clubs TO service_role;


--
-- Name: TABLE tm_player_season_stats; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_player_season_stats TO anon;
GRANT ALL ON TABLE public.tm_player_season_stats TO authenticated;
GRANT ALL ON TABLE public.tm_player_season_stats TO service_role;


--
-- Name: TABLE tm_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_players TO anon;
GRANT ALL ON TABLE public.tm_players TO authenticated;
GRANT ALL ON TABLE public.tm_players TO service_role;


--
-- Name: TABLE tm_seed_runs; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_seed_runs TO anon;
GRANT ALL ON TABLE public.tm_seed_runs TO authenticated;
GRANT ALL ON TABLE public.tm_seed_runs TO service_role;


--
-- Name: TABLE tm_trophies; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tm_trophies TO anon;
GRANT ALL ON TABLE public.tm_trophies TO authenticated;
GRANT ALL ON TABLE public.tm_trophies TO service_role;


--
-- Name: TABLE tq_announcements; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_announcements TO anon;
GRANT ALL ON TABLE public.tq_announcements TO authenticated;
GRANT ALL ON TABLE public.tq_announcements TO service_role;


--
-- Name: TABLE tq_bracket_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_bracket_predictions TO anon;
GRANT ALL ON TABLE public.tq_bracket_predictions TO authenticated;
GRANT ALL ON TABLE public.tq_bracket_predictions TO service_role;


--
-- Name: TABLE tq_competitions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_competitions TO anon;
GRANT ALL ON TABLE public.tq_competitions TO authenticated;
GRANT ALL ON TABLE public.tq_competitions TO service_role;


--
-- Name: TABLE tq_daily_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_daily_predictions TO anon;
GRANT ALL ON TABLE public.tq_daily_predictions TO authenticated;
GRANT ALL ON TABLE public.tq_daily_predictions TO service_role;


--
-- Name: TABLE tq_group_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_group_predictions TO anon;
GRANT ALL ON TABLE public.tq_group_predictions TO authenticated;
GRANT ALL ON TABLE public.tq_group_predictions TO service_role;


--
-- Name: TABLE tq_group_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_group_teams TO anon;
GRANT ALL ON TABLE public.tq_group_teams TO authenticated;
GRANT ALL ON TABLE public.tq_group_teams TO service_role;


--
-- Name: TABLE tq_groups; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_groups TO anon;
GRANT ALL ON TABLE public.tq_groups TO authenticated;
GRANT ALL ON TABLE public.tq_groups TO service_role;


--
-- Name: TABLE tq_leaderboard; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_leaderboard TO anon;
GRANT ALL ON TABLE public.tq_leaderboard TO authenticated;
GRANT ALL ON TABLE public.tq_leaderboard TO service_role;


--
-- Name: TABLE tq_long_term_predictions; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_long_term_predictions TO anon;
GRANT ALL ON TABLE public.tq_long_term_predictions TO authenticated;
GRANT ALL ON TABLE public.tq_long_term_predictions TO service_role;


--
-- Name: TABLE tq_masterpass_invites; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_masterpass_invites TO anon;
GRANT ALL ON TABLE public.tq_masterpass_invites TO authenticated;
GRANT ALL ON TABLE public.tq_masterpass_invites TO service_role;


--
-- Name: TABLE tq_matches; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_matches TO anon;
GRANT ALL ON TABLE public.tq_matches TO authenticated;
GRANT ALL ON TABLE public.tq_matches TO service_role;


--
-- Name: TABLE tq_phase_windows; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_phase_windows TO anon;
GRANT ALL ON TABLE public.tq_phase_windows TO authenticated;
GRANT ALL ON TABLE public.tq_phase_windows TO service_role;


--
-- Name: TABLE tq_players; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_players TO anon;
GRANT ALL ON TABLE public.tq_players TO authenticated;
GRANT ALL ON TABLE public.tq_players TO service_role;


--
-- Name: TABLE tq_scoring_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_scoring_events TO anon;
GRANT ALL ON TABLE public.tq_scoring_events TO authenticated;
GRANT ALL ON TABLE public.tq_scoring_events TO service_role;


--
-- Name: TABLE tq_teams; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.tq_teams TO anon;
GRANT ALL ON TABLE public.tq_teams TO authenticated;
GRANT ALL ON TABLE public.tq_teams TO service_role;


--
-- Name: TABLE user_activity_logs; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_activity_logs TO anon;
GRANT ALL ON TABLE public.user_activity_logs TO authenticated;
GRANT ALL ON TABLE public.user_activity_logs TO service_role;


--
-- Name: TABLE user_badges; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_badges TO anon;
GRANT ALL ON TABLE public.user_badges TO authenticated;
GRANT ALL ON TABLE public.user_badges TO service_role;


--
-- Name: TABLE user_daily_hpi; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_daily_hpi TO anon;
GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_daily_hpi TO authenticated;
GRANT ALL ON TABLE public.user_daily_hpi TO service_role;


--
-- Name: TABLE user_fantasy_boosters; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_fantasy_boosters TO anon;
GRANT ALL ON TABLE public.user_fantasy_boosters TO authenticated;
GRANT ALL ON TABLE public.user_fantasy_boosters TO service_role;


--
-- Name: TABLE user_fantasy_scores; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_fantasy_scores TO anon;
GRANT ALL ON TABLE public.user_fantasy_scores TO authenticated;
GRANT ALL ON TABLE public.user_fantasy_scores TO service_role;


--
-- Name: TABLE user_fantasy_teams; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_fantasy_teams TO anon;
GRANT ALL ON TABLE public.user_fantasy_teams TO authenticated;
GRANT ALL ON TABLE public.user_fantasy_teams TO service_role;


--
-- Name: TABLE user_masterpasses; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.user_masterpasses TO anon;
GRANT ALL ON TABLE public.user_masterpasses TO authenticated;
GRANT ALL ON TABLE public.user_masterpasses TO service_role;


--
-- Name: TABLE user_onesignal_players; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_onesignal_players TO anon;
GRANT ALL ON TABLE public.user_onesignal_players TO authenticated;
GRANT ALL ON TABLE public.user_onesignal_players TO service_role;


--
-- Name: TABLE user_profile_stats; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_profile_stats TO anon;
GRANT ALL ON TABLE public.user_profile_stats TO authenticated;
GRANT ALL ON TABLE public.user_profile_stats TO service_role;


--
-- Name: TABLE user_spin_states; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_spin_states TO anon;
GRANT ALL ON TABLE public.user_spin_states TO authenticated;
GRANT ALL ON TABLE public.user_spin_states TO service_role;


--
-- Name: TABLE user_streaks; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_streaks TO anon;
GRANT ALL ON TABLE public.user_streaks TO authenticated;
GRANT ALL ON TABLE public.user_streaks TO service_role;


--
-- Name: TABLE user_teams; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_teams TO anon;
GRANT ALL ON TABLE public.user_teams TO authenticated;
GRANT ALL ON TABLE public.user_teams TO service_role;


--
-- Name: TABLE user_tickets; Type: ACL; Schema: public; Owner: -
--

GRANT INSERT,REFERENCES,DELETE,TRIGGER,TRUNCATE,MAINTAIN,UPDATE ON TABLE public.user_tickets TO anon;
GRANT ALL ON TABLE public.user_tickets TO authenticated;
GRANT ALL ON TABLE public.user_tickets TO service_role;


--
-- Name: TABLE xp_events; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.xp_events TO anon;
GRANT ALL ON TABLE public.xp_events TO authenticated;
GRANT ALL ON TABLE public.xp_events TO service_role;


--
-- Name: TABLE xp_formula_config; Type: ACL; Schema: public; Owner: -
--

GRANT ALL ON TABLE public.xp_formula_config TO anon;
GRANT ALL ON TABLE public.xp_formula_config TO authenticated;
GRANT ALL ON TABLE public.xp_formula_config TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR SEQUENCES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON SEQUENCES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR FUNCTIONS; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON FUNCTIONS TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- Name: DEFAULT PRIVILEGES FOR TABLES; Type: DEFAULT ACL; Schema: public; Owner: -
--

ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO postgres;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO anon;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO authenticated;
ALTER DEFAULT PRIVILEGES FOR ROLE supabase_admin IN SCHEMA public GRANT ALL ON TABLES TO service_role;


--
-- PostgreSQL database dump complete
--

\unrestrict nDQcRFHtTZIawaKFFqGfpz1BLUctfOwODBaMd1Cw8T30EbaMIwPaDmfYHu3WRup

