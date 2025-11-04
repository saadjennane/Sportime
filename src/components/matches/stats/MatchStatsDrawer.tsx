import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, History, Users } from 'lucide-react';
import { Match } from '../../../types';
import { FormTab } from './FormTab';
import { H2HTab } from './H2HTab';
import { LineupsTab } from './LineupsTab';
import { useMatchExtras } from '../../../features/matches/useMatchExtras';

interface MatchStatsDrawerProps {
  match: Match | null;
  onClose: () => void;
}

type ActiveTab = 'form' | 'h2h' | 'lineups';

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
    };
  }, [match]);

  const { teams, h2h, lineup, loading, error } = useMatchExtras(extrasParams);

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
        return <LineupsTab data={lineup ?? undefined} loading={loading} />;
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
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-disabled flex-shrink-0">
              <div className="flex items-center gap-3">
                <span className="text-2xl">{match.teamA.emoji}</span>
                <span className="text-sm font-bold text-text-primary">{match.teamA.name} vs {match.teamB.name}</span>
                <span className="text-2xl">{match.teamB.emoji}</span>
              </div>
              <button onClick={onClose} className="p-2 text-text-secondary hover:bg-white/10 rounded-full">
                <X size={20} />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-2 p-2 border-b border-disabled flex-shrink-0">
              <TabButton label="Form" icon={<FileText size={18} />} isActive={activeTab === 'form'} onClick={() => setActiveTab('form')} />
              <TabButton label="H2H" icon={<History size={18} />} isActive={activeTab === 'h2h'} onClick={() => setActiveTab('h2h')} />
              {extrasParams && (
                <TabButton label="Lineups" icon={<Users size={18} />} isActive={activeTab === 'lineups'} onClick={() => setActiveTab('lineups')} />
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
