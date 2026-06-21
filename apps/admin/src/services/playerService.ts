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
      .from('fb_players')
      .select(`
        *,
        fb_player_team_association!left(
          fb_teams(name, logo)
        )
      `)
      .order('last_name');

    if (error) return { data: null, error };

    // Transform to include team info
    const players = data?.map((player: any) => ({
      ...player,
      team_name: player.fb_player_team_association?.[0]?.fb_teams?.name,
      team_logo: player.fb_player_team_association?.[0]?.fb_teams?.logo,
    }));

    return { data: players, error: null };
  },

  /**
   * Server-side paginated + searchable list (avoids loading all ~22k players).
   */
  async getPaged({ q = '', team = '', page = 0, pageSize = 50 }: { q?: string; team?: string; page?: number; pageSize?: number }):
    Promise<{ data: PlayerWithTeam[]; count: number; error: any }> {
    if (!supabase) return { data: [], count: 0, error: new Error('Supabase not initialized') };
    const from = page * pageSize;
    const to = from + pageSize - 1;
    const t = team.trim();
    const rel = t
      ? 'fb_player_team_association!inner(team_id, fb_teams!inner(name, logo))'
      : 'fb_player_team_association!left(fb_teams(name, logo))';
    let query = supabase.from('fb_players').select(`*, ${rel}`, { count: 'exact' });
    const s = q.trim();
    if (s) query = query.or(`first_name.ilike.%${s}%,last_name.ilike.%${s}%,name.ilike.%${s}%`);
    if (t) query = query.ilike('fb_player_team_association.fb_teams.name', `%${t}%`);
    const { data, error, count } = await query.order('last_name').range(from, to);
    const rows = (data ?? []).map((p: any) => ({
      ...p,
      team_name: p.fb_player_team_association?.[0]?.fb_teams?.name,
      team_logo: p.fb_player_team_association?.[0]?.fb_teams?.logo,
    }));
    return { data: rows, count: count ?? 0, error };
  },

  /**
   * Get player by ID
   */
  async getById(id: string): Promise<{ data: Player | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_players')
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
      .from('fb_player_team_association')
      .select(`
        *,
        fb_players(*)
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
      .from('fb_players')
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
      .from('fb_players')
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
      .from('fb_players')
      .insert(input)
      .select()
      .single();

    return { data, error };
  },

  // Only real fb_players columns (mirrors the teams fix — avoids PGRST204 on save).
  _clean(input: Partial<PlayerInput> & Record<string, any>): Record<string, any> {
    const allowed = ['name', 'first_name', 'last_name', 'position', 'team_id', 'photo', 'photo_url', 'nationality', 'injured', 'api_id'];
    const out: Record<string, any> = {};
    for (const k of allowed) if ((input as any)[k] !== undefined) out[k] = (input as any)[k];
    return out;
  },

  /**
   * Update player
   */
  async update(id: string, input: Partial<PlayerInput>): Promise<{ data: Player | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_players')
      .update(this._clean(input))
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
      .from('fb_players')
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
      .from('fb_player_team_association')
      .update({ end_date: startDate })
      .eq('player_id', playerId)
      .is('end_date', null);

    // Create new team association
    const { data, error } = await supabase
      .from('fb_player_team_association')
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
      .from('fb_player_team_association')
      .select(`
        *,
        fb_teams(name, logo, country)
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

    // Get count from fb_players (now the only table)
    const { count: playersCount, error: countError } = await supabase
      .from('fb_players')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('fb_players')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      staging_count: 0, // No longer using dual table architecture
      production_count: playersCount || 0,
      last_synced: lastSync?.updated_at || null,
      error: countError,
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
      .from('fb_players')
      .select('*')
      .or(`first_name.ilike.%${query}%,last_name.ilike.%${query}%,name.ilike.%${query}%`)
      .order('last_name')
      .limit(50);

    return { data, error };
  },
};
