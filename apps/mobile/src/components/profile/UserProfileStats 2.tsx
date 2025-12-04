import React from 'react';
import { useProfileStats } from '../../hooks/useProfileStats';
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
  Loader2,
} from 'lucide-react';

const computeAccuracy = (correct: number, total: number) => {
  if (total === 0) return { ratio: 0, label: '0/0 (0.0%)' };
  return {
    ratio: (correct / total) * 100,
    label: `${correct}/${total} (${((correct / total) * 100).toFixed(1)}%)`
  };
};

const getHPIColor = (hpi: number) => {
  if (hpi < 0.8) return '#60A5FA'; // cold-blue
  if (hpi < 1.5) return '#FBBF24'; // steady-yellow
  if (hpi < 2.5) return '#FB923C'; // hot-orange
  return '#A78BFA'; // elite-purple
};

interface UserProfileStatsProps {
  userId: string | null | undefined;
}

export const UserProfileStats: React.FC<UserProfileStatsProps> = ({ userId }) => {
  const { stats, isLoading, error } = useProfileStats(userId);

  if (isLoading) {
    return (
      <div className="flex justify-center items-center p-12">
        <Loader2 size={48} className="animate-spin text-electric-blue" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center p-8 text-red-400">
        <p>Failed to load profile statistics</p>
        <p className="text-sm text-text-disabled mt-2">{error.message}</p>
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="text-center p-8 text-text-disabled">
        <p>No statistics available</p>
      </div>
    );
  }

  const accuracy = computeAccuracy(stats.predictionsCorrect, stats.predictionsTotal);

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
        value={stats.hotPerformanceIndex.toFixed(2)}
        footer={stats.bestHotDay.hpi > 0 ? <>Best: {stats.bestHotDay.hpi.toFixed(2)} on {stats.bestHotDay.date}</> : 'No data yet'}
        accentColor={getHPIColor(stats.hotPerformanceIndex)}
      />
      <StatCard
        icon={<Zap size={16} />}
        title="Hot Streak"
        value={`${stats.streak} Days`}
        footer="Consecutive days with HPI ≥ 1.0"
        accentColor="#FBBF24" // amber-400
      />
      <StatCard
        icon={<TrendingUp size={16} />}
        title="Risk Index"
        value={`${stats.riskIndex.toFixed(1)}/10`}
        footer="Based on odds variance"
        accentColor="#F87171" // red-400
      />
      <StatCard
        icon={<Coins size={16} />}
        title="Average Bet"
        value={<>{stats.averageBetCoins} <span className="text-base">coins</span></>}
        accentColor="#FACC15" // yellow-400
      />
      <StatCard
        icon={<Gamepad2 size={16} />}
        title="Games Played"
        value={stats.gamesPlayed}
        accentColor="#A78BFA" // violet-400
      />
      <StatCard
        icon={<Trophy size={16} />}
        title="Podiums"
        value={
          <div className="flex gap-4 items-center">
            <span>🥇 {stats.podiums.gold}</span>
            <span>🥈 {stats.podiums.silver}</span>
            <span>🥉 {stats.podiums.bronze}</span>
          </div>
        }
        accentColor="#FBBF24" // amber-400
      />
      <StatCard
        icon={<Award size={16} />}
        title="Trophies"
        value={stats.trophies}
        accentColor="#C0C0C0" // silver
      />
      <StatCard
        icon={<Shield size={16} />}
        title="Badges"
        value={stats.badges.length}
        footer={stats.badges.length > 0 ? stats.badges.join(' · ') : 'No badges yet'}
        accentColor="#4ADE80" // green-400
      />
      <StatCard
        icon={<Globe size={16} />}
        title="Most Played League"
        value={stats.mostPlayedLeague}
        accentColor="#60A5FA" // blue-400
      />
      <StatCard
        icon={<Users size={16} />}
        title="Most Played Team"
        value={stats.mostPlayedTeam}
        accentColor="#38BDF8" // cyan-400
      />
      <StatCard
        icon={<Layers size={16} />}
        title="Favorite Game Type"
        value={stats.favoriteGameType}
        accentColor="#A78BFA" // violet-400
      />
    </div>
  );
};
