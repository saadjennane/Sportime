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
      .from('fb_teams')
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
        // Count leagues via fb_team_league_participation
        const { count: leagueCount, error: leagueError } = await supabase
          .from('fb_team_league_participation')
          .select('*', { count: 'exact', head: true })
          .eq('team_id', team.id);

        if (leagueError) {
          console.warn(`⚠️ Error counting leagues for team ${team.name}:`, leagueError);
        }

        // Count players via fb_player_team_association
        const { count: playerCount, error: playerError } = await supabase
          .from('fb_player_team_association')
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
   * Server-side paginated + searchable list. Counts are computed only for the
   * current page (50 head queries) instead of ~2× per team across all 1000+ teams.
   */
  async getPaged({ q = '', country = '', page = 0, pageSize = 50 }: { q?: string; country?: string; page?: number; pageSize?: number }):
    Promise<{ data: TeamWithCounts[]; count: number; error: any }> {
    if (!supabase) return { data: [], count: 0, error: new Error('Supabase not initialized') };
    const from = page * pageSize;
    const to = from + pageSize - 1;
    let query = supabase.from('fb_teams').select('*', { count: 'exact' });
    if (q.trim()) query = query.ilike('name', `%${q.trim()}%`);
    if (country.trim()) query = query.eq('country', country.trim());
    const { data: teams, error, count } = await query.order('name').range(from, to);
    if (error) return { data: [], count: 0, error };
    const withCounts = await Promise.all((teams ?? []).map(async (team: any) => {
      const [{ count: lg }, { count: pl }] = await Promise.all([
        supabase!.from('fb_team_league_participation').select('*', { count: 'exact', head: true }).eq('team_id', team.id),
        supabase!.from('fb_player_team_association').select('*', { count: 'exact', head: true }).eq('team_id', team.id),
      ]);
      return { ...team, league_count: lg || 0, player_count: pl || 0 };
    }));
    return { data: withCounts, count: count ?? 0, error: null };
  },

  /** Resolve a team by UUID or API id (used by the bulk player import). */
  async findByIdentifier(identifier: string): Promise<any | null> {
    if (!supabase) return null;
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(identifier);
    const col = isUuid ? 'id' : 'api_id';
    const { data } = await supabase.from('fb_teams').select('id, name, api_id').eq(col, identifier).maybeSingle();
    return data;
  },

  /** Distinct country list for the filter dropdown (cheap, one column). */
  async getCountries(): Promise<string[]> {
    if (!supabase) return [];
    const { data } = await supabase.from('fb_teams').select('country').order('country');
    return Array.from(new Set((data ?? []).map((r: any) => r.country).filter(Boolean))) as string[];
  },

  /**
   * Get team by ID
   */
  async getById(id: string): Promise<{ data: Team | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_teams')
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
      .from('fb_team_league_participation')
      .select(`
        *,
        fb_teams(*)
      `)
      .eq('league_id', leagueId);

    if (season) {
      query = query.eq('season', season);
    }

    const { data, error } = await query;

    return { data, error };
  },

  // Only the columns that actually exist on fb_teams — the form historically also
  // carried founded/venue_* which aren't real columns and made every save 400.
  _clean(input: Partial<TeamInput>): Record<string, any> {
    const allowed = ['name', 'logo_url', 'logo', 'country', 'code'] as const;
    const out: Record<string, any> = {};
    for (const k of allowed) if ((input as any)[k] !== undefined) out[k] = (input as any)[k];
    return out;
  },

  /**
   * Create new team
   */
  async create(input: TeamInput): Promise<{ data: Team | null; error: any }> {
    if (!supabase) {
      return { data: null, error: new Error('Supabase not initialized') };
    }

    const { data, error } = await supabase
      .from('fb_teams')
      .insert(this._clean(input))
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
      .from('fb_teams')
      .update(this._clean(input))
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
      .from('fb_teams')
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
      .from('fb_player_team_association')
      .select(`
        *,
        fb_players(*)
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
      .from('fb_team_league_participation')
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
      .from('fb_team_league_participation')
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

    // Get count from fb_teams (now the only table)
    const { count: teamsCount, error: countError } = await supabase
      .from('fb_teams')
      .select('*', { count: 'exact', head: true });

    // Get last synced timestamp
    const { data: lastSync } = await supabase
      .from('fb_teams')
      .select('updated_at')
      .order('updated_at', { ascending: false })
      .limit(1)
      .single();

    return {
      staging_count: 0, // No longer using dual table architecture
      production_count: teamsCount || 0,
      last_synced: lastSync?.updated_at || null,
      error: countError,
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
      .from('fb_teams')
      .select('*')
      .ilike('name', `%${query}%`)
      .order('name')
      .limit(50);

    return { data, error };
  },
};
