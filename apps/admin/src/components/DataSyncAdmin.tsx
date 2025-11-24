import React, { useState, useEffect, useCallback } from 'react'
import { supabase } from '../services/supabase'
import { apiFootball } from '../lib/apiFootballService'
import {
  ApiLeagueInfo,
  ApiTeamInfo,
  ApiPlayerInfo,
  ApiFixtureInfo,
  ApiOddsInfo,
  ApiSyncConfig,
} from '../types'
import { DatabaseZap, DownloadCloud, Play, RefreshCw, Server, Settings, Sparkles } from 'lucide-react'
import { PRIORITY_LEAGUES, ALL_AVAILABLE_LEAGUES } from '../data/priorityLeagues'

interface DataSyncAdminProps {
  addToast?: (message: string, type: 'success' | 'error' | 'info') => void
}

const FREQUENCIES = ['Manual', 'Every hour', 'Every 3 hours', 'Every 6 hours', 'Every 12 hours', 'Daily']
const SYNC_ENDPOINTS = ['fixtures', 'odds']

export const DataSyncAdmin: React.FC<DataSyncAdminProps> = ({ addToast }) => {
  const toast = addToast ?? ((msg: string) => console.log('[toast]', msg))
  const [loading, setLoading] = useState<string | null>(null)
  const [progress, setProgress] = useState<string[]>([])
  const [leagueIds, setLeagueIds] = useState('2, 39, 140, 135') // UCL, Premier League, La Liga, Serie A
  const [season, setSeason] = useState('2025')
  const [syncConfigs, setSyncConfigs] = useState<ApiSyncConfig[]>([])

  // Fantasy Data Seeding
  const [fantasyLeagueIds, setFantasyLeagueIds] = useState('2, 39, 140') // UCL, Premier League, La Liga
  const [fantasyProgress, setFantasyProgress] = useState<{stage: string; current: number; total: number; message: string} | null>(null)
  const [fantasySeeding, setFantasySeeding] = useState(false)
  const [playerStatsCount, setPlayerStatsCount] = useState<{total: number; withStats: number} | null>(null)

  const addProgress = (message: string) => setProgress((prev) => [message, ...prev])

  const fetchSyncConfigs = useCallback(async () => {
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
    fetchPlayerStatsCount() // Fetch on mount
  }, [fetchSyncConfigs])

  const fetchPlayerStatsCount = async () => {
    try {
      // Count total players
      const { count: totalPlayers, error: totalError } = await supabase
        .from('fb_players')
        .select('*', { count: 'exact', head: true })
        .not('api_id', 'is', null)

      if (totalError) throw totalError

      // Count players with stats for current season
      const { data: playersWithStats, error: statsError } = await supabase
        .from('player_season_stats')
        .select('player_id')
        .eq('season', Number(season))

      if (statsError) throw statsError

      // Get unique player IDs (in case a player has multiple teams in same season)
      const uniquePlayerIds = new Set(playersWithStats?.map(s => s.player_id) || [])

      setPlayerStatsCount({
        total: totalPlayers || 0,
        withStats: uniquePlayerIds.size
      })
    } catch (error) {
      console.error('Failed to fetch player stats count:', error)
    }
  }

  const handleFrequencyChange = async (endpoint: string, frequency: string) => {
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
    if (!supabase) return
    addProgress(`Syncing ${ids.length} leagues...`)
    try {
      for (const id of ids) {
        const data = await apiFootball<ApiLeagueInfo>('/leagues', { id })
        if (data.results > 0) {
          const item = data.response[0]
          const currentSeason =
            item.seasons.find((s: any) => s.current)?.year?.toString() ?? season

          // Upsert dans la table d'ingestion API-Football
          const { error } = await supabase
            .from('fb_leagues')
            .upsert(
              {
                api_league_id: item.league.id,
                name: item.league.name,
                country: item.country?.name ?? null,
                logo: item.league.logo ?? null,
                type: item.league.type ?? null,
                season: Number(currentSeason),
                payload: item,
              },
              { onConflict: 'api_league_id' }
            )

          if (error) throw error
          addProgress(`Synced league: ${item.league.name} (#${item.league.id})`)
        }
      }
      addToast('Leagues synced successfully!', 'success')
    } catch (e: any) {
      addToast(`Error syncing leagues: ${e.message}`, 'error')
    }
  }

  // TEAMS — par league API id
  const syncTeamsByLeague = async (leagueApiId: string, season: string) => {
    addProgress(`Syncing teams for league ${leagueApiId}, season ${season}...`)
    try {
      const data = await apiFootball<ApiTeamInfo>('/teams', { league: leagueApiId, season })
      const teamsToUpsert =
        data?.response?.map(({ team }) => ({
          id: team.id,
          name: team.name,
          logo: team.logo,
          country_id: team.country,
        })) ?? []

      if (teamsToUpsert.length > 0) {
        const { error } = await supabase.from('fb_teams').upsert(teamsToUpsert, { onConflict: 'id' })
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
    addProgress(`Syncing players for team ${teamId}...`)
    try {
      const data = await apiFootball<ApiPlayerInfo>('/players', { team: String(teamId), season })
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
        const { error } = await supabase.from('fb_players').upsert(playersToUpsert, { onConflict: 'id' })
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

  type LeagueRecord = {
    id: string
    name?: string | null
    api_league_id?: number | null
    season?: string | number | null
  }

  const syncFixturesForLeagues = async (leagues: LeagueRecord[]) => {
    if (!leagues || leagues.length === 0) {
      addProgress('No leagues provided for fixtures sync.')
      return 0
    }

    let totalSynced = 0

    for (const league of leagues) {
      if (!league?.api_league_id) {
        addProgress(`Skipping league ${league?.name ?? league?.id}: missing api_league_id.`)
        continue
      }

      const leagueLabel = `${league.name ?? 'Unknown League'} (#${league.api_league_id})`
      const resolvedSeason =
        league?.season !== null &&
        league?.season !== undefined &&
        String(league.season).trim().length > 0
          ? String(league.season).trim()
          : undefined

      const today = new Date()
      const fromDate = today.toISOString().split('T')[0]
      const futureDate = new Date(today)
      futureDate.setDate(futureDate.getDate() + 30)
      const toDate = futureDate.toISOString().split('T')[0]

      const baseParams: Record<string, string | number> = {
        league: String(league.api_league_id),
        from: fromDate,
        to: toDate,
      }
      if (resolvedSeason) {
        baseParams.season = resolvedSeason
        addProgress(`Fetching fixtures for ${leagueLabel} (season ${resolvedSeason}) from ${fromDate} to ${toDate}...`)
      } else {
        addProgress(`Fetching fixtures for ${leagueLabel} from ${fromDate} to ${toDate}...`)
      }

      let data = await apiFootball<ApiFixtureInfo>('/fixtures', baseParams)
      let responses = Array.isArray(data?.response) ? data.response : []

      if (responses.length === 0) {
        addProgress(`No fixtures returned for ${leagueLabel} in the next 30 days, retrying without date filter...`)
        const fallbackParams: Record<string, string | number> = {
          league: String(league.api_league_id),
        }
        if (resolvedSeason) {
          fallbackParams.season = resolvedSeason
        }
        data = await apiFootball<ApiFixtureInfo>('/fixtures', fallbackParams)
        responses = Array.isArray(data?.response) ? data.response : []
      }

      if (responses.length === 0) {
        addProgress(`No fixtures returned for ${leagueLabel}.`)
        continue
      }

      const fixturesToUpsert =
        responses
          .map((r) => {
            const fixtureId = r?.fixture?.id
            const fixtureDate = r?.fixture?.date
            const homeId = r?.teams?.home?.id
            const awayId = r?.teams?.away?.id

            if (!fixtureId || !fixtureDate || !homeId || !awayId) {
              addProgress(`Skipping fixture with missing data in ${leagueLabel}.`)
              return null
            }

            return {
              id: fixtureId,
              date: fixtureDate,
              status: r?.fixture?.status?.short ?? 'NS',
              league_id: String(league.id),
              home_team_id: homeId,
              away_team_id: awayId,
              goals_home: r?.goals?.home ?? null,
              goals_away: r?.goals?.away ?? null,
            }
          })
          .filter(Boolean) as {
          id: number
          date: string
          status: string
          league_id: string
          home_team_id: number
          away_team_id: number
          goals_home: number | null
          goals_away: number | null
        }[]

      if (fixturesToUpsert.length === 0) {
        addProgress(`No valid fixtures to upsert for ${leagueLabel}.`)
        continue
      }

      const { error: fxErr } = await supabase.from('fb_fixtures').upsert(fixturesToUpsert, { onConflict: 'id' })
      if (fxErr) throw fxErr

      totalSynced += fixturesToUpsert.length
      addProgress(`Synced ${fixturesToUpsert.length} fixtures for ${leagueLabel}.`)
    }

    return totalSynced
  }

  // MANUAL SYNC — fixtures / odds
  const handleManualSync = async (endpoint: string) => {
    setLoading(endpoint)
    setProgress([])
    addProgress(`Starting manual sync for ${endpoint}...`)

    try {
      if (endpoint === 'fixtures') {
        const { data: leagues, error: leaguesErr } = await supabase
          .from('fb_leagues')
          .select('id, name, api_league_id, season')
        if (leaguesErr) throw leaguesErr
        if (!leagues || leagues.length === 0)
          throw new Error('No leagues found in DB to sync fixtures for.')

        const totalSynced = await syncFixturesForLeagues(
          (leagues as LeagueRecord[]).map((lg) => ({
            id: String(lg.id),
            name: lg.name,
            api_league_id: lg.api_league_id,
            season: lg.season,
          }))
        )

        addProgress(`Finished fixtures sync. Total fixtures processed: ${totalSynced}.`)
      } else if (endpoint === 'odds') {
        // First, check all fixtures to understand what we have
        const { data: allFixtures } = await supabase
          .from('fb_fixtures')
          .select('id, status, date')
          .order('date', { ascending: false })
          .limit(10)

        addProgress(`Latest fixtures in DB: ${allFixtures?.map(f => `${f.id} (${f.status}, ${f.date})`).join(', ') || 'none'}`)

        const { data: fixtures, error: fixErr } = await supabase
          .from('fb_fixtures')
          .select('id, api_id, status')
          .in('status', ['NS', 'TBD', '1H', 'HT', '2H', 'ET', 'P'])
        if (fixErr) throw fixErr

        addProgress(`Found ${fixtures?.length || 0} upcoming fixtures`)
        if (fixtures && fixtures.length > 0) {
          for (const fx of fixtures) {
            addProgress(`Fetching odds for fixture ${fx.api_id}...`)
            const data = await apiFootball<ApiOddsInfo>('/odds', { fixture: String(fx.api_id) })

            const matchWinnerBet =
              data?.response?.[0]?.bookmakers?.[0]?.bets?.find((b: any) => b.name === 'Match Winner')

            if (matchWinnerBet) {
              const home = matchWinnerBet.values.find((v: any) => v.value === 'Home')?.odd || '0'
              const draw = matchWinnerBet.values.find((v: any) => v.value === 'Draw')?.odd || '0'
              const away = matchWinnerBet.values.find((v: any) => v.value === 'Away')?.odd || '0'

              const { error: oddsErr } = await supabase
                .from('fb_odds')
                .upsert(
                  {
                    fixture_id: fx.id,
                    home_win: parseFloat(home),
                    draw: parseFloat(draw),
                    away_win: parseFloat(away),
                    bookmaker_name: data?.response?.[0]?.bookmakers?.[0]?.name || 'Unknown',
                  },
                  { onConflict: 'fixture_id,bookmaker_name' }
                )
              if (oddsErr) throw oddsErr

              addProgress(`Synced odds for fixture ${fx.id}.`)
            } else {
              addProgress(`No match-winner odds for fixture ${fx.id}.`)
            }
          }
        } else {
          addProgress('No upcoming fixtures available for odds. Run the fixtures sync first.')
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

  const handleBackfillUcl = async () => {
    setLoading('ucl-backfill')
    setProgress([])
    addProgress('Starting Champions League backfill...')

    try {
      const { data: leagues, error } = await supabase
        .from('fb_leagues')
        .select('id, name, api_league_id, season')
        .or('name.ilike.%Champions%,api_league_id.eq.2')

      if (error) throw error

      const targetLeagues =
        (leagues as LeagueRecord[] | null)?.filter((lg) => !!lg.api_league_id) ?? []

      if (targetLeagues.length === 0) {
        addProgress('No Champions League entries found in leagues table.')
        throw new Error('Champions League league not found in database.')
      }

      await syncFixturesForLeagues(
        targetLeagues.map((lg) => ({
          id: String(lg.id),
          name: lg.name,
          api_league_id: lg.api_league_id,
          season: lg.season,
        }))
      )

      addToast('UCL fixtures backfilled successfully!', 'success')
    } catch (e: any) {
      addToast(`UCL backfill failed: ${e?.message ?? 'unknown error'}`, 'error')
    } finally {
      setLoading(null)
    }
  }

  const handleSyncFixtureSchedules = async (daysAhead: number = 14) => {
    setLoading('fixture-schedules')
    setProgress([])
    addProgress(`Syncing fixture schedules for next ${daysAhead} days...`)

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/sync-fixture-schedules`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          days_ahead: daysAhead,
          update_mode: 'manual',
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fixture schedule sync failed')
      }

      const result = await response.json()

      addProgress(`✅ Sync complete!`)
      addProgress(`   Checked: ${result.checked} fixtures`)
      addProgress(`   Inserted: ${result.inserted || 0} new fixtures`)
      addProgress(`   Updated: ${result.updated} fixtures`)

      if (result.schedule_changes && result.schedule_changes.length > 0) {
        addProgress(`\n⚠️  ${result.schedule_changes.length} schedule change(s) detected:`)
        result.schedule_changes.forEach((change: any) => {
          addProgress(`   ${change.league}: ${change.home_team} vs ${change.away_team}`)
          addProgress(`   ${change.old_date} → ${change.new_date}`)
        })
      } else {
        addProgress('   No schedule changes detected.')
      }

      toast('Fixture schedules synced successfully!', 'success')
    } catch (e: any) {
      toast(`Fixture schedule sync failed: ${e?.message ?? 'unknown error'}`, 'error')
      addProgress(`❌ Error: ${e?.message ?? 'unknown error'}`)
    } finally {
      setLoading(null)
    }
  }

  const handleFantasyDataSeed = async () => {
    // Parse fantasy league IDs from input
    const selectedLeagueIds = fantasyLeagueIds
      .split(',')
      .map(id => id.trim())
      .filter(Boolean)
      .map(id => parseInt(id))

    if (selectedLeagueIds.length === 0) {
      toast('Please enter at least one league ID for Fantasy seeding', 'error')
      return
    }

    // Build league configs from selected IDs
    const selectedLeagues = selectedLeagueIds
      .map(apiId => ALL_AVAILABLE_LEAGUES.find(l => l.api_id === apiId))
      .filter(Boolean)

    if (selectedLeagues.length === 0) {
      toast('No valid leagues found for the provided IDs', 'error')
      return
    }

    setFantasySeeding(true)
    setFantasyProgress({ stage: 'Starting', current: 0, total: selectedLeagues.length, message: 'Initializing Fantasy data seeding...' })

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Supabase configuration missing')
      }

      const response = await fetch(`${supabaseUrl}/functions/v1/seed-fantasy-data`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          leagues: selectedLeagues,
          season: Number(season),
        }),
      })

      if (!response.ok) {
        const error = await response.json()
        throw new Error(error.error || 'Fantasy data seeding failed')
      }

      const result = await response.json()

      // Update progress from result
      if (result.progress && result.progress.length > 0) {
        const lastProgress = result.progress[result.progress.length - 1]
        setFantasyProgress({
          stage: lastProgress.stage,
          current: lastProgress.current,
          total: lastProgress.total,
          message: lastProgress.message,
        })
      }

      toast('Fantasy data seeded successfully!', 'success')
      // Refresh player stats count after successful seeding
      fetchPlayerStatsCount()
    } catch (e: any) {
      toast(`Fantasy data seeding failed: ${e?.message ?? 'unknown error'}`, 'error')
      setFantasyProgress({ stage: 'Error', current: 0, total: 0, message: e?.message ?? 'Unknown error occurred' })
    } finally {
      setFantasySeeding(false)
    }
  }

  return (
    <div className="space-y-6">
      {/* Initial Import Section */}
      <div className="bg-navy-accent rounded-2xl shadow-lg p-5 space-y-4 border border-electric-blue/20">
        <div className="flex items-center gap-3">
          <div className="bg-electric-blue/20 p-2 rounded-full">
            <DownloadCloud className="w-6 h-6 text-electric-blue" />
          </div>
          <h3 className="font-bold text-lg text-text-primary">Initial Data Import</h3>
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">
            League IDs (comma-separated)
          </label>
          <input
            type="text"
            value={leagueIds}
            onChange={(e) => setLeagueIds(e.target.value)}
            className="w-full p-2 bg-deep-navy border-2 border-electric-blue/30 rounded-xl text-text-primary placeholder:text-text-disabled focus:border-electric-blue focus:outline-none"
            placeholder="e.g., 2, 39, 140, 135"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-text-secondary mb-1">Season (Year)</label>
          <input
            type="text"
            value={season}
            onChange={(e) => setSeason(e.target.value)}
            className="w-full p-2 bg-deep-navy border-2 border-electric-blue/30 rounded-xl text-text-primary placeholder:text-text-disabled focus:border-electric-blue focus:outline-none"
            placeholder="e.g., 2025"
          />
        </div>
        <button
          onClick={handleFullImport}
          disabled={!!loading}
          className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-electric-blue to-neon-cyan text-white rounded-xl font-semibold shadow-lg hover:shadow-electric-blue/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading === 'import' ? <RefreshCw className="animate-spin" /> : <Play />}
          Sync Leagues, Teams & Players
        </button>
      </div>

      {/* Ongoing Sync Section */}
      <div className="bg-navy-accent rounded-2xl shadow-lg p-5 space-y-4 border border-electric-blue/20">
        <div className="flex items-center gap-3">
          <div className="bg-warm-yellow/20 p-2 rounded-full">
            <Settings className="w-6 h-6 text-warm-yellow" />
          </div>
          <h3 className="font-bold text-lg text-text-primary">Ongoing Synchronization</h3>
        </div>
        <div className="space-y-3">
          {SYNC_ENDPOINTS.map((endpoint) => {
            const config = syncConfigs.find((c) => c.id === endpoint)
            return (
              <div
                key={endpoint}
                className="bg-deep-navy p-3 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border border-electric-blue/10"
              >
                <span className="font-semibold capitalize text-text-primary">{endpoint}</span>
                <div className="flex items-center gap-2">
                  <select
                    value={config?.frequency || 'Manual'}
                    onChange={(e) => handleFrequencyChange(endpoint, e.target.value)}
                    className="p-2 bg-navy-accent border-2 border-electric-blue/30 rounded-lg text-sm text-text-primary focus:border-electric-blue focus:outline-none"
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
                    className="p-2 bg-electric-blue text-white rounded-lg hover:bg-neon-cyan disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
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
        <div className="pt-3 border-t border-electric-blue/20">
          <button
            onClick={handleBackfillUcl}
            disabled={!!loading}
            className="w-full flex items-center justify-center gap-2 py-2 bg-hot-red text-white rounded-lg font-semibold shadow hover:bg-hot-red/80 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Backfill UCL Now
          </button>
        </div>
        <p className="text-xs text-text-disabled text-center pt-2">
          Note: Automatic syncing requires a backend scheduler (e.g., Supabase Edge Functions on a
          cron schedule) to trigger these functions based on the saved frequency.
        </p>
      </div>

      {/* Fixture Schedule Sync Section */}
      <div className="bg-navy-accent rounded-2xl shadow-lg p-5 space-y-4 border border-neon-cyan/20">
        <div className="flex items-center gap-3">
          <div className="bg-neon-cyan/20 p-2 rounded-full">
            <RefreshCw className="w-6 h-6 text-neon-cyan" />
          </div>
          <h3 className="font-bold text-lg text-text-primary">Fixture Schedule Updates</h3>
        </div>

        <div className="bg-deep-navy p-4 rounded-lg border border-electric-blue/10">
          <h4 className="font-semibold text-text-primary mb-2">⚠️ Why this is important</h4>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>• Football schedules change frequently (TV rights, weather, conflicts)</li>
            <li>• La Liga commonly adjusts times 2-4 weeks before matchday</li>
            <li>• Without updates, users see incorrect kickoff times</li>
            <li>• Automated sync keeps your app data accurate</li>
          </ul>
        </div>

        <div className="bg-deep-navy p-4 rounded-lg border border-electric-blue/10">
          <h4 className="font-semibold text-text-primary mb-2">What this sync does</h4>
          <ul className="text-sm text-text-secondary space-y-1">
            <li>• Fetches upcoming fixtures from API-Football</li>
            <li>• Compares with database to detect changes</li>
            <li>• Updates fixture dates/times when schedules change</li>
            <li>• Logs all detected changes for review</li>
          </ul>
        </div>

        <div className="flex gap-3">
          <button
            onClick={() => handleSyncFixtureSchedules(1)}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-cyan/20 border-2 border-neon-cyan text-neon-cyan rounded-xl font-semibold hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'fixture-schedules' ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            Today Only
          </button>
          <button
            onClick={() => handleSyncFixtureSchedules(7)}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-neon-cyan/20 border-2 border-neon-cyan text-neon-cyan rounded-xl font-semibold hover:bg-neon-cyan/30 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'fixture-schedules' ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            Next 7 Days
          </button>
          <button
            onClick={() => handleSyncFixtureSchedules(14)}
            disabled={!!loading}
            className="flex-1 flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-neon-cyan to-electric-blue text-white rounded-xl font-semibold shadow-lg hover:shadow-neon-cyan/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {loading === 'fixture-schedules' ? <RefreshCw className="animate-spin" size={20} /> : <RefreshCw size={20} />}
            Next 14 Days
          </button>
        </div>

        <div className="bg-lime-glow/10 p-3 rounded-lg border border-lime-glow/20">
          <p className="text-xs text-lime-glow font-semibold">
            ✅ Automated Sync Available
          </p>
          <p className="text-xs text-text-secondary mt-1">
            This sync can run automatically via GitHub Actions or pg_cron.
            See .github/workflows/sync-fixtures.yml or the migration file for setup.
          </p>
        </div>
      </div>

      {/* Fantasy Data Seeding Section */}
      <div className="bg-navy-accent rounded-2xl shadow-lg p-5 space-y-4 border border-warm-yellow/20">
        <div className="flex items-center gap-3">
          <div className="bg-warm-yellow/20 p-2 rounded-full">
            <Sparkles className="w-6 h-6 text-warm-yellow" />
          </div>
          <h3 className="font-bold text-lg text-text-primary">Fantasy Data Seeding</h3>
        </div>
        <div className="space-y-3">
          {/* League IDs Input */}
          <div>
            <label className="block text-sm font-medium text-text-secondary mb-1">
              League IDs for Fantasy Seeding (comma-separated)
            </label>
            <input
              type="text"
              value={fantasyLeagueIds}
              onChange={(e) => setFantasyLeagueIds(e.target.value)}
              className="w-full p-2 bg-deep-navy border-2 border-warm-yellow/30 rounded-xl text-text-primary placeholder:text-text-disabled focus:border-warm-yellow focus:outline-none"
              placeholder="e.g., 2, 39, 140"
            />
            <p className="text-xs text-text-disabled mt-1">
              Default: 2 (Champions League), 39 (Premier League), 140 (La Liga)
            </p>
          </div>

          <div className="bg-deep-navy p-4 rounded-lg border border-warm-yellow/10">
            <h4 className="font-semibold text-text-primary mb-2">
              Selected Leagues ({fantasyLeagueIds.split(',').filter(id => id.trim()).length})
            </h4>
            <p className="text-sm text-text-secondary mb-3">
              Full data including all players, season stats, match-by-match performance, and transfer history
            </p>
            <div className="flex flex-wrap gap-2">
              {fantasyLeagueIds.split(',').filter(id => id.trim()).slice(0, 10).map((id) => {
                const apiId = parseInt(id.trim())
                const league = ALL_AVAILABLE_LEAGUES.find(l => l.api_id === apiId)
                return league ? (
                  <span key={league.api_id} className="px-2 py-1 bg-warm-yellow/10 text-warm-yellow text-xs rounded-lg border border-warm-yellow/20">
                    {league.name}
                  </span>
                ) : (
                  <span key={id} className="px-2 py-1 bg-hot-red/10 text-hot-red text-xs rounded-lg border border-hot-red/20">
                    ID {id} (unknown)
                  </span>
                )
              })}
              {fantasyLeagueIds.split(',').filter(id => id.trim()).length > 10 && (
                <span className="px-2 py-1 bg-warm-yellow/10 text-warm-yellow text-xs rounded-lg border border-warm-yellow/20">
                  +{fantasyLeagueIds.split(',').filter(id => id.trim()).length - 10} more
                </span>
              )}
            </div>
          </div>

          <div className="bg-deep-navy p-4 rounded-lg border border-electric-blue/10">
            <h4 className="font-semibold text-text-primary mb-2">Data to be seeded</h4>
            <ul className="text-sm text-text-secondary space-y-1">
              <li>• {fantasyLeagueIds.split(',').filter(id => id.trim()).length} leagues with full metadata</li>
              <li>• ~{fantasyLeagueIds.split(',').filter(id => id.trim()).length * 20} teams with squad information</li>
              <li>• ~{fantasyLeagueIds.split(',').filter(id => id.trim()).length * 20 * 30} players with complete profiles</li>
              <li>• Season statistics, match-by-match stats, transfer history</li>
              <li>• PGS (Player Game Score) calculation with correct formula</li>
              <li>• Player categorization (Star/Key/Wild)</li>
            </ul>
          </div>

          <div className="bg-hot-red/10 p-3 rounded-lg border border-hot-red/20">
            <p className="text-xs text-hot-red font-semibold">
              ⚠️ API Quota Warning
            </p>
            <p className="text-xs text-text-secondary mt-1">
              This process will use approximately {fantasyLeagueIds.split(',').filter(id => id.trim()).length * 600}-{fantasyLeagueIds.split(',').filter(id => id.trim()).length * 800} API calls.
              With a 7,500 req/day quota, seeding will take {Math.ceil((fantasyLeagueIds.split(',').filter(id => id.trim()).length * 700) / 7500)} day{Math.ceil((fantasyLeagueIds.split(',').filter(id => id.trim()).length * 700) / 7500) > 1 ? 's' : ''} to complete.
              The process can be safely interrupted and resumed.
            </p>
          </div>

          {/* Player Stats Progress Counter */}
          {playerStatsCount && (
            <div className="bg-lime-glow/10 p-4 rounded-lg border border-lime-glow/30">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-lime-glow">
                  Player Stats Progress (Season {season})
                </span>
                <button
                  onClick={fetchPlayerStatsCount}
                  className="text-xs text-lime-glow hover:text-warm-yellow transition-colors"
                  title="Refresh count"
                >
                  <RefreshCw className="w-4 h-4" />
                </button>
              </div>
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-text-secondary">Players with stats:</span>
                  <span className="font-bold text-lime-glow">{playerStatsCount.withStats.toLocaleString()} / {playerStatsCount.total.toLocaleString()}</span>
                </div>
                <div className="w-full bg-black/50 rounded-full h-3">
                  <div
                    className="bg-gradient-to-r from-lime-glow to-warm-yellow h-3 rounded-full transition-all duration-500"
                    style={{ width: `${playerStatsCount.total > 0 ? (playerStatsCount.withStats / playerStatsCount.total) * 100 : 0}%` }}
                  />
                </div>
                <div className="flex items-center justify-between text-xs text-text-disabled">
                  <span>{playerStatsCount.total > 0 ? Math.round((playerStatsCount.withStats / playerStatsCount.total) * 100) : 0}% complete</span>
                  <span>~{Math.ceil((playerStatsCount.total - playerStatsCount.withStats) / 20)} batches remaining</span>
                </div>
              </div>
            </div>
          )}

          <button
            onClick={handleFantasyDataSeed}
            disabled={fantasySeeding || !!loading}
            className="w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-warm-yellow to-hot-red text-white rounded-xl font-semibold shadow-lg hover:shadow-warm-yellow/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            {fantasySeeding ? <RefreshCw className="animate-spin" /> : <Sparkles />}
            {fantasySeeding ? 'Seeding in progress...' : 'Start Fantasy Data Seeding'}
          </button>

          {fantasyProgress && (
            <div className="bg-deep-navy p-4 rounded-lg border border-lime-glow/20">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold text-lime-glow">{fantasyProgress.stage}</span>
                <span className="text-xs text-text-secondary">
                  {fantasyProgress.current} / {fantasyProgress.total}
                </span>
              </div>
              <div className="w-full bg-black/50 rounded-full h-2 mb-2">
                <div
                  className="bg-gradient-to-r from-lime-glow to-warm-yellow h-2 rounded-full transition-all duration-300"
                  style={{ width: `${(fantasyProgress.current / fantasyProgress.total) * 100}%` }}
                />
              </div>
              <p className="text-xs text-text-secondary">{fantasyProgress.message}</p>
            </div>
          )}
        </div>
      </div>

      {/* Progress Log */}
      {loading && (
        <div className="bg-deep-navy rounded-2xl shadow-lg p-5 space-y-2 border border-lime-glow/30">
          <div className="flex items-center gap-2 font-semibold text-lg text-lime-glow">
            <Server />
            <span>Sync Log</span>
          </div>
          <div className="h-48 overflow-y-auto bg-black/50 p-3 rounded-lg font-mono text-xs space-y-1 border border-lime-glow/20">
            {progress.map((msg, i) => (
              <p key={i} className="animate-scale-in text-text-secondary">{`> ${msg}`}</p>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
