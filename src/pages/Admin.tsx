import React, { useState } from 'react';
import { Profile, SportimeGame, RewardItem } from '../types';
import { Gamepad2, Star, DatabaseZap, Terminal, Newspaper } from 'lucide-react';
import { useMockStore } from '../store/useMockStore';
import { ChallengesAdmin } from '../components/admin/ChallengesAdmin';
import { ProgressionAdmin } from '../components/ProgressionAdmin';
import { DataSyncAdmin } from '../components/DataSyncAdmin';
import { TestModeToggle } from '../components/TestModeToggle';
import { Coins, Trash2, Play } from 'lucide-react';
import { CelebrateSeasonalWinnersModal } from '../components/admin/CelebrateSeasonalWinnersModal';
import { CelebrationFeed } from '../components/admin/CelebrationFeed';

type AdminSection = 'challenges' | 'progression' | 'datasync' | 'feed' | 'developer';

interface AdminPageProps {
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ profile, addToast }) => {
  const {
    games,
    createGame,
    processChallengeStart,
    levels,
    badges,
    isTestMode,
    setTestMode,
    resetTestUsers,
    setCoinBalance,
    openOnboardingTest,
    updateBasePack,
    updateGameRewards,
    celebrations,
    celebrateSeasonalWinners,
  } = useMockStore(state => ({
    games: state.games,
    createGame: state.createGame,
    processChallengeStart: state.processChallengeStart,
    levels: state.levels,
    badges: state.badges,
    isTestMode: state.isTestMode,
    setTestMode: state.setTestMode,
    resetTestUsers: state.resetTestUsers,
    setCoinBalance: state.setCoinBalance,
    openOnboardingTest: state.openOnboardingTest,
    updateBasePack: state.updateBasePack,
    updateGameRewards: state.updateGameRewards,
    celebrations: state.celebrations,
    celebrateSeasonalWinners: state.celebrateSeasonalWinners,
  }));

  const [activeSection, setActiveSection] = useState<AdminSection>('challenges');
  const [celebratingGame, setCelebratingGame] = useState<SportimeGame | null>(null);

  const handleStartChallenge = (challengeId: string) => {
    const result = processChallengeStart(challengeId);
    addToast(result.message, result.success ? 'success' : 'error');
  };

  const handleConfirmCelebration = (gameId: string, period: { start: string; end: string }, topN: number, reward: RewardItem, message: string) => {
    celebrateSeasonalWinners(gameId, period, topN, reward, message);
    addToast('Seasonal winners celebrated successfully!', 'success');
    setCelebratingGame(null);
  };

  const AdminSectionButton: React.FC<{ section: AdminSection, icon: React.ReactNode, label: string }> = ({ section, icon, label }) => (
    <button
      onClick={() => setActiveSection(section)}
      className={`flex-1 flex items-center justify-center gap-2 p-2 rounded-lg font-semibold transition-all text-xs ${activeSection === section ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'}`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-3 sm:grid-cols-5 bg-navy-accent rounded-xl p-1 gap-1">
        <AdminSectionButton section="challenges" icon={<Gamepad2 size={16} />} label="Games" />
        <AdminSectionButton section="feed" icon={<Newspaper size={16} />} label="Feed" />
        <AdminSectionButton section="progression" icon={<Star size={16} />} label="Progression" />
        <AdminSectionButton section="datasync" icon={<DatabaseZap size={16} />} label="Data Sync" />
        <AdminSectionButton section="developer" icon={<Terminal size={16} />} label="Dev" />
      </div>

      {activeSection === 'challenges' && (
        <div className="animate-scale-in">
          <ChallengesAdmin 
            games={games} 
            onCreateGame={createGame} 
            onProcessChallengeStart={handleStartChallenge}
            addToast={addToast}
            updateBasePack={updateBasePack}
            updateGameRewards={updateGameRewards}
            onCelebrate={setCelebratingGame}
          />
        </div>
      )}
      
      {activeSection === 'feed' && (
        <div className="animate-scale-in">
          <CelebrationFeed celebrations={celebrations} />
        </div>
      )}

      {activeSection === 'progression' && (
        <div className="animate-scale-in">
          <ProgressionAdmin 
            levels={levels}
            badges={badges}
            onAddLevel={() => addToast('This feature is not implemented in mock mode.', 'info')}
            onUpdateLevel={() => addToast('This feature is not implemented in mock mode.', 'info')}
            onDeleteLevel={() => addToast('This feature is not implemented in mock mode.', 'info')}
            onAddBadge={() => addToast('This feature is not implemented in mock mode.', 'info')}
            onUpdateBadge={() => addToast('This feature is not implemented in mock mode.', 'info')}
            onDeleteBadge={() => addToast('This feature is not implemented in mock mode.', 'info')}
          />
        </div>
      )}

      {activeSection === 'datasync' && (
        <div className="animate-scale-in">
          <DataSyncAdmin addToast={addToast} />
        </div>
      )}

      {activeSection === 'developer' && (
        <div className="animate-scale-in space-y-6">
          <div className="card-base p-5 space-y-4">
            <h3 className="font-bold text-lg text-text-primary">Developer Options</h3>
            <TestModeToggle
              label="Enable Test Mode"
              description="Bypasses email verification for faster testing of the sign-up flow."
              isTestMode={isTestMode}
              onToggle={setTestMode}
            />
            <button
              onClick={openOnboardingTest}
              className="w-full flex items-center justify-center gap-2 py-3 bg-electric-blue/20 text-electric-blue rounded-xl font-semibold hover:bg-electric-blue/30 transition-colors"
            >
              <Play size={16} /> Test Onboarding Flow
            </button>
            <button
              onClick={() => {
                if (profile) {
                  setCoinBalance(profile.id, (profile.coins_balance || 0) + 50000);
                  addToast('Added 50,000 coins!', 'success');
                } else {
                  addToast('No active profile to add coins to.', 'error');
                }
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-lime-glow/20 text-lime-glow rounded-xl font-semibold hover:bg-lime-glow/30 transition-colors"
            >
              <Coins size={16} /> Add 50,000 Coins
            </button>
            <button
              onClick={() => {
                resetTestUsers();
                addToast('Test users have been reset to their default state.', 'success');
              }}
              className="w-full flex items-center justify-center gap-2 py-3 bg-hot-red/20 text-hot-red rounded-xl font-semibold hover:bg-hot-red/30 transition-colors"
            >
              <Trash2 size={16} /> Reset All Test Users
            </button>
          </div>
        </div>
      )}

      {celebratingGame && (
        <CelebrateSeasonalWinnersModal
          isOpen={!!celebratingGame}
          onClose={() => setCelebratingGame(null)}
          game={celebratingGame}
          onConfirm={handleConfirmCelebration}
        />
      )}
    </div>
  );
};

export default AdminPage;
