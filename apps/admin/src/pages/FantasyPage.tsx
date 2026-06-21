import { useState } from 'react';
import FantasyGameAdmin from '../components/FantasyGameAdmin';
import FantasyGameWeekAdmin from '../components/FantasyGameWeekAdmin';
import FantasyPlayerAdmin from '../components/FantasyPlayerAdmin';
import FantasyManualSync from '../components/FantasyManualSync';
import { PageHeader } from '../components/ui/PageHeader';

type Tab = 'games' | 'gameweeks' | 'players' | 'sync';
const TABS: { key: Tab; label: string }[] = [
  { key: 'games', label: 'Games' },
  { key: 'gameweeks', label: 'Game Weeks' },
  { key: 'players', label: 'Player Pool' },
  { key: 'sync', label: 'Sync & Processing' },
];

export function FantasyPage() {
  const [tab, setTab] = useState<Tab>('games');
  return (
    <div className="space-y-5">
      <PageHeader title="Fantasy" subtitle="Fantasy games, game weeks, the player pool and data sync." />

      <div className="flex gap-2 border-b border-border-subtle overflow-x-auto">
        {TABS.map(t => (
          <button key={t.key} onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-semibold whitespace-nowrap ${tab === t.key ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary hover:text-text-primary'}`}>
            {t.label}
          </button>
        ))}
      </div>

      {tab === 'games' && <FantasyGameAdmin />}
      {tab === 'gameweeks' && <FantasyGameWeekAdmin />}
      {tab === 'players' && <FantasyPlayerAdmin />}
      {tab === 'sync' && <FantasyManualSync />}
    </div>
  );
}
