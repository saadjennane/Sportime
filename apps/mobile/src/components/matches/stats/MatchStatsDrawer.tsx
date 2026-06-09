import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, History, Users, BarChart3, Clock } from 'lucide-react';
import { Match } from '../../../types';
import { FormTab } from './FormTab';
import { H2HTab } from './H2HTab';
import { LineupsTab } from './LineupsTab';
import { StatsTab } from './StatsTab';
import { EventsTab } from './EventsTab';
import { useMatchExtras } from '../../../features/matches/useMatchExtras';

interface MatchStatsDrawerProps {
  match: Match | null;
  onClose: () => void;
}

type ActiveTab = 'form' | 'h2h' | 'lineups' | 'events' | 'stats';

const drawerVariants = {
  hidden: { y: '100%', x: 0 },
  visible: { y: 0, x: 0 },
  desktopHidden: { y: 0, x: '100%' },
  desktopVisible: { y: 0, x: 0 },
};

const TabButton: React.FC<{
  label: string;
  icon: React.ReactNode;
  isActive: boolean;
  onClick: () => void;
}> = ({ label, icon, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex flex-col items-center gap-1 p-2 rounded-lg transition-colors ${
      isActive ? 'bg-electric-blue/10 text-electric-blue' : 'text-text-secondary hover:bg-white/5'
    }`}
  >
    {icon}
    <span className="text-xs font-semibold">{label}</span>
  </button>
);

export const MatchStatsDrawer: React.FC<MatchStatsDrawerProps> = ({ match, onClose }) => {
  const [activeTab, setActiveTab] = useState<ActiveTab>('form');

  const extrasParams = useMemo(() => {
    if (!match?.meta) return null;
    const { fixtureId, homeTeamId, awayTeamId, apiLeagueId, season } = match.meta;
    if (!Number.isFinite(fixtureId) || !Number.isFinite(homeTeamId) || !Number.isFinite(awayTeamId)) {
      return null;
    }
    return {
      fixtureId,
      homeTeamId,
      awayTeamId,
      leagueApiId: apiLeagueId ?? undefined,
      season: season ?? undefined,
      homeTeamLogo: match.teamA.logo ?? undefined,
      awayTeamLogo: match.teamB.logo ?? undefined,
    };
  }, [match]);

  const { teams, h2h, lineups, loading, error } = useMatchExtras(extrasParams);

  useEffect(() => {
    if (match) {
      setActiveTab('form'); // Reset to form tab on new match
    }
  }, [match]);

  const renderContent = () => {
    if (error && !loading) {
      return <div className="text-center text-hot-red p-6 text-sm">{error}</div>;
    }

    switch (activeTab) {
      case 'form':
        return <FormTab data={teams} loading={loading} />;
      case 'h2h':
        return <H2HTab data={h2h} loading={loading} />;
      case 'lineups':
        return <LineupsTab data={lineups} loading={loading} />;
      case 'events':
        return <EventsTab fixtureId={extrasParams?.fixtureId} homeTeamId={extrasParams?.homeTeamId} />;
      case 'stats':
        return <StatsTab fixtureId={extrasParams?.fixtureId} homeTeamId={extrasParams?.homeTeamId} />;
      default:
        return null;
    }
  };

  return (
    <AnimatePresence>
      {match && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/50 z-40 md:hidden"
          />

          {/* Drawer */}
          <motion.div
            key={match.id}
            variants={drawerVariants}
            initial="hidden"
            animate="visible"
            exit="hidden"
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            className="fixed bottom-0 left-0 right-0 h-[85vh] bg-deep-navy rounded-t-2xl shadow-2xl flex flex-col z-50 
                       md:bottom-auto md:top-0 md:left-auto md:w-96 md:h-screen md:rounded-none md:border-l md:border-disabled"
          >
            {/* Close — above the sheet */}
            <div className="flex justify-center pt-2.5 pb-1 flex-shrink-0">
              <button onClick={onClose} className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-text-secondary hover:bg-white/20 transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Header — TeamA · logo · score(+status) · logo · TeamB, centered */}
            {(() => {
              const live = !!match.isLive;
              const raw = match.rawStatus;
              const badge = live
                ? (raw && /^(1H|2H|HT|ET|BT|P|LIVE)$/i.test(raw) ? raw : `${match.elapsedMinutes ?? ''}'`)
                : (match.status === 'played' ? (raw || 'FT') : null);
              const Logo = ({ url, emoji, name }: { url?: string; emoji?: string; name: string }) =>
                url ? (
                  <div className="w-11 h-11 rounded-full bg-white/10 flex items-center justify-center flex-shrink-0">
                    <img src={url} alt={name} className="w-8 h-8 object-contain" />
                  </div>
                ) : <span className="text-3xl flex-shrink-0">{emoji || '⚽'}</span>;
              return (
                <div className="flex items-center justify-center gap-3 px-4 pb-4 border-b border-disabled flex-shrink-0">
                  <span className="flex-1 text-right text-sm font-bold text-text-primary truncate">{match.teamA.name}</span>
                  <Logo url={match.teamA.logo} emoji={match.teamA.emoji} name={match.teamA.name} />
                  <div className="flex flex-col items-center justify-center min-w-[64px]">
                    <span className="text-2xl font-extrabold text-text-primary tabular-nums leading-none">
                      {match.score ? `${match.score.teamA} - ${match.score.teamB}` : 'vs'}
                    </span>
                    {badge && (
                      <span className={`mt-1.5 text-[10px] font-bold px-2 py-0.5 rounded-full ${live ? 'bg-hot-red text-white animate-pulse' : 'bg-white/10 text-text-secondary'}`}>
                        {badge}
                      </span>
                    )}
                  </div>
                  <Logo url={match.teamB.logo} emoji={match.teamB.emoji} name={match.teamB.name} />
                  <span className="flex-1 text-left text-sm font-bold text-text-primary truncate">{match.teamB.name}</span>
                </div>
              );
            })()}

            {/* Tabs */}
            <div className="flex gap-2 p-2 border-b border-disabled flex-shrink-0 overflow-x-auto scrollbar-hide">
              <TabButton label="Form" icon={<FileText size={18} />} isActive={activeTab === 'form'} onClick={() => setActiveTab('form')} />
              <TabButton label="H2H" icon={<History size={18} />} isActive={activeTab === 'h2h'} onClick={() => setActiveTab('h2h')} />
              {extrasParams && (
                <TabButton label="Lineups" icon={<Users size={18} />} isActive={activeTab === 'lineups'} onClick={() => setActiveTab('lineups')} />
              )}
              {extrasParams && (
                <TabButton label="Events" icon={<Clock size={18} />} isActive={activeTab === 'events'} onClick={() => setActiveTab('events')} />
              )}
              {extrasParams && (
                <TabButton label="Stats" icon={<BarChart3 size={18} />} isActive={activeTab === 'stats'} onClick={() => setActiveTab('stats')} />
              )}
            </div>

            {/* Content */}
            <div className="flex-1 overflow-y-auto p-4">
              <AnimatePresence mode="wait">
                <motion.div
                  key={activeTab}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  transition={{ duration: 0.2 }}
                >
                  {renderContent()}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
};
