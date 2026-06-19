import React from 'react';
import { useProfileStats } from '../../hooks/useProfileStats';
import { Target, Coins, Gamepad2, Trophy, Medal, Globe, Users, Layers, Loader2 } from 'lucide-react';

interface UserProfileStatsProps {
  userId: string | null | undefined;
}

const pct = (correct: number, total: number) => (total === 0 ? 0 : (correct / total) * 100);
const accColor = (p: number) => (p >= 60 ? 'text-lime-glow' : p >= 45 ? 'text-warm-yellow' : 'text-hot-red');

export const UserProfileStats: React.FC<UserProfileStatsProps> = ({ userId }) => {
  const { stats, isLoading, error } = useProfileStats(userId);

  if (isLoading) {
    return <div className="flex justify-center items-center p-12"><Loader2 size={40} className="animate-spin text-electric-blue" /></div>;
  }
  if (error) {
    return <div className="text-center p-8 text-hot-red"><p>Failed to load statistics</p><p className="text-sm text-text-disabled mt-2">{error.message}</p></div>;
  }
  if (!stats) {
    return <div className="text-center p-8 text-text-disabled"><p>No statistics available</p></div>;
  }

  const accuracy = pct(stats.predictionsCorrect, stats.predictionsTotal);
  const totalPodiums = stats.podiums.gold + stats.podiums.silver + stats.podiums.bronze;

  return (
    <div className="space-y-4 animate-scale-in">
      {/* ── Performance ── */}
      <Section title="Performance">
        {/* Hero: prediction accuracy */}
        <div className="card-base p-4">
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5">
              <Target size={14} className="text-electric-blue" /> Prediction Accuracy
            </p>
            {stats.predictionsTotal > 0 && (
              <span className="text-xs text-text-disabled">Last 10d <span className="font-semibold text-text-secondary">{stats.last10DaysAccuracy?.toFixed(0) ?? 0}%</span></span>
            )}
          </div>
          <div className="mt-2 flex items-end gap-3">
            <span className={`text-4xl font-extrabold ${accColor(accuracy)}`}>{accuracy.toFixed(1)}<span className="text-2xl">%</span></span>
            <span className="text-sm text-text-secondary pb-1">{stats.predictionsCorrect}/{stats.predictionsTotal} correct</span>
          </div>
          <div className="mt-2 w-full bg-deep-navy rounded-full h-2 overflow-hidden">
            <div className="bg-gradient-to-r from-hot-red via-warm-yellow to-lime-glow h-2 rounded-full transition-all duration-500" style={{ width: `${Math.min(accuracy, 100)}%` }} />
          </div>
        </div>
        {/* Games + Average bet */}
        <div className="grid grid-cols-2 gap-3">
          <MiniStat icon={<Gamepad2 size={18} className="text-neon-cyan" />} label="Games played" value={stats.gamesPlayed.toLocaleString()} />
          <MiniStat icon={<Coins size={18} className="text-warm-yellow" />} label="Average bet" value={<>{stats.averageBetCoins.toLocaleString()} <span className="text-xs font-normal text-text-secondary">coins</span></>} />
        </div>
      </Section>

      {/* ── Achievements ── */}
      <Section title="Achievements">
        <div className="grid grid-cols-2 gap-3">
          <div className="card-base p-3.5">
            <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5 mb-2"><Medal size={14} className="text-warm-yellow" /> Podiums</p>
            {totalPodiums > 0 ? (
              <div className="flex gap-3 text-base font-bold text-text-primary">
                <span>🥇 {stats.podiums.gold}</span><span>🥈 {stats.podiums.silver}</span><span>🥉 {stats.podiums.bronze}</span>
              </div>
            ) : <p className="text-sm text-text-disabled">None yet</p>}
          </div>
          <MiniStat icon={<Trophy size={18} className="text-warm-yellow" />} label="Trophies" value={stats.trophies.toLocaleString()} />
        </div>
      </Section>

      {/* ── Habits ── */}
      <Section title="Your Habits">
        <div className="card-base divide-y divide-white/5">
          <HabitRow icon={<Globe size={15} className="text-electric-blue" />} label="Most played league" value={stats.mostPlayedLeague} />
          <HabitRow icon={<Users size={15} className="text-neon-cyan" />} label="Most played team" value={stats.mostPlayedTeam} />
          <HabitRow icon={<Layers size={15} className="text-lime-glow" />} label="Favorite game type" value={stats.favoriteGameType} />
        </div>
      </Section>
    </div>
  );
};

const Section: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-1">{title}</h3>
    {children}
  </div>
);

const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="card-base p-3.5">
    <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5 mb-1">{icon} {label}</p>
    <p className="text-xl font-bold text-text-primary">{value}</p>
  </div>
);

const HabitRow: React.FC<{ icon: React.ReactNode; label: string; value?: string }> = ({ icon, label, value }) => (
  <div className="flex items-center justify-between px-3.5 py-3">
    <span className="text-xs font-semibold text-text-disabled flex items-center gap-2">{icon} {label}</span>
    <span className="text-sm font-semibold text-text-primary truncate max-w-[55%] text-right">{value && value !== '' ? value : '—'}</span>
  </div>
);
