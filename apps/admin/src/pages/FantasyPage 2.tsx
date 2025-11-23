import React from 'react';
import FantasyGameAdmin from '../components/FantasyGameAdmin';
import FantasyGameWeekAdmin from '../components/FantasyGameWeekAdmin';
import FantasyPlayerAdmin from '../components/FantasyPlayerAdmin';
import FantasyManualSync from '../components/FantasyManualSync';

export function FantasyPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Fantasy Game Management</h1>
        <p className="text-gray-600">
          Manage Fantasy games, game weeks, players, and data synchronization for La Liga and other leagues.
        </p>
      </div>

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
