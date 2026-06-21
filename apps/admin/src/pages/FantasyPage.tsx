import FantasyGameAdmin from '../components/FantasyGameAdmin';
import FantasyGameWeekAdmin from '../components/FantasyGameWeekAdmin';
import FantasyPlayerAdmin from '../components/FantasyPlayerAdmin';
import FantasyManualSync from '../components/FantasyManualSync';
import { PageHeader } from '../components/ui/PageHeader';

export function FantasyPage() {
  return (
    <div className="space-y-6">
      <PageHeader title="Fantasy Game Management" subtitle="Manage Fantasy games, game weeks, players, and data synchronization." />

      {/* Manual Sync & Processing */}
      <FantasyManualSync />

      {/* Fantasy Games */}
      <FantasyGameAdmin />

      {/* Game Weeks */}
      <FantasyGameWeekAdmin />

      {/* Player Pool */}
      <FantasyPlayerAdmin />
    </div>
  );
}
