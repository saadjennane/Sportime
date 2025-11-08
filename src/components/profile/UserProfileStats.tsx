import React from 'react';
import { mockStats } from '../../data/mockProfileStats';
import { StatCard } from './StatCard';
import {
  Target,
  Flame,
  Zap,
  Coins,
  TrendingUp,
  Gamepad2,
  Trophy,
  Award,
  Shield,
  Globe,
  Users,
  Layers,
} from 'lucide-react';

const computeAccuracy = (correct: number, total: number) => ({
  ratio: (correct / total) * 100,
  label: `${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`
});

const getHPIColor = (hpi: number) => {
  if (hpi < 0.8) return '#60A5FA'; // cold-blue
  if (hpi < 1.5) return '#FBBF24'; // steady-yellow
  if (hpi < 2.5) return '#FB923C'; // hot-orange
  return '#A78BFA'; // elite-purple
};

export const UserProfileStats: React.FC = () => {
  const accuracy = computeAccuracy(mockStats.predictionsCorrect, mockStats.predictionsTotal);

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      <StatCard
        icon={<Target size={16} />}
        title="Prediction Accuracy"
        value={accuracy.label}
        accentColor="#38BDF8" // cyan-400
      />
      <StatCard
        icon={<Flame size={16} />}
        title="Hot Performance Index"
        value={mockStats.hotPerformanceIndex.toFixed(2)}
        footer={<>Best: {mockStats.bestHotDay.hpi} on {mockStats.bestHotDay.date}</>}
        accentColor={getHPIColor(mockStats.hotPerformanceIndex)}
      />
      <StatCard
        icon={<Zap size={16} />}
        title="Hot Streak"
        value={`${mockStats.streak} Days`}
        footer="Consecutive days with HPI ≥ 1.0"
        accentColor="#FBBF24" // amber-400
      />
      <StatCard
        icon={<TrendingUp size={16} />}
        title="Risk Index"
        value={`${mockStats.riskIndex}/10`}
        footer="Based on odds variance"
        accentColor="#F87171" // red-400
      />
      <StatCard
        icon={<Coins size={16} />}
        title="Average Bet"
        value={<>{mockStats.averageBetCoins} <span className="text-base">coins</span></>}
        accentColor="#FACC15" // yellow-400
      />
      <StatCard
        icon={<Gamepad2 size={16} />}
        title="Games Played"
        value={mockStats.gamesPlayed}
        accentColor="#A78BFA" // violet-400
      />
      <StatCard
        icon={<Trophy size={16} />}
        title="Podiums"
        value={
          <div className="flex gap-4 items-center">
            <span>🥇 {mockStats.podiums.gold}</span>
            <span>🥈 {mockStats.podiums.silver}</span>
            <span>🥉 {mockStats.podiums.bronze}</span>
          </div>
        }
        accentColor="#FBBF24" // amber-400
      />
      <StatCard
        icon={<Award size={16} />}
        title="Trophies"
        value={mockStats.trophies}
        accentColor="#C0C0C0" // silver
      />
      <StatCard
        icon={<Shield size={16} />}
        title="Badges"
        value={mockStats.badges.length}
        footer={mockStats.badges.join(' · ')}
        accentColor="#4ADE80" // green-400
      />
      <StatCard
        icon={<Globe size={16} />}
        title="Most Played League"
        value={mockStats.mostPlayedLeague}
        accentColor="#60A5FA" // blue-400
      />
      <StatCard
        icon={<Users size={16} />}
        title="Most Played Team"
        value={mockStats.mostPlayedTeam}
        accentColor="#38BDF8" // cyan-400
      />
      <StatCard
        icon={<Layers size={16} />}
        title="Favorite Game Type"
        value={mockStats.favoriteGameType}
        accentColor="#A78BFA" // violet-400
      />
    </div>
  );
};
