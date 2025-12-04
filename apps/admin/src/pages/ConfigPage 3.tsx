/**
 * Game Configuration Page
 *
 * Admin page for managing all game configurations including:
 * - Rewards (daily streaks, starting coins, etc.)
 * - Progression (level thresholds, bet limits)
 * - Tournament (costs, multipliers, ticket rules)
 * - PGS Formula (XP calculation coefficients)
 * - Badges (default XP, condition types)
 */

import { GameConfigAdmin } from '../components/admin/GameConfigAdmin'

export function ConfigPage() {
  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold mb-2">Game Configuration</h1>
        <p className="text-text-secondary">
          Manage all game settings, formulas, and rewards. Changes are saved as drafts and must be published to take effect.
        </p>
      </div>

      <GameConfigAdmin />
    </div>
  )
}
