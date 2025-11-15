import { supabase } from './supabase';
import type { League, LeagueInput, LeagueWithTeamCount } from '../types/football';

export const leagueService = {
  /**
   * Get all leagues with optional team count
   */
  async getAll(): Promise<{ data: LeagueWithTeamCount[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('leagues')
      .select(`
        *,
        team_league_participation(*)
      `)
      .order('name');

    if (error) return { data: null, error };

    // Transform to include team_count by counting the array
    const leagues = data?.map((league: any) => {
      const { team_league_participation, ...leagueData } = league;
      return {
        ...leagueData,
        team_count: Array.isArray(team_league_participation)
          ? team_league_participation.length
          : 0,
      };
    });

    return { data: leagues, error: null };
  },

  /**
   * Get league by ID
   */
  async getById(id: string): Promise<{ data: League | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('leagues')
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
      .from('leagues')
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
      .from('leagues')
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
      .from('leagues')
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
      .from('team_league_participation')
      .select(`
        *,
        teams(*)
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

    // Get staging count
    const { count: stagingCount, error: stagingError } = await supabase
      .from('fb_leagues')
      .select('*', { count: 'exact', head: true });

    // Get production count
    const { count: productionCount, error: productionError } = await supabase
      .from('leagues')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('leagues')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      staging_count: stagingCount || 0,
      production_count: productionCount || 0,
      last_synced: lastSync?.updated_at || null,
      error: stagingError || productionError,
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
      .from('leagues')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    return { data, error };
  },
};
