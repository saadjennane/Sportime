/**
 * Game Configuration Admin Panel
 *
 * Allows super_admin to manage all game configurations
 * 5 sections: Rewards, Progression, Tournament, PGS Formula, Badges
 */

import { useState, useEffect } from 'react'
import { supabase } from '../../services/supabase'
import { configService } from '../../services/configService'
import type { GameConfig } from '../../types/config'
import { useIsSuperAdmin } from '../../hooks/useUserRole'

type ConfigSection = 'rewards' | 'progression' | 'tournament' | 'pgs_formula' | 'badges'

export function GameConfigAdmin() {
  const [configs, setConfigs] = useState<GameConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [hasUnpublishedChanges, setHasUnpublishedChanges] = useState(false)
  const [activeSection, setActiveSection] = useState<ConfigSection>('rewards')
  const [editedConfigs, setEditedConfigs] = useState<Map<string, any>>(new Map())
  const [lastPublished, setLastPublished] = useState<{ by: string; at: string } | null>(null)

  const isSuperAdmin = useIsSuperAdmin()

  useEffect(() => {
    if (isSuperAdmin) {
      loadConfigs()
    }
  }, [isSuperAdmin])

  async function loadConfigs() {
    setLoading(true)
    try {
      const allConfigs = await configService.getAllConfigs()
      setConfigs(allConfigs)

      // Get last published info from cache version config
      const cacheVersionConfig = allConfigs.find(c => c.id === 'config_cache_version')
      if (cacheVersionConfig && cacheVersionConfig.updated_by) {
        setLastPublished({
          by: cacheVersionConfig.updated_by,
          at: cacheVersionConfig.updated_at,
        })
      }
    } catch (error) {
      console.error('[GameConfigAdmin] Failed to load configs:', error)
      alert('Failed to load configurations. See console for details.')
    } finally {
      setLoading(false)
    }
  }

  async function handleSaveDraft() {
    if (editedConfigs.size === 0) {
      alert('No changes to save')
      return
    }

    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // Save all edited configs
      for (const [configId, newValue] of editedConfigs.entries()) {
        await configService.updateConfig(configId, newValue, user.id)
      }

      setHasUnpublishedChanges(true)
      setEditedConfigs(new Map())
      alert(`Saved ${editedConfigs.size} config(s) as draft`)
      await loadConfigs()
    } catch (error) {
      console.error('[GameConfigAdmin] Failed to save draft:', error)
      alert('Failed to save changes. See console for details.')
    } finally {
      setSaving(false)
    }
  }

  async function handlePublish() {
    if (!confirm('Publish all changes? This will invalidate frontend caches and apply configs immediately.')) {
      return
    }

    setPublishing(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      await configService.publishConfigs(user.id)

      setHasUnpublishedChanges(false)
      alert('Configurations published successfully!')
      await loadConfigs()
    } catch (error) {
      console.error('[GameConfigAdmin] Failed to publish:', error)
      alert('Failed to publish changes. See console for details.')
    } finally {
      setPublishing(false)
    }
  }

  function handleConfigEdit(configId: string, newValue: any) {
    const updated = new Map(editedConfigs)
    updated.set(configId, newValue)
    setEditedConfigs(updated)
  }

  function getConfigValue(config: GameConfig): any {
    return editedConfigs.get(config.id) ?? config.value
  }

  if (!isSuperAdmin) {
    return (
      <div className="p-8 text-center">
        <h2 className="text-2xl font-bold mb-4">Access Denied</h2>
        <p className="text-text-secondary">
          You must be a super admin to access game configuration.
        </p>
      </div>
    )
  }

  if (loading) {
    return <div className="p-8 text-center">Loading configurations...</div>
  }

  const sectionConfigs = configs.filter(c => c.category === activeSection)

  return (
    <div className="game-config-admin p-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-3xl font-bold mb-2">Game Configuration</h1>
        <p className="text-text-secondary">
          Manage all game settings, formulas, and rewards
        </p>
      </div>

      {/* Status Bar */}
      <div className="bg-surface-elevated p-4 rounded-lg mb-6 flex items-center justify-between">
        <div>
          {hasUnpublishedChanges || editedConfigs.size > 0 ? (
            <div className="flex items-center gap-2">
              <span className="text-yellow-500 text-xl">⚠️</span>
              <span className="text-yellow-500 font-medium">
                {editedConfigs.size > 0 ? `${editedConfigs.size} unsaved changes` : 'Unpublished Changes'}
              </span>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <span className="text-green-500 text-xl">✅</span>
              <span className="text-green-500 font-medium">Published</span>
            </div>
          )}
          {lastPublished && (
            <p className="text-sm text-text-disabled mt-1">
              Last published: {new Date(lastPublished.at).toLocaleString()}
            </p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            onClick={handleSaveDraft}
            disabled={saving || editedConfigs.size === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {saving ? 'Saving...' : `💾 Save Draft (${editedConfigs.size})`}
          </button>
          <button
            onClick={handlePublish}
            disabled={publishing || (!hasUnpublishedChanges && editedConfigs.size === 0)}
            className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
          >
            {publishing ? 'Publishing...' : '🚀 Publish Changes'}
          </button>
        </div>
      </div>

      {/* Section Tabs */}
      <div className="flex gap-2 mb-6 border-b border-border-primary">
        {[
          { id: 'rewards' as const, label: '💰 Rewards', icon: '💰' },
          { id: 'progression' as const, label: '📊 Progression', icon: '📊' },
          { id: 'tournament' as const, label: '🎫 Tournament', icon: '🎫' },
          { id: 'pgs_formula' as const, label: '🧮 PGS Formula', icon: '🧮' },
          { id: 'badges' as const, label: '🏅 Badges', icon: '🏅' },
        ].map(section => (
          <button
            key={section.id}
            onClick={() => setActiveSection(section.id)}
            className={`px-4 py-2 font-medium transition-colors ${
              activeSection === section.id
                ? 'text-primary border-b-2 border-primary'
                : 'text-text-secondary hover:text-text-primary'
            }`}
          >
            {section.label}
          </button>
        ))}
      </div>

      {/* Config Editor */}
      <div className="space-y-6">
        {sectionConfigs.map(config => (
          <ConfigEditor
            key={config.id}
            config={config}
            value={getConfigValue(config)}
            onChange={(newValue) => handleConfigEdit(config.id, newValue)}
          />
        ))}

        {sectionConfigs.length === 0 && (
          <p className="text-center text-text-disabled py-8">
            No configurations in this section
          </p>
        )}
      </div>
    </div>
  )
}

// ============================================================================
// Config Editor Component
// ============================================================================

type ConfigEditorProps = {
  config: GameConfig
  value: any
  onChange: (newValue: any) => void
}

function ConfigEditor({ config, value, onChange }: ConfigEditorProps) {
  const [jsonString, setJsonString] = useState('')
  const [jsonError, setJsonError] = useState('')
  const [editMode, setEditMode] = useState<'visual' | 'json'>('visual')

  useEffect(() => {
    setJsonString(JSON.stringify(value, null, 2))
  }, [value])

  function handleJsonChange(newJson: string) {
    setJsonString(newJson)
    try {
      const parsed = JSON.parse(newJson)
      setJsonError('')
      onChange(parsed)
    } catch (error) {
      setJsonError('Invalid JSON')
    }
  }

  function handleVisualChange(key: string, newVal: any) {
    const updated = { ...value, [key]: newVal }
    onChange(updated)
  }

  return (
    <div className="bg-surface-elevated p-4 rounded-lg border border-border-primary">
      <div className="flex items-start justify-between mb-3">
        <div>
          <h3 className="font-bold text-lg">{config.key.replace(/_/g, ' ').toUpperCase()}</h3>
          {config.description && (
            <p className="text-sm text-text-secondary mt-1">{config.description}</p>
          )}
        </div>

        <div className="flex gap-2">
          <button
            onClick={() => setEditMode('visual')}
            className={`px-3 py-1 text-sm rounded ${editMode === 'visual' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'}`}
          >
            Visual
          </button>
          <button
            onClick={() => setEditMode('json')}
            className={`px-3 py-1 text-sm rounded ${editMode === 'json' ? 'bg-primary text-white' : 'bg-surface text-text-secondary'}`}
          >
            JSON
          </button>
        </div>
      </div>

      {editMode === 'json' ? (
        <div>
          <textarea
            value={jsonString}
            onChange={(e) => handleJsonChange(e.target.value)}
            className="w-full p-3 bg-surface border border-border-primary rounded font-mono text-sm"
            rows={8}
          />
          {jsonError && <p className="text-red-500 text-sm mt-1">{jsonError}</p>}
        </div>
      ) : (
        <div className="space-y-3">
          {typeof value === 'object' && value !== null && !Array.isArray(value) ? (
            Object.entries(value).map(([key, val]) => (
              <div key={key} className="flex items-center gap-3">
                <label className="w-40 font-medium">{key}:</label>
                {typeof val === 'number' || val === null ? (
                  <input
                    type="number"
                    value={val ?? ''}
                    onChange={(e) => handleVisualChange(key, e.target.value === '' ? null : Number(e.target.value))}
                    className="flex-1 p-2 bg-surface border border-border-primary rounded"
                  />
                ) : typeof val === 'string' ? (
                  <input
                    type="text"
                    value={val}
                    onChange={(e) => handleVisualChange(key, e.target.value)}
                    className="flex-1 p-2 bg-surface border border-border-primary rounded"
                  />
                ) : typeof val === 'boolean' ? (
                  <input
                    type="checkbox"
                    checked={val}
                    onChange={(e) => handleVisualChange(key, e.target.checked)}
                    className="w-5 h-5"
                  />
                ) : (
                  <span className="flex-1 p-2 bg-surface-disabled rounded text-sm text-text-disabled">
                    {JSON.stringify(val)}
                  </span>
                )}
              </div>
            ))
          ) : Array.isArray(value) ? (
            <div>
              <p className="text-sm text-text-secondary mb-2">Array with {value.length} items</p>
              <pre className="p-3 bg-surface rounded text-sm">{JSON.stringify(value, null, 2)}</pre>
            </div>
          ) : (
            <input
              type="text"
              value={String(value)}
              onChange={(e) => onChange(e.target.value)}
              className="w-full p-2 bg-surface border border-border-primary rounded"
            />
          )}
        </div>
      )}
    </div>
  )
}
