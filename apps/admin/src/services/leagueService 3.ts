import { supabase } from './supabase';
import type { League, LeagueInput, LeagueWithTeamCount } from '../types/football';

export const leagueService = {
  /**
   * Get all leagues with optional team count
   */
  async getAll(): Promise<{ data: LeagueWithTeamCount[] | null; error: any }> {
    if (!supabase) {
      console.error('❌ Supabase client is not initialized!');
      console.error('Check your .env file and ensure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY are set');
      return { data: null, error: new Error('Supabase not initialized') };
    }

    console.log('🔍 Fetching leagues from Supabase...');

    // Fetch leagues
    const { data: leagues, error: leaguesError } = await supabase
      .from('fb_leagues')
      .select('*')
      .order('name');

    if (leaguesError) {
      console.error('❌ Supabase query error:', leaguesError);
      return { data: null, error: leaguesError };
    }

    console.log(`✅ Fetched ${leagues?.length || 0} leagues from database`);

    // Fetch team counts for each league via fb_team_league_participation
    const leaguesWithCounts = await Promise.all(
      (leagues || []).map(async (league: any) => {
        const { count, error: countError } = await supabase
          .from('fb_team_league_participation')
          .select('*', { count: 'exact', head: true })
          .eq('league_id', league.id);

        if (countError) {
          console.warn(`⚠️ Error counting teams for league ${league.name}:`, countError);
        }

        return {
          ...league,
          team_count: count || 0,
        };
      })
    );

    return { data: leaguesWithCounts, error: null };
  },

  /**
   * Get league by ID
   */
  async getById(id: string): Promise<{ data: League | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_leagues')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  },

  /**
   * Create new league
   */
  async create(input: LeagueInput): Promise<{ data: League | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_leagues')
      .insert(input)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Update league
   */
  async update(id: string, input: Partial<LeagueInput>): Promise<{ data: League | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_leagues')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Delete league
   */
  async delete(id: string): Promise<{ error: any }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await supabase
      .from('fb_leagues')
      .delete()
      .eq('id', id);

    return { error };
  },

  /**
   * Get teams participating in a league for a specific season
   */
  async getTeams(leagueId: string, season: string): Promise<{ data: any[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_team_league_participation')
      .select(`
        *,
        fb_teams(*)
      `)
      .eq('league_id', leagueId)
      .eq('season', season);

    return { data, error };
  },

  /**
   * Get sync status from staging table
   */
  async getSyncStatus(): Promise<{
    staging_count: number;
    production_count: number;
    last_synced: string | null;
    error: any;
  }> {
    if (!supabase) {
      return {
        staging_count: 0,
        production_count: 0,
        last_synced: null,
        error: new Error('Supabase not initialized')
      };
    }

    // Get count from fb_leagues (now the only table)
    const { count: leaguesCount, error: countError } = await supabase
      .from('fb_leagues')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('fb_leagues')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      staging_count: 0, // No longer using dual table architecture
      production_count: leaguesCount || 0,
      last_synced: lastSync?.updated_at || null,
      error: countError,
    };
  },

  /**
   * Search leagues by name
   */
  async search(query: string): Promise<{ data: League[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_leagues')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    return { data, error };
  },
};
