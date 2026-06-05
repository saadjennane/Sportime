import React, { useState } from 'react';
import { Profile, SportimeGame, RewardItem } from '../types';
import { Gamepad2, Star, DatabaseZap, Terminal, Newspaper } from 'lucide-react';
import { useMockStore } from '../store/useMockStore';
import { ChallengesAdmin } from '../components/admin/ChallengesAdmin';
import { ProgressionAdmin } from '../components/ProgressionAdmin';
import { DataSyncAdmin } from '../components/DataSyncAdmin';
import { TestModeToggle } from '../components/TestModeToggle';
import { Coins, Trash2, Play, Settings } from 'lucide-react';
import { CelebrateSeasonalWinnersModal } from '../components/admin/CelebrateSeasonalWinnersModal';
import { CelebrationFeed } from '../components/admin/CelebrationFeed';
import { SwipeGameAdmin } from '../components/admin/SwipeGameAdmin';
import { BadgeManager } from '../components/admin/BadgeManager';
import { GameConfigAdmin } from '../components/admin/GameConfigAdmin';
import { Zap } from 'lucide-react';
import { USE_SUPABASE } from '../config/env';
import * as challengeService from '../services/challengeService';
import { useIsSuperAdmin } from '../hooks/useUserRole';

type AdminSection = 'challenges' | 'swipe' | 'progression' | 'datasync' | 'feed' | 'developer' | 'config';

interface AdminPageProps {
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

const AdminPage: React.FC<AdminPageProps> = ({ profile, addToast }) => {
  const isSuperAdmin = useIsSuperAdmin();

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

  // ==================== CHALLENGE ADMIN HANDLERS ====================

  const handleCreateGame = async (config: Omit<SportimeGame, 'id' | 'status' | 'totalPlayers' | 'participants'>) => {
    if (USE_SUPABASE) {
      try {
        // Map SportimeGame to CreateChallengeParams
        const params: challengeService.CreateChallengeParams = {
          name: config.name,
          description: config.description || null,
          game_type: config.game_type || 'betting',
          format: config.format || 'leaderboard',
          sport: 'football', // Default to football
          start_date: config.start_date,
          end_date: config.end_date,
          entry_cost: config.entry_cost || 0,
          prizes: config.rewards || [],
          rules: {
            tier: config.tier,
            duration_type: config.duration_type,
            custom_entry_cost_enabled: config.custom_entry_cost_enabled,
            is_linkable: config.is_linkable,
            reward_tier: config.reward_tier,
            minimum_players: config.minimum_players,
            maximum_players: config.maximum_players,
            challengeBalance: config.challengeBalance,
          },
          status: 'upcoming',
          entry_conditions: {
            requires_subscription: config.requires_subscription,
            minimum_level: config.minimum_level,
            required_badges: config.required_badges,
            conditions_logic: config.conditions_logic,
          },
          configs: [
            { config_type: 'tier', config_data: { tier: config.tier } },
            { config_type: 'duration_type', config_data: { duration_type: config.duration_type } },
          ],
          league_ids: config.league_id ? [config.league_id] : [],
          match_ids: [], // Matches can be added later
        };

        const result = await challengeService.createChallenge(params);
        addToast('Game created successfully!', 'success');
        // Note: Games list automatically refreshes via ChallengesAdmin component
      } catch (error) {
        console.error('[AdminPage] Failed to create game:', error);
        addToast('Failed to create game. Please try again.', 'error');
      }
    } else {
      // Fallback to MockStore
      createGame(config);
      addToast('Game created successfully!', 'success');
    }
  };

  const handleStartChallenge = async (challengeId: string) => {
    if (USE_SUPABASE) {
      try {
        // In Supabase mode, challenges start automatically based on start_date
        // This function just updates the status manually if needed
        await challengeService.updateChallenge({
          challenge_id: challengeId,
          status: 'active',
        });
        addToast('Challenge started successfully!', 'success');
        // Note: Games list automatically refreshes via ChallengesAdmin component
      } catch (error) {
        console.error('[AdminPage] Failed to start challenge:', error);
        addToast('Failed to start challenge. Please try again.', 'error');
      }
    } else {
      // Fallback to MockStore
      const result = processChallengeStart(challengeId);
      addToast(result.message, result.success ? 'success' : 'error');
    }
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
      <div className={`grid ${isSuperAdmin ? 'grid-cols-4 sm:grid-cols-7' : 'grid-cols-3 sm:grid-cols-6'} bg-navy-accent rounded-xl p-1 gap-1`}>
        <AdminSectionButton section="challenges" icon={<Gamepad2 size={16} />} label="Games" />
        <AdminSectionButton section="swipe" icon={<Zap size={16} />} label="Swipe" />
        <AdminSectionButton section="feed" icon={<Newspaper size={16} />} label="Feed" />
        <AdminSectionButton section="progression" icon={<Star size={16} />} label="Progression" />
        <AdminSectionButton section="datasync" icon={<DatabaseZap size={16} />} label="Data Sync" />
        {isSuperAdmin && <AdminSectionButton section="config" icon={<Settings size={16} />} label="Config" />}
        <AdminSectionButton section="developer" icon={<Terminal size={16} />} label="Dev" />
      </div>

      {activeSection === 'challenges' && (
        <div className="animate-scale-in">
          <ChallengesAdmin
            games={games}
            onCreateGame={handleCreateGame}
            onProcessChallengeStart={handleStartChallenge}
            addToast={addToast}
            updateBasePack={updateBasePack}
            updateGameRewards={updateGameRewards}
            onCelebrate={setCelebratingGame}
          />
        </div>
      )}
      
      {activeSection === 'swipe' && (
        <div className="animate-scale-in">
          <SwipeGameAdmin addToast={addToast} />
        </div>
      )}

      {activeSection === 'feed' && (
        <div className="animate-scale-in">
          <CelebrationFeed celebrations={celebrations} />
        </div>
      )}

      {activeSection === 'progression' && (
        <div className="animate-scale-in space-y-6">
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

          {/* ✅ New Dynamic Badge Manager */}
          <BadgeManager addToast={addToast} />
        </div>
      )}

      {activeSection === 'datasync' && (
        <div className="animate-scale-in">
          <DataSyncAdmin addToast={addToast} />
        </div>
      )}

      {activeSection === 'config' && isSuperAdmin && (
        <div className="animate-scale-in">
          <GameConfigAdmin />
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
