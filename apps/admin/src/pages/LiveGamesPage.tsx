import { useState } from 'react';
import { LiveGameConfigPage } from './LiveGameConfigPage';
import { MatchRoyalePage } from './MatchRoyalePage';
import { LiveFantasyPage } from './LiveFantasyPage';
import { LivePredictionScoring } from '../components/LivePredictionScoring';

export function LiveGamesPage() {
  const [tab, setTab] = useState<'prediction' | 'royale' | 'fantasy'>('prediction');
  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-3xl font-bold text-text-primary mb-1">Live Games</h1>
        <p className="text-text-secondary">Administer the live games played on a match.</p>
      </div>
      <div className="flex gap-2 border-b border-border-subtle">
        {([['prediction', 'Live Prediction'], ['royale', 'Match Royale'], ['fantasy', 'Live Fantasy']] as const).map(([t, label]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 text-sm font-semibold ${tab === t ? 'text-electric-blue border-b-2 border-electric-blue' : 'text-text-secondary'}`}>
            {label}
          </button>
        ))}
      </div>
      <div>{tab === 'prediction' ? (
        <div className="space-y-6">
          <LivePredictionScoring />
          <LiveGameConfigPage />
        </div>
      ) : tab === 'royale' ? <MatchRoyalePage /> : <LiveFantasyPage />}</div>
    </div>
  );
}
