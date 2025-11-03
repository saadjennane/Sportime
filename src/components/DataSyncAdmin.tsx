import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabaseClient';
import { apiFootball } from '../lib/apiFootballService'
import {
  ApiLeagueInfo,
  ApiTeamInfo,
  ApiPlayerInfo,
  ApiFixtureInfo,
  ApiOddsInfo,
  ApiSyncConfig,
} from '../types'
import { DatabaseZap, DownloadCloud, Play, RefreshCw, Server, Settings } from 'lucide-react'

interface DataSyncAdminProps {
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void
}

const FREQUENCIES = ['Manual', 'Every hour', 'Every 3 hours', 'Every 6 hours', 'Every 12 hours', 'Daily']
const SYNC_ENDPOINTS = ['fixtures', 'odds']

export const DataSyncAdmin: React.FC<DataSyncAdminProps> = ({ addToast }) => {
  const toast = addToast ?? ((msg: string) => console.log('[toast]', msg))
  const [loading, setLoading] = useState<string | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [leagueIds, setLeagueIds] = useState('39, 140, 135') // Premier League, La Liga, Serie A
  const [season, setSeason] = useState('2023')
  const [syncConfigs, setSyncConfigs] = useState<ApiSyncConfig[]>([])

  const addProgress = (message: string) => setProgress((prev) => [message, ...prev])

  const fetchSyncConfigs = useCallback(async () => {
    if (!supabase) return;
    try {
      const { data, error } = await supabase.from('api_sync_config').select('*')
      if (error) {
        toast('Failed to load sync configurations', 'error')
        setSyncConfigs([])
      } else {
        setSyncConfigs(data || [])
      }
    } catch {
      setSyncConfigs([])
    }
  }, [toast])

  useEffect(() => {
    fetchSyncConfigs()
  }, [fetchSyncConfigs])

  const handleFrequencyChange = async (endpoint: string, frequency: string) => {
    if (!supabase) return;
    try {
      const { error } = await supabase
        .from('api_sync_config')
        .upsert({ id: endpoint, frequency }, { onConflict: 'id' })
      if (error) {
        toast(`Failed to update frequency for ${endpoint}`, 'error')
      } else {
        toast(`Frequency for ${endpoint} updated to ${frequency}`, 'success')
        fetchSyncConfigs()
      }
    } catch {
      toast(`Failed to update frequency for ${endpoint}`, 'error')
    }
  }

  // LEAGUES — écriture via api_league_id (BIGINT)
  const syncLeagues = async (ids: string[]) => {
    if (!supabase) return;
    addProgress(`Syncing ${ids.length} leagues...`)
    try {
      for (const id of ids) {
        const data = await apiFootball<ApiLeagueInfo>('leagues', { id })
        if (data?.results > 0) {
          const item = data.response[0]

          // countries
          await supabase.from('countries').upsert(
            {
              id: item.country.name,
              code: item.country.code,
              flag: item.country.flag,
            },
            { onConflict: 'id' }
          )

          // leagues via api_league_id
          const currentSeason = item.seasons?.find((s: any) => s.current)?.year?.toString() || season
          const { error: upErr } = await supabase
            .from('leagues')
            .upsert(
              {
                api_league_id: item.league.id,
                name: item.league.name,
                logo: item.league.logo,
                type: item.league.type,
                season: currentSeason,
                country_id: item.country.name,
              },
              { onConflict: 'api_league_id' }
            )
          if (upErr) throw upErr

          addProgress(`Synced league: ${item.league.name}`)
        }
      }
      toast('Leagues synced successfully!', 'success')
    } catch (e: any) {
      toast(`Error syncing leagues: ${e?.message ?? 'unknown error'}`, 'error')
    }
  }

  // TEAMS — par league API id
  const syncTeamsByLeague = async (leagueApiId: string, season: string) => {
    if (!supabase) return [];
    addProgress(`Syncing teams for league ${leagueApiId}, season ${season}...`)
    try {
      const data = await apiFootball<ApiTeamInfo>('teams', { league: leagueApiId, season })
      const teamsToUpsert =
        data?.response?.map(({ team }) => ({
          id: team.id,
          name: team.name,
          logo: team.logo,
          country_id: team.country,
        })) ?? []

      if (teamsToUpsert.length > 0) {
        const { error } = await supabase.from('teams').upsert(teamsToUpsert, { onConflict: 'id' })
        if (error) throw error
      }
      addProgress(`Synced ${teamsToUpsert.length} teams for league ${leagueApiId}.`)
      return teamsToUpsert.map((t) => t.id)
    } catch (e: any) {
      toast(`Error syncing teams for league ${leagueApiId}: ${e?.message ?? 'unknown error'}`, 'error')
      return []
    }
  }

  // PLAYERS — par team id
  const syncPlayersByTeam = async (teamId: number, season: string) => {
    if (!supabase) return;
    addProgress(`Syncing players for team ${teamId}...`)
    try {
      const data = await apiFootball<ApiPlayerInfo>('players', { team: String(teamId), season })
      const playersToUpsert =
        data?.response?.map(({ player, statistics }) => ({
          id: player.id,
          name: player.name,
          age: player.age,
          nationality: player.nationality,
          team_id: teamId,
          photo: player.photo,
          position: statistics?.[0]?.games?.position || 'Unknown',
        })) ?? []

      if (playersToUpsert.length > 0) {
        const { error } = await supabase.from('players').upsert(playersToUpsert, { onConflict: 'id' })
        if (error) throw error
      }
      addProgress(`Synced ${playersToUpsert.length} players for team ${teamId}.`)
    } catch (e: any) {
      toast(`Error syncing players for team ${teamId}: ${e?.message ?? 'unknown error'}`, 'error')
    }
  }

  // FULL IMPORT — leagues → teams → players
  const handleFullImport = async () => {
    setLoading('import')
    setProgress([])

    const ids = leagueIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)

    if (ids.length === 0) {
      toast('Please enter at least one league ID.', 'error')
      setLoading(null)
      return
    }

    await syncLeagues(ids)

    for (const leagueApiId of ids) {
      const teamIds = await syncTeamsByLeague(leagueApiId, season)
      for (const teamId of teamIds) {
        await syncPlayersByTeam(teamId, season)
      }
    }

    addProgress('Full import process completed!')
    setLoading(null)
  }

  // MANUAL SYNC — fixtures / odds
  const handleManualSync = async (endpoint: string) => {
    if (!supabase) return;
    setLoading(endpoint)
    setProgress([])
    addProgress(`Starting manual sync for ${endpoint}...`)

    try {
      if (endpoint === 'fixtures') {
        const { data: leagues, error: leaguesErr } = await supabase
          .from('leagues')
          .select('api_league_id,season')
        if (leaguesErr) throw leaguesErr
        if (!leagues || leagues.length === 0)
          throw new Error('No leagues found in DB to sync fixtures for.')

        for (const lg of leagues) {
          const leagueApiId = lg.api_league_id
          addProgress(`Fetching fixtures for league ${leagueApiId}...`)
          const data = await apiFootball<ApiFixtureInfo>('fixtures', {
            league: String(leagueApiId),
            season: lg.season,
          })

          const fixturesToUpsert =
            data?.response?.map(({ fixture, league, teams, goals }) => ({
              id: fixture.id,
              league_id: league.id,
              home_team_id: teams.home.id,
              away_team_id: teams.away.id,
              date: fixture.date,
              status: fixture.status.short,
              goals_home: goals.home,
              goals_away: goals.away,
            })) ?? []

          if (fixturesToUpsert.length > 0) {
            const { error: fxErr } = await supabase.from('fixtures').upsert(fixturesToUpsert, { onConflict: 'id' })
            if (fxErr) throw fxErr
          }
          addProgress(`Synced ${fixturesToUpsert.length} fixtures for league ${leagueApiId}.`)
        }
      } else if (endpoint === 'odds') {
        const { data: fixtures, error: fixErr } = await supabase
          .from('fixtures')
          .select('id, status')
          .in('status', ['NS', 'TBD', '1H', 'HT', '2H', 'ET', 'P'])
        if (fixErr) throw fixErr
        if (!fixtures || fixtures.length === 0) throw new Error('No upcoming fixtures to fetch odds for.')

        for (const fx of fixtures) {
          addProgress(`Fetching odds for fixture ${fx.id}...`)
          const data = await apiFootball<ApiOddsInfo>('odds', { fixture: String(fx.id) })

          const matchWinnerBet =
            data?.response?.[0]?.bookmakers?.[0]?.bets?.find((b: any) => b.name === 'Match Winner')

          if (matchWinnerBet) {
            const home = matchWinnerBet.values.find((v: any) => v.value === 'Home')?.odd || '0'
            const draw = matchWinnerBet.values.find((v: any) => v.value === 'Draw')?.odd || '0'
            const away = matchWinnerBet.values.find((v: any) => v.value === 'Away')?.odd || '0'

            const { error: oddsErr } = await supabase
              .from('odds')
              .upsert(
                {
                  fixture_id: fx.id,
                  home_win: parseFloat(home),
                  draw: parseFloat(draw),
                  away_win: parseFloat(away),
                  bookmaker_name: data?.response?.[0]?.bookmakers?.[0]?.name || 'Unknown',
                },
                { onConflict: 'fixture_id' }
              )
            if (oddsErr) throw oddsErr

            addProgress(`Synced odds for fixture ${fx.id}.`)
          } else {
            addProgress(`No match-winner odds for fixture ${fx.id}.`)
          }
        }
      }

      await supabase
        .from('api_sync_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', endpoint)

      toast(`${endpoint} synced successfully!`, 'success')
      fetchSyncConfigs()
    } catch (e: any) {
      toast(`Error during manual sync for ${endpoint}: ${e?.message ?? 'unknown error'}`, 'error')
    }

    setLoading(null)
  }

  return (
    <div className="space-y-6">
      {/* Initial Import Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-purple-100 p-2 rounded-full">
            <DownloadCloud className="w-6 h-6 text-purple-600" />
          </div>
          <h3 className="font-bold text-lg text-gray-800">Initial Data Import</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            League IDs (comma-separated)
          </label>
          <input
            type="text"
            value={leagueIds}
            onChange={(e) => setLeagueIds(e.target.value)}
            className="w-full p-2 border-2 border-gray-200 rounded-xl"
            placeholder="e.g., 39, 140, 135"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Season (Year)</label>
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full p-2 border-2 border-gray-200 rounded-xl"
            placeholder="e.g., 2023"
          />
        </div>
        <button
          onClick={handleFullImport}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold shadow-lg disabled:opacity-50"
        >
          {loading === 'import' ? <RefreshCw className="animate-spin" /> : <Play />}
          Sync Leagues, Teams & Players
        </button>
      </div>

      {/* Ongoing Sync Section */}
      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="bg-blue-100 p-2 rounded-full">
            <Settings className="w-6 h-6 text-blue-600" />
          </div>
          <h3 className="font-bold text-lg text-gray-800">Ongoing Synchronization</h3>
        </div>
        <div className="space-y-3">
          {SYNC_ENDPOINTS.map((endpoint) => {
            const config = syncConfigs.find((c) => c.id === endpoint)
            return (
              <div
                key={endpoint}
                className="bg-gray-50 p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
              >
                <span className="font-semibold capitalize">{endpoint}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={config?.frequency || 'Manual'}
                    onChange={(e) => handleFrequencyChange(endpoint, e.target.value)}
                    className="p-2 border-2 border-gray-200 rounded-lg text-sm"
                  >
                    {FREQUENCIES.map((freq) => (
                      <option key={freq} value={freq}>
                        {freq}
                      </option>
                    ))}
                  </select>
                  <button
                    onClick={() => handleManualSync(endpoint)}
                    disabled={!!loading}
                    className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 disabled:opacity-50"
                    title={`Sync ${endpoint} now`}
                  >
                    {loading === endpoint ? (
                      <RefreshCw size={16} className="animate-spin" />
                    ) : (
                      <RefreshCw size={16} />
                    )}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 text-center pt-2">
          Note: Automatic syncing requires a backend scheduler (e.g., Supabase Edge Functions on a
          cron schedule) to trigger these functions based on the saved frequency.
        </p>
      </div>

      {/* Progress Log */}
      {loading && (
        <div className="bg-gray-800 text-white rounded-2xl shadow-lg p-5 space-y-2">
          <div className="flex items-center gap-2 font-semibold text-lg">
            <Server />
            <span>Sync Log</span>
          </div>
          <div className="h-48 overflow-y-auto bg-black/30 p-3 rounded-lg font-mono text-xs space-y-1">
            {progress.map((msg, i) => (
              <p key={i} className="animate-scale-in">{`> ${msg}`}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
