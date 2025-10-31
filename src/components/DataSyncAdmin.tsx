import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { apiFootball } from '../lib/apiFootballService'
import { ApiLeagueInfo, ApiTeamInfo, ApiPlayerInfo, ApiFixtureInfo, ApiOddsInfo, ApiSyncConfig } from '../types'
import { DatabaseZap, DownloadCloud, Play, RefreshCw, Server, Settings } from 'lucide-react'

interface DataSyncAdminProps {
  addToast: (message: string, type: 'success' | 'error' | 'info') => void
}

const FREQUENCIES = ['Manual', 'Every hour', 'Every 3 hours', 'Every 6 hours', 'Every 12 hours', 'Daily']
const SYNC_ENDPOINTS = ['fixtures', 'odds']

export const DataSyncAdmin: React.FC<DataSyncAdminProps> = ({ addToast }) => {
  const [loading, setLoading] = useState<string | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [leagueIds, setLeagueIds] = useState('39, 140, 135') // Premier League, La Liga, Serie A
  const [season, setSeason] = useState('2023')
  const [syncConfigs, setSyncConfigs] = useState<ApiSyncConfig[]>([])

  const fetchSyncConfigs = useCallback(async () => {
    if (!supabase) return
    const { data, error } = await supabase.from('api_sync_config').select('*')
    if (error) {
      addToast('Failed to load sync configurations', 'error')
    } else {
      setSyncConfigs(data as ApiSyncConfig[])
    }
  }, [addToast])

  useEffect(() => {
    fetchSyncConfigs()
  }, [fetchSyncConfigs])

  const addProgress = (message: string) => {
    setProgress((prev) => [message, ...prev])
  }

  const handleFrequencyChange = async (endpoint: string, frequency: string) => {
    if (!supabase) return
    const { error } = await supabase
      .from('api_sync_config')
      .upsert({ id: endpoint, frequency }, { onConflict: 'id' })
    if (error) {
      addToast(`Failed to update frequency for ${endpoint}`, 'error')
    } else {
      addToast(`Frequency for ${endpoint} updated to ${frequency}`, 'success')
      fetchSyncConfigs()
    }
  }

  /**
   * Sync leagues (countries + leagues tables)
   */
  const syncLeagues = async (ids: string[]) => {
    if (!supabase) return
    addProgress(`Syncing ${ids.length} leagues...`)
    try {
      for (const id of ids) {
        const data = await apiFootball('/leagues', { id }) as ApiLeagueInfo
        if (data.results > 0) {
          const item = data.response[0]
          // countries
          await supabase.from('countries').upsert({
            id: item.country.name,
            code: item.country.code,
            flag: item.country.flag
          })
          // leagues
          const currentSeason = item.seasons.find((s) => s.current)?.year.toString() || season
          await supabase.from('leagues').upsert({
            id: item.league.id,
            name: item.league.name,
            country_id: item.country.name,
            logo: item.league.logo,
            type: item.league.type,
            season: currentSeason
          })
          addProgress(`Synced league: ${item.league.name}`)
        }
      }
      addToast('Leagues synced successfully!', 'success')
    } catch (e: any) {
      addToast(`Error syncing leagues: ${e.message}`, 'error')
    }
  }

  /**
   * Sync teams for a league+season
   */
  const syncTeamsByLeague = async (leagueId: string, seasonValue: string) => {
    if (!supabase) return []
    addProgress(`Syncing teams for league ${leagueId}, season ${seasonValue}...`)
    try {
      const data = await apiFootball('/teams', { league: leagueId, season: seasonValue }) as ApiTeamInfo
      const teamsToUpsert = data.response.map(({ team }) => ({
        id: team.id,
        name: team.name,
        logo: team.logo,
        country_id: team.country
      }))
      if (teamsToUpsert.length > 0) {
        await supabase.from('teams').upsert(teamsToUpsert)
      }
      addProgress(`Synced ${teamsToUpsert.length} teams for league ${leagueId}.`)
      return teamsToUpsert.map((t) => t.id)
    } catch (e: any) {
      addToast(`Error syncing teams for league ${leagueId}: ${e.message}`, 'error')
      return []
    }
  }

  /**
   * Sync players for a given team+season
   */
  const syncPlayersByTeam = async (teamId: number, seasonValue: string) => {
    if (!supabase) return
    addProgress(`Syncing players for team ${teamId}...`)
    try {
      const data = await apiFootball('/players', { team: teamId.toString(), season: seasonValue }) as ApiPlayerInfo
      const playersToUpsert = data.response.map(({ player, statistics }) => ({
        id: player.id,
        name: player.name,
        age: player.age,
        nationality: player.nationality,
        team_id: teamId,
        photo: player.photo,
        position: statistics[0]?.games?.position || 'Unknown'
      }))
      if (playersToUpsert.length > 0) {
        await supabase.from('players').upsert(playersToUpsert)
      }
      addProgress(`Synced ${playersToUpsert.length} players for team ${teamId}.`)
    } catch (e: any) {
      addToast(`Error syncing players for team ${teamId}: ${e.message}`, 'error')
    }
  }

  /**
   * Full import (countries/leagues → teams → players)
   */
  const handleFullImport = async () => {
    if (!supabase) return
    setLoading('import')
    setProgress([])
    const ids = leagueIds
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean)
    if (ids.length === 0) {
      addToast('Please enter at least one league ID.', 'error')
      setLoading(null)
      return
    }

    await syncLeagues(ids)

    for (const leagueId of ids) {
      const teamIds = await syncTeamsByLeague(leagueId, season)
      for (const teamId of teamIds) {
        await syncPlayersByTeam(teamId, season)
      }
    }

    addProgress('Full import process completed!')
    setLoading(null)
  }

  /**
   * Manual sync for fixtures / odds
   */
  const handleManualSync = async (endpoint: string) => {
    if (!supabase) return
    setLoading(endpoint)
    setProgress([])
    addProgress(`Starting manual sync for ${endpoint}...`)

    try {
      if (endpoint === 'fixtures') {
        const { data: leagues } = await supabase.from('leagues').select('id,season')
        if (!leagues || leagues.length === 0) throw new Error('No leagues found in DB to sync fixtures for.')
        for (const lg of leagues as { id: number; season: string }[]) {
          addProgress(`Fetching fixtures for league ${lg.id}...`)
          const data = await apiFootball('/fixtures', { league: lg.id.toString(), season: lg.season }) as ApiFixtureInfo
          const fixturesToUpsert = data.response.map(({ fixture, league, teams, goals }) => ({
            id: fixture.id,
            league_id: league.id,
            home_team_id: teams.home.id,
            away_team_id: teams.away.id,
            date: fixture.date,
            status: fixture.status.short,
            goals_home: goals.home,
            goals_away: goals.away
          }))
          if (fixturesToUpsert.length > 0) {
            await supabase.from('fixtures').upsert(fixturesToUpsert)
          }
          addProgress(`Synced ${fixturesToUpsert.length} fixtures for league ${lg.id}.`)
        }
      } else if (endpoint === 'odds') {
        // Upcoming fixtures
        const { data: fixtures } = await supabase
          .from('fixtures')
          .select('id')
          .in('status', ['NS', 'TBD', '1H', 'HT', '2H', 'ET', 'P'])

        if (!fixtures || fixtures.length === 0) throw new Error('No upcoming fixtures to fetch odds for.')

        for (const f of fixtures as { id: number }[]) {
          addProgress(`Fetching odds for fixture ${f.id}...`)
          const data = await apiFootball('/odds', { fixture: f.id.toString() }) as ApiOddsInfo
          const matchWinnerBet = data.response[0]?.bookmakers?.[0]?.bets?.find((b) => b.name === 'Match Winner')
          if (matchWinnerBet) {
            const odds = {
              home_win: parseFloat(matchWinnerBet.values.find((v) => v.value === 'Home')?.odd || '0'),
              draw: parseFloat(matchWinnerBet.values.find((v) => v.value === 'Draw')?.odd || '0'),
              away_win: parseFloat(matchWinnerBet.values.find((v) => v.value === 'Away')?.odd || '0')
            }
            await supabase
              .from('odds')
              .upsert(
                {
                  fixture_id: f.id,
                  home_win: odds.home_win,
                  draw: odds.draw,
                  away_win: odds.away_win,
                  bookmaker_name: data.response[0]?.bookmakers?.[0]?.name || 'Unknown'
                },
                { onConflict: 'fixture_id' }
              )
            addProgress(`Synced odds for fixture ${f.id}.`)
          }
        }
      }

      await supabase
        .from('api_sync_config')
        .update({ last_sync_at: new Date().toISOString() })
        .eq('id', endpoint)

      addToast(`${endpoint} synced successfully!`, 'success')
      fetchSyncConfigs()
    } catch (e: any) {
      addToast(`Error during manual sync for ${endpoint}: ${e.message}`, 'error')
    }

    setLoading(null)
  }

  if (!supabase) {
    return (
      <div className="card-base p-5 space-y-4 text-center opacity-50">
        <DatabaseZap className="w-10 h-10 mx-auto text-text-disabled" />
        <h3 className="font-bold text-lg text-text-secondary">Data Sync Disabled</h3>
        <p className="text-sm text-text-disabled">
          Supabase is not configured. Please set <code>USE_SUPABASE</code> to <code>true</code> in{' '}
          <code>src/config/env.ts</code> and provide credentials in <code>.env</code> to enable this feature.
        </p>
      </div>
    )
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
          <label className="block text-sm font-medium text-gray-700 mb-1">League IDs (comma-separated)</label>
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
                    {loading === endpoint ? <RefreshCw size={16} className="animate-spin" /> : <RefreshCw size={16} />}
                  </button>
                </div>
              </div>
            )
          })}
        </div>
        <p className="text-xs text-gray-500 text-center pt-2">
          Note: Automatic syncing requires a backend scheduler (e.g., Supabase Edge Functions on a cron schedule) to
          trigger these functions based on the saved frequency.
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
