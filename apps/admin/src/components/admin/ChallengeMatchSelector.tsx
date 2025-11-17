import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { addMatchesToChallenge } from '../../services/challengeService'

type Fixture = {
  id: string
  date: string
  home_team: { name: string; logo_url: string | null } | null
  away_team: { name: string; logo_url: string | null } | null
  league: { name: string } | null
  status: string | null
}

type SelectedMatch = {
  fixture_id: string
  day_number: number
  fixture: Fixture
}

type ChallengeMatchSelectorProps = {
  challengeId: string
  totalDays: number
  onMatchesAdded?: () => void
}

export function ChallengeMatchSelector({ challengeId, totalDays, onMatchesAdded }: ChallengeMatchSelectorProps) {
  const [fixtures, setFixtures] = useState<Fixture[]>([])
  const [selectedMatches, setSelectedMatches] = useState<SelectedMatch[]>([])
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [dateFilter, setDateFilter] = useState('')
  const [leagueFilter, setLeagueFilter] = useState('')

  useEffect(() => {
    loadFixtures()
  }, [dateFilter, leagueFilter])

  async function loadFixtures() {
    setLoading(true)
    try {
      let query = supabase
        .from('fb_fixtures')
        .select(`
          id,
          date,
          status,
          home_team:fb_teams!fb_fixtures_home_team_id_fkey (
            name,
            logo_url
          ),
          away_team:fb_teams!fb_fixtures_away_team_id_fkey (
            name,
            logo_url
          ),
          league:fb_leagues (
            name
          )
        `)
        .order('date', { ascending: true })
        .limit(100)

      if (dateFilter) {
        const startDate = new Date(dateFilter)
        const endDate = new Date(startDate)
        endDate.setDate(endDate.getDate() + 1)
        query = query.gte('date', startDate.toISOString()).lt('date', endDate.toISOString())
      }

      const { data, error } = await query

      if (error) throw error
      setFixtures(data as unknown as Fixture[])
    } catch (error) {
      console.error('[ChallengeMatchSelector] Failed to load fixtures', error)
    } finally {
      setLoading(false)
    }
  }

  function toggleFixture(fixture: Fixture, day: number) {
    const existingIndex = selectedMatches.findIndex(m => m.fixture_id === fixture.id)

    if (existingIndex >= 0) {
      // Already selected - remove it
      setSelectedMatches(prev => prev.filter((_, i) => i !== existingIndex))
    } else {
      // Add new selection
      setSelectedMatches(prev => [
        ...prev,
        { fixture_id: fixture.id, day_number: day, fixture }
      ])
    }
  }

  function updateDay(fixtureId: string, newDay: number) {
    setSelectedMatches(prev =>
      prev.map(m => m.fixture_id === fixtureId ? { ...m, day_number: newDay } : m)
    )
  }

  async function handleSave() {
    if (selectedMatches.length === 0) {
      alert('Please select at least one match')
      return
    }

    setSaving(true)
    try {
      const matches = selectedMatches.map(m => ({
        fixture_id: m.fixture_id,
        day_number: m.day_number
      }))

      await addMatchesToChallenge(challengeId, matches)
      alert(`Successfully added ${matches.length} matches to challenge`)
      setSelectedMatches([])
      onMatchesAdded?.()
    } catch (error) {
      console.error('[ChallengeMatchSelector] Failed to save matches', error)
      alert('Failed to add matches. See console for details.')
    } finally {
      setSaving(false)
    }
  }

  const isSelected = (fixtureId: string) => selectedMatches.some(m => m.fixture_id === fixtureId)
  const getSelectedDay = (fixtureId: string) => selectedMatches.find(m => m.fixture_id === fixtureId)?.day_number ?? 1

  return (
    <div className="challenge-match-selector">
      <h3>Add Matches to Challenge</h3>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: '1rem', display: 'flex', gap: '1rem' }}>
        <div>
          <label>
            Date:
            <input
              type="date"
              value={dateFilter}
              onChange={e => setDateFilter(e.target.value)}
              style={{ marginLeft: '0.5rem' }}
            />
          </label>
        </div>
        <button onClick={() => { setDateFilter(''); setLeagueFilter('') }}>
          Clear Filters
        </button>
      </div>

      {/* Selected Matches Summary */}
      {selectedMatches.length > 0 && (
        <div className="selected-summary" style={{
          marginBottom: '1rem',
          padding: '1rem',
          backgroundColor: '#f0f0f0',
          borderRadius: '8px'
        }}>
          <h4>Selected: {selectedMatches.length} matches</h4>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.5rem' }}>
            {selectedMatches.map(m => (
              <div key={m.fixture_id} style={{
                padding: '0.5rem',
                backgroundColor: 'white',
                borderRadius: '4px',
                fontSize: '0.9rem'
              }}>
                <div>
                  {m.fixture.home_team?.name} vs {m.fixture.away_team?.name}
                </div>
                <div style={{ marginTop: '0.25rem' }}>
                  <label>
                    Day:
                    <select
                      value={m.day_number}
                      onChange={e => updateDay(m.fixture_id, parseInt(e.target.value))}
                      style={{ marginLeft: '0.5rem' }}
                    >
                      {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                        <option key={day} value={day}>Day {day}</option>
                      ))}
                    </select>
                  </label>
                  <button
                    onClick={() => setSelectedMatches(prev => prev.filter(sm => sm.fixture_id !== m.fixture_id))}
                    style={{ marginLeft: '0.5rem', fontSize: '0.8rem' }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
          <button
            onClick={handleSave}
            disabled={saving}
            style={{
              marginTop: '1rem',
              padding: '0.75rem 1.5rem',
              backgroundColor: '#4CAF50',
              color: 'white',
              border: 'none',
              borderRadius: '4px',
              cursor: saving ? 'not-allowed' : 'pointer'
            }}
          >
            {saving ? 'Saving...' : `Add ${selectedMatches.length} Matches to Challenge`}
          </button>
        </div>
      )}

      {/* Available Fixtures */}
      <div className="fixtures-list">
        <h4>Available Fixtures ({fixtures.length})</h4>
        {loading ? (
          <p>Loading fixtures...</p>
        ) : (
          <div style={{ maxHeight: '500px', overflowY: 'auto' }}>
            {fixtures.map(fixture => {
              const selected = isSelected(fixture.id)
              const selectedDay = getSelectedDay(fixture.id)

              return (
                <div
                  key={fixture.id}
                  style={{
                    padding: '1rem',
                    marginBottom: '0.5rem',
                    border: `2px solid ${selected ? '#4CAF50' : '#ddd'}`,
                    borderRadius: '8px',
                    backgroundColor: selected ? '#e8f5e9' : 'white',
                    cursor: 'pointer',
                    transition: 'all 0.2s'
                  }}
                  onClick={() => !selected && toggleFixture(fixture, 1)}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 'bold', marginBottom: '0.5rem' }}>
                        {fixture.home_team?.name ?? 'Home'} vs {fixture.away_team?.name ?? 'Away'}
                      </div>
                      <div style={{ fontSize: '0.9rem', color: '#666' }}>
                        {fixture.league?.name} • {new Date(fixture.date).toLocaleDateString()} • {fixture.status}
                      </div>
                    </div>
                    {selected ? (
                      <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                        <select
                          value={selectedDay}
                          onChange={e => {
                            e.stopPropagation()
                            updateDay(fixture.id, parseInt(e.target.value))
                          }}
                          onClick={e => e.stopPropagation()}
                          style={{ padding: '0.25rem' }}
                        >
                          {Array.from({ length: totalDays }, (_, i) => i + 1).map(day => (
                            <option key={day} value={day}>Day {day}</option>
                          ))}
                        </select>
                        <button
                          onClick={e => {
                            e.stopPropagation()
                            setSelectedMatches(prev => prev.filter(m => m.fixture_id !== fixture.id))
                          }}
                          style={{
                            padding: '0.25rem 0.5rem',
                            backgroundColor: '#f44336',
                            color: 'white',
                            border: 'none',
                            borderRadius: '4px',
                            cursor: 'pointer'
                          }}
                        >
                          Remove
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          toggleFixture(fixture, 1)
                        }}
                        style={{
                          padding: '0.5rem 1rem',
                          backgroundColor: '#2196F3',
                          color: 'white',
                          border: 'none',
                          borderRadius: '4px',
                          cursor: 'pointer'
                        }}
                      >
                        Add to Day 1
                      </button>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
