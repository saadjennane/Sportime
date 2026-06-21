/**
 * Game Configuration Page
 * Sections: Rewards, Progression, Tournament, PGS Formula, Badges.
 * ?tab=<section> deep-links a section (used by the sidebar "Rewards" entry).
 */
import { useSearchParams } from 'react-router-dom'
import { GameConfigAdmin } from '../components/admin/GameConfigAdmin'
import { PageHeader } from '../components/ui/PageHeader'

export function ConfigPage() {
  const [params] = useSearchParams()
  const tab = params.get('tab') as any
  return (
    <div className="max-w-7xl mx-auto">
      <PageHeader title="Game Configuration" subtitle="Settings, formulas and rewards. Changes are saved as drafts and must be published to take effect." />
      <GameConfigAdmin initialSection={tab || undefined} />
    </div>
  )
}
