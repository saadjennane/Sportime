import { supabase } from './supabase';
import type { Player, PlayerInput, PlayerWithTeam } from '../types/football';

export const playerService = {
  /**
   * Get all players with optional team information
   */
  async getAll(): Promise<{ data: PlayerWithTeam[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .select(`
        *,
        player_team_association!left(
          teams(name, logo)
        )
      `)
      .order('last_name');

    if (error) return { data: null, error };

    // Transform to include team info
    const players = data?.map((player: any) => ({
      ...player,
      team_name: player.player_team_association?.[0]?.teams?.name,
      team_logo: player.player_team_association?.[0]?.teams?.logo,
    }));

    return { data: players, error: null };
  },

  /**
   * Get player by ID
   */
  async getById(id: string): Promise<{ data: Player | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('id', id)
      .single();

    return { data, error };
  },

  /**
   * Get players by team
   */
  async getByTeam(teamId: string, current = true): Promise<{ data: any[] | null; error: any }> {
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

    const { data, error} = await query.order('start_date', { ascending: false });

    return { data, error };
  },

  /**
   * Get players by position
   */
  async getByPosition(position: string): Promise<{ data: Player[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('position', position)
      .order('last_name');

    return { data, error };
  },

  /**
   * Get players by category (Star/Key/Wild)
   */
  async getByCategory(category: 'Star' | 'Key' | 'Wild'): Promise<{ data: Player[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .eq('category', category)
      .order('pgs', { ascending: false });

    return { data, error };
  },

  /**
   * Create new player
   */
  async create(input: PlayerInput): Promise<{ data: Player | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .insert(input)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Update player
   */
  async update(id: string, input: Partial<PlayerInput>): Promise<{ data: Player | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .update(input)
      .eq('id', id)
      .select()
      .single();

    return { data, error };
  },

  /**
   * Delete player
   */
  async delete(id: string): Promise<{ error: any }> {
    if (!supabase) {
      return { error: new Error('Supabase not initialized') };
    }

    const { error } = await supabase
      .from('players')
      .delete()
      .eq('id', id);

    return { error };
  },

  /**
   * Add player to team
   */
  async addToTeam(
    playerId: string,
    teamId: string,
    startDate: string
  ): Promise<{ data: any | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    // End previous team association if exists
    await supabase
      .from('player_team_association')
      .update({ end_date: startDate })
      .eq('player_id', playerId)
      .is('end_date', null);

    // Create new team association
    const { data, error } = await supabase
      .from('player_team_association')
      .insert({
        player_id: playerId,
        team_id: teamId,
        start_date: startDate,
        end_date: null,
      })
      .select()
      .single();

    return { data, error };
  },

  /**
   * Get player's team history
   */
  async getTeamHistory(playerId: string): Promise<{ data: any[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('player_team_association')
      .select(`
        *,
        teams(name, logo, country)
      `)
      .eq('player_id', playerId)
      .order('start_date', { ascending: false });

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
      .from('fb_players')
      .select('*', { count: 'exact', head: true });

    // Get production count
    const { count: productionCount, error: productionError } = await supabase
      .from('players')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('players')
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
   * Search players by name
   */
  async search(query: string): Promise<{ data: Player[] | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('players')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,name.ilike.%${query}%`)
      .order('last_name')
      .limit(50);

    return { data, error };
  },
};
