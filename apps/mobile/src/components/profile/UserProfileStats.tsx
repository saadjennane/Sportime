import React from 'react';
import { useProfileStats, type F1Stats, type FootballStats } from '../../hooks/useProfileStats';
import { Target, Coins, Gamepad2, Medal, Globe, Flag, Swords, Crosshair, Zap, Crown, Shield, Loader2 } from 'lucide-react';

const acc = (correct: number, total: number) => (total === 0 ? null : (correct / total) * 100);
const accColor = (p: number) => (p >= 60 ? 'text-lime-glow' : p >= 45 ? 'text-warm-yellow' : 'text-hot-red');

export const UserProfileStats: React.FC<{ userId: string | null | undefined }> = ({ userId }) => {
  const { stats, isLoading, error } = useProfileStats(userId);

  if (isLoading) return <div className="flex justify-center items-center p-12"><Loader2 size={40} className="animate-spin text-electric-blue" /></div>;
  if (error) return <div className="text-center p-8 text-hot-red"><p>Failed to load statistics</p><p className="text-sm text-text-disabled mt-2">{error.message}</p></div>;
  if (!stats) return <div className="text-center p-8 text-text-disabled"><p>No statistics available</p></div>;

  return (
    <div className="space-y-5 animate-scale-in">
      <F1Section s={stats.f1} />
      <FootballSection s={stats.football} />

      {/* Badges (cross-sport) */}
      <Section title="Badges" icon={<Shield size={13} className="text-neon-cyan" />}>
        <div className="card-base p-4">
          {stats.badges.count > 0 ? (
            <div className="flex flex-wrap gap-1.5">
              {stats.badges.names.slice(0, 12).map((n, i) => (
                <span key={i} className="text-[11px] font-semibold px-2 py-1 rounded-full bg-navy-accent text-text-secondary">{n}</span>
              ))}
            </div>
          ) : <p className="text-sm text-text-disabled">No badges yet</p>}
        </div>
      </Section>
    </div>
  );
};

const F1Section: React.FC<{ s: F1Stats }> = ({ s }) => {
  const active = s.bets_placed > 0 || s.games_played > 0;
  const a = acc(s.bets_won, s.bets_total);
  return (
    <Section title="Formula 1" icon={<Flag size={13} className="text-hot-red" />}>
      {!active ? <Empty label="No F1 activity yet — place a bet or join a game." />
        : (
          <>
            <div className="card-base p-4">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5"><Target size={14} className="text-electric-blue" /> Bet accuracy</p>
                {s.bets_total > 0 && <span className="text-xs text-text-disabled">Last 10d <span className="font-semibold text-text-secondary">{s.last10_accuracy}%</span></span>}
              </div>
              <div className="mt-2 flex items-end gap-3">
                {a == null ? <span className="text-2xl font-bold text-text-disabled">—</span>
                  : <span className={`text-4xl font-extrabold ${accColor(a)}`}>{a.toFixed(0)}<span className="text-2xl">%</span></span>}
                <span className="text-sm text-text-secondary pb-1">{s.bets_won}/{s.bets_total} won{s.bets_placed > s.bets_total ? ` · ${s.bets_placed - s.bets_total} pending` : ''}</span>
              </div>
              {a != null && <div className="mt-2 w-full bg-deep-navy rounded-full h-2 overflow-hidden"><div className="bg-gradient-to-r from-hot-red via-warm-yellow to-lime-glow h-2 rounded-full" style={{ width: `${Math.min(a, 100)}%` }} /></div>}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={<Gamepad2 size={18} className="text-neon-cyan" />} label="Games played" value={s.games_played.toLocaleString()} />
              <MiniStat icon={<Coins size={18} className="text-warm-yellow" />} label="Average stake" value={<>{s.average_bet.toLocaleString()} <span className="text-xs font-normal text-text-secondary">coins</span></>} />
            </div>
            <div className="grid grid-cols-4 gap-2">
              <Pill icon={<Swords size={15} className="text-hot-red" />} label="Duels" n={s.duels} />
              <Pill icon={<Crosshair size={15} className="text-neon-cyan" />} label="Predict" n={s.predictor} />
              <Pill icon={<Zap size={15} className="text-warm-yellow" />} label="Fantasy" n={s.fantasy} />
              <Pill icon={<Crown size={15} className="text-warm-yellow" />} label="HoF" n={s.hof} />
            </div>
            {s.favorite_game_type && (
              <div className="card-base px-4 py-3 flex items-center justify-between">
                <span className="text-xs font-semibold text-text-disabled flex items-center gap-2"><Gamepad2 size={15} className="text-lime-glow" /> Favourite game</span>
                <span className="text-sm font-semibold text-text-primary">{s.favorite_game_type}</span>
              </div>
            )}
          </>
        )}
    </Section>
  );
};

const FootballSection: React.FC<{ s: FootballStats }> = ({ s }) => {
  const active = s.predictions_total > 0 || s.games_played > 0;
  const a = acc(s.predictions_correct, s.predictions_total);
  const podiums = s.gold + s.silver + s.bronze;
  return (
    <Section title="Football" icon={<Globe size={13} className="text-electric-blue" />}>
      {!active ? <Empty label="No football activity yet — join a Pick'em or make predictions." />
        : (
          <>
            <div className="card-base p-4">
              <p className="text-xs font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5"><Target size={14} className="text-electric-blue" /> Prediction accuracy</p>
              <div className="mt-2 flex items-end gap-3">
                {a == null ? <span className="text-2xl font-bold text-text-disabled">—</span>
                  : <span className={`text-4xl font-extrabold ${accColor(a)}`}>{a.toFixed(0)}<span className="text-2xl">%</span></span>}
                <span className="text-sm text-text-secondary pb-1">{s.predictions_correct}/{s.predictions_total} correct</span>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <MiniStat icon={<Gamepad2 size={18} className="text-neon-cyan" />} label="Games played" value={s.games_played.toLocaleString()} />
              <MiniStat icon={<Coins size={18} className="text-warm-yellow" />} label="Average bet" value={<>{s.average_bet.toLocaleString()} <span className="text-xs font-normal text-text-secondary">coins</span></>} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="card-base p-3.5">
                <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5 mb-2"><Medal size={14} className="text-warm-yellow" /> Podiums</p>
                {podiums > 0 ? <div className="flex gap-3 text-base font-bold text-text-primary"><span>🥇 {s.gold}</span><span>🥈 {s.silver}</span><span>🥉 {s.bronze}</span></div>
                  : <p className="text-sm text-text-disabled">None yet</p>}
              </div>
              <MiniStat icon={<Globe size={18} className="text-electric-blue" />} label="Top league" value={<span className="text-base">{s.most_played_league ?? '—'}</span>} />
            </div>
          </>
        )}
    </Section>
  );
};

const Section: React.FC<{ title: string; icon?: React.ReactNode; children: React.ReactNode }> = ({ title, icon, children }) => (
  <div className="space-y-3">
    <h3 className="text-xs font-bold text-text-secondary uppercase tracking-wider px-1 flex items-center gap-1.5">{icon} {title}</h3>
    {children}
  </div>
);
const MiniStat: React.FC<{ icon: React.ReactNode; label: string; value: React.ReactNode }> = ({ icon, label, value }) => (
  <div className="card-base p-3.5">
    <p className="text-[11px] font-semibold text-text-disabled uppercase tracking-wide flex items-center gap-1.5 mb-1">{icon} {label}</p>
    <p className="text-xl font-bold text-text-primary truncate">{value}</p>
  </div>
);
const Pill: React.FC<{ icon: React.ReactNode; label: string; n: number }> = ({ icon, label, n }) => (
  <div className={`card-base p-2.5 text-center ${n > 0 ? '' : 'opacity-50'}`}>
    <div className="flex justify-center mb-1">{icon}</div>
    <p className="text-base font-bold text-text-primary tabular-nums">{n}</p>
    <p className="text-[10px] text-text-disabled">{label}</p>
  </div>
);
const Empty: React.FC<{ label: string }> = ({ label }) => (
  <div className="card-base p-5 text-center text-sm text-text-disabled">{label}</div>
);
