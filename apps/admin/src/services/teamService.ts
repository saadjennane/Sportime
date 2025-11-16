import { supabase } from './supabase';
import type { Team, TeamInput, TeamWithCounts } from '../types/football';

export const teamService = {
  /**
   * Get all teams with optional league and player counts
   */
  async getAll(): Promise<{ data: TeamWithCounts[] | null; error: any }> {
    if (!supabase) {
      console.error('❌ Supabase client is not initialized!');
      return { data: null, error: new Error('Supabase not initialized') };
    }

    console.log('🔍 Fetching teams from Supabase...');

    // Fetch teams
    const { data: teams, error: teamsError } = await supabase
      .from('teams')
      .select('*')
      .order('name');

    if (teamsError) {
      console.error('❌ Supabase query error:', teamsError);
      return { data: null, error: teamsError };
    }

    console.log(`✅ Fetched ${teams?.length || 0} teams from database`);

    // Fetch league and player counts for each team
    const teamsWithCounts = await Promise.all(
      (teams || []).map(async (team: any) => {
        // Count leagues via team_league_participation
        const { count: leagueCount, error: leagueError } = await supabase
          .from('team_league_participation')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        if (leagueError) {
          console.warn(`⚠️ Error counting leagues for team ${team.name}:`, leagueError);
        }

        // Count players via player_team_association
        const { count: playerCount, error: playerError } = await supabase
          .from('player_team_association')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        if (playerError) {
          console.warn(`⚠️ Error counting players for team ${team.name}:`, playerError);
        }

        return {
          ...team,
          league_count: leagueCount || 0,
          player_count: playerCount || 0,
        };
      })
    );

    return { data: teamsWithCounts, error: null };
  },

  /**
   * Get team by ID
   */
  async getById(id: string): Promise<{ data: Team | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  },

  /**
   * Get teams by league
   */
  async getByLeague(leagueId: string, season?: string): Promise<{ data: any[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    let query = supabase
      .from('team_league_participation')
      .select(`
        *,
        teams(*)
      `)
      .eq('league_id', leagueId);

    if (season) {
      query = query.eq('season', season);
    }

    const { data, error } = await query;

    return { data, error };
  },

  /**
   * Create new team
   */
  async create(input: TeamInput): Promise<{ data: Team | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('teams')
      .insert(input)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Update team
   */
  async update(id: string, input: Partial<TeamInput>): Promise<{ data: Team | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('teams')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Delete team
   */
  async delete(id: string): Promise<{ error: any }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await supabase
      .from('teams')
      .delete()
      .eq('id', id);

    return { error };
  },

  /**
   * Get players in a team
   */
  async getPlayers(teamId: string, current = true): Promise<{ data: any[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    let query = supabase
      .from('player_team_association')
      .select(`
        *,
        players(*)
      `)
      .eq('team_id', teamId);

    if (current) {
      query = query.is('end_date', null);
    }

    const { data, error } = await query.order('start_date', { ascending: false });

    return { data, error };
  },

  /**
   * Add team to league
   */
  async addToLeague(
    teamId: string,
    leagueId: string,
    season: string,
    group?: string
  ): Promise<{ data: any | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('team_league_participation')
      .insert({
        team_id: teamId,
        league_id: leagueId,
        season,
        group,
      })
      .select()
      .single();

    return { data, error };
  },

  /**
   * Remove team from league
   */
  async removeFromLeague(teamId: string, leagueId: string, season: string): Promise<{ error: any }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await supabase
      .from('team_league_participation')
      .delete()
      .eq('team_id', teamId)
      .eq('league_id', leagueId)
      .eq('season', season);

    return { error };
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
      .from('fb_teams')
      .select('*', { count: 'exact', head: true });

    // Get production count
    const { count: productionCount, error: productionError } = await supabase
      .from('teams')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('teams')
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
   * Search teams by name
   */
  async search(query: string): Promise<{ data: Team[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('teams')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    return { data, error };
  },
};
