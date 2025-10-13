import React, { useState, useMemo } from 'react';
import { Profile, UserLeague, LeagueMember, Game, LeagueGame, LeagueFeedPost, LeaderboardSnapshot, PrivateLeagueGameConfig, Match } from '../../types';
import { ArrowLeft, Users, Settings, Link, Gamepad2, Plus, ChevronDown, Folder, FolderOpen, Newspaper, Trophy, Radio } from 'lucide-react';
import { LeagueInviteModal } from '../components/leagues/LeagueInviteModal';
import { LeagueManageModal } from '../components/leagues/LeagueManageModal';
import { LeagueGameCard } from '../components/leagues/LeagueGameCard';
import { LinkGameModal } from '../components/leagues/LinkGameModal';
import { useMockStore } from '../store/useMockStore';
import { ConfirmationModal } from '../components/leagues/ConfirmationModal';
import { AnimatePresence, motion } from 'framer-motion';
import { LeagueFeed } from '../components/leagues/LeagueFeed';
import { SnapshotModal } from '../components/leagues/SnapshotModal';
import { CreatePrivateLeagueWizard } from '../components/leagues/wizard/CreatePrivateLeagueWizard';
import { LiveGameSetupModal } from '../components/leagues/live-game/LiveGameSetupModal';
import { LiveGameCard } from '../components/leagues/live-game/LiveGameCard';
import { mockMatches } from '../data/mockMatches';

interface LeaguePageProps {
  league: UserLeague;
  members: Profile[];
  memberRoles: LeagueMember[];
  currentUserRole: 'admin' | 'member';
  currentUserId: string;
  onBack: () => void;
  onUpdateDetails: (leagueId: string, name: string, description: string, imageUrl: string | null) => void;
  onRemoveMember: (leagueId: string, userId: string) => void;
  onResetInviteCode: (leagueId: string) => void;
  onLeave: () => void;
  onDelete: () => void;
  onViewGame: (gameId: string, gameType: 'Fantasy' | 'Prediction' | 'Betting') => void;
  onViewLiveGame: (gameId: string, status: 'Upcoming' | 'Ongoing' | 'Finished') => void;
  onLinkGame: (leagueId: string, game: Game) => void;
  leagueGames: LeagueGame[];
  allGames: Game[];
  linkableGames: Game[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

type LeagueTab = 'feed' | 'games' | 'live' | 'members';

const TabButton: React.FC<{ icon: React.ReactNode, label: string, isActive: boolean, onClick: () => void }> = ({ icon, label, isActive, onClick }) => (
  <button
    onClick={onClick}
    className={`flex-1 flex items-center justify-center gap-2 p-3 rounded-lg font-semibold transition-all ${
      isActive ? 'bg-electric-blue text-white shadow' : 'text-text-secondary'
    }`}
  >
    {icon} {label}
  </button>
);

const LeaguePage: React.FC<LeaguePageProps> = (props) => {
  const { league, members, memberRoles, currentUserRole, currentUserId, onBack, onUpdateDetails, onRemoveMember, onResetInviteCode, onLeave, onDelete, onViewGame, onViewLiveGame, onLinkGame, leagueGames, allGames, linkableGames, addToast } = props;
  
  const { unlinkGameFromLeague, leagueFeed, toggleFeedPostLike, createPrivateLeagueGame, liveGames, createLiveGame } = useMockStore();
  const [activeTab, setActiveTab] = useState<LeagueTab>('live');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isLinkGameModalOpen, setIsLinkGameModalOpen] = useState(false);
  const [isWizardOpen, setIsWizardOpen] = useState(false);
  const [isLiveGameSetupOpen, setIsLiveGameSetupOpen] = useState(false);
  const [gameToUnlink, setGameToUnlink] = useState<(LeagueGame & { status: Game['status'] }) | null>(null);
  const [isFinishedOpen, setIsFinishedOpen] = useState(false);
  const [viewingSnapshot, setViewingSnapshot] = useState<LeaderboardSnapshot | null>(null);

  const adminProfile = members.find(m => m.id === league.created_by);

  const { activeLinkedGames, finishedLinkedGames } = useMemo(() => {
    const allLinkedGames = leagueGames
      .filter(lg => lg.league_id === league.id)
      .map(lg => {
        if (lg.type === 'Private') {
          return { ...lg, status: 'Upcoming' as Game['status'] }; // Assume private games are always active for now
        }
        const gameDetails = allGames.find(g => g.id === lg.game_id);
        return { ...lg, status: gameDetails?.status || 'Finished' as Game['status'] };
      });

    return {
      activeLinkedGames: allLinkedGames.filter(g => g.status !== 'Finished'),
      finishedLinkedGames: allLinkedGames.filter(g => g.status === 'Finished'),
    };
  }, [leagueGames, league.id, allGames]);

  const liveGamesForThisLeague = useMemo(() => {
    return liveGames.filter(lg => lg.league_id === league.id);
  }, [liveGames, league.id]);

  const handleConfirmUnlink = () => {
    if (gameToUnlink) {
      unlinkGameFromLeague(gameToUnlink.game_id, league.id);
      addToast(`"${gameToUnlink.game_name}" unlinked from ${league.name}`, 'success');
      setGameToUnlink(null);
    }
  };

  const feedForThisLeague = useMemo(() => {
    return leagueFeed.filter(post => post.league_id === league.id);
  }, [leagueFeed, league.id]);

  const snapshotAuthor = useMemo(() => {
    if (!viewingSnapshot) return undefined;
    return members.find(m => m.id === viewingSnapshot.created_by);
  }, [viewingSnapshot, members]);

  const handleCreatePrivateGame = (leagueId: string, config: PrivateLeagueGameConfig) => {
    createPrivateLeagueGame(leagueId, config);
    addToast(`Private game created in your league!`, 'success');
    setIsWizardOpen(false);
  };
  
  const handleCreateLiveGame = (match: Match) => {
    createLiveGame(league.id, match);
    setIsLiveGameSetupOpen(false);
    addToast('Live Game created successfully!', 'success');
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to Leagues
      </button>

      {/* Header */}
      <div className="card-base p-4 flex items-center gap-4">
        {/* League Image */}
        <div className="w-16 h-16 bg-deep-navy rounded-lg flex-shrink-0 flex items-center justify-center border-2 border-neon-cyan/20">
          {league.image_url ? (
            <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-lg" />
          ) : (
            <Users className="w-8 h-8 text-neon-cyan/50" />
          )}
        </div>

        {/* League Info */}
        <div className="flex-grow min-w-0">
          <h2 className="text-xl font-bold text-text-primary truncate">{league.name}</h2>
          {league.description && <p className="text-sm text-text-secondary truncate">{league.description}</p>}
          <p className="text-xs text-text-disabled mt-1">
            Created by {adminProfile?.username || '...'}
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex-shrink-0 flex items-center gap-2">
          <button onClick={() => setIsInviteModalOpen(true)} className="p-2 bg-deep-navy rounded-lg text-text-secondary hover:bg-white/10" title="Invite">
            <Link size={18} />
          </button>
          {currentUserRole === 'admin' && (
            <button onClick={() => setIsManageModalOpen(true)} className="p-2 bg-deep-navy rounded-lg text-text-secondary hover:bg-white/10" title="Manage">
              <Settings size={18} />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
        <TabButton label="Feed" icon={<Newspaper size={16} />} isActive={activeTab === 'feed'} onClick={() => setActiveTab('feed')} />
        <TabButton label="Games" icon={<Gamepad2 size={16} />} isActive={activeTab === 'games'} onClick={() => setActiveTab('games')} />
        <TabButton label="Live" icon={<Radio size={16} />} isActive={activeTab === 'live'} onClick={() => setActiveTab('live')} />
        <TabButton label="Members" icon={<Users size={16} />} isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
      </div>

      {/* Tab Content */}
      <div className="animate-scale-in">
        {activeTab === 'feed' && (
          <LeagueFeed
            posts={feedForThisLeague}
            members={members}
            currentUserId={currentUserId}
            onViewSnapshot={setViewingSnapshot}
            onToggleLike={(postId) => toggleFeedPostLike(postId, currentUserId)}
          />
        )}

        {activeTab === 'members' && (
          <div className="card-base p-5">
            <h3 className="font-bold text-text-secondary mb-4">Members ({members.length})</h3>
            <div className="grid grid-cols-4 sm:grid-cols-5 gap-4">
              {members.map(member => (
                <div key={member.id} className="flex flex-col items-center text-center">
                  <img src={member.profile_picture_url || `https://api.dicebear.com/8.x/bottts/svg?seed=${member.id}`} alt={member.username || 'user'} className="w-12 h-12 rounded-full object-cover bg-deep-navy" />
                  <p className="text-xs font-semibold text-text-primary mt-1 truncate w-full">{member.username}</p>
                  {memberRoles.find(m => m.user_id === member.id)?.role === 'admin' && (
                    <p className="text-[10px] font-bold text-electric-blue">Admin</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'games' && (
          <div className="space-y-4">
            {currentUserRole === 'admin' && (
              <div className="grid grid-cols-2 gap-3">
                <button onClick={() => setIsLinkGameModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30 transition-colors border-2 border-dashed border-lime-glow/30">
                  <Link size={16} /> Link Game
                </button>
                 <button onClick={() => setIsWizardOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-electric-blue/20 text-electric-blue px-4 py-3 rounded-lg hover:bg-electric-blue/30 transition-colors border-2 border-dashed border-electric-blue/30">
                  <Trophy size={16} /> Create Game
                </button>
              </div>
            )}
            {activeLinkedGames.length > 0 ? (
              activeLinkedGames.map(game => (
                <LeagueGameCard 
                  key={game.id} 
                  game={game} 
                  onView={() => {
                    if (game.type === 'Private') {
                      addToast('Viewing private games is coming soon!', 'info');
                    } else {
                      onViewGame(game.game_id, game.type as 'Fantasy' | 'Prediction' | 'Betting');
                    }
                  }}
                  isAdmin={currentUserRole === 'admin'} 
                  onUnlink={() => setGameToUnlink(game)} 
                />
              ))
            ) : (
               <div className="card-base p-8 text-center">
                <div className="text-6xl mb-4">👾</div>
                <p className="text-text-secondary font-medium">No active games linked.</p>
                {currentUserRole === 'admin' && <p className="text-sm text-text-disabled mt-2">Link an official game or create a private one!</p>}
              </div>
            )}

            {finishedLinkedGames.length > 0 && (
              <div className="card-base p-4">
                <button onClick={() => setIsFinishedOpen(!isFinishedOpen)} className="w-full flex justify-between items-center text-left">
                  <div className="flex items-center gap-3">
                    {isFinishedOpen ? <FolderOpen size={18} className="text-warm-yellow" /> : <Folder size={18} className="text-text-disabled" />}
                    <h3 className="text-lg font-bold text-text-secondary">Finished Games</h3>
                    <span className="bg-disabled text-text-disabled text-xs font-bold px-2.5 py-1 rounded-full">{finishedLinkedGames.length}</span>
                  </div>
                  <ChevronDown className={`w-6 h-6 text-text-disabled transition-transform duration-300 ${isFinishedOpen ? 'rotate-180' : ''}`} />
                </button>
                <AnimatePresence>
                  {isFinishedOpen && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="overflow-hidden"
                    >
                      <div className="mt-4 space-y-4 border-t border-white/10 pt-4">
                        {finishedLinkedGames.map(game => (
                          <LeagueGameCard 
                            key={game.id} 
                            game={game} 
                            onView={() => {
                              if (game.type === 'Private') {
                                addToast('Viewing private games is coming soon!', 'info');
                              } else {
                                onViewGame(game.game_id, game.type as 'Fantasy' | 'Prediction' | 'Betting');
                              }
                            }} 
                            isAdmin={false} 
                          />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}

        {activeTab === 'live' && (
          <div className="space-y-4">
            {currentUserRole === 'admin' && (
              <button onClick={() => setIsLiveGameSetupOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-hot-red/20 text-hot-red px-4 py-3 rounded-lg hover:bg-hot-red/30 transition-colors border-2 border-dashed border-hot-red/30">
                <Radio size={16} /> Create Live Game
              </button>
            )}
            {liveGamesForThisLeague.length > 0 ? (
              liveGamesForThisLeague.map(game => (
                <LiveGameCard 
                  key={game.id}
                  game={game}
                  onView={() => onViewLiveGame(game.id, game.status)}
                />
              ))
            ) : (
              <div className="card-base p-8 text-center">
                <div className="text-6xl mb-4">📡</div>
                <p className="text-text-secondary font-medium">No live games here.</p>
                {currentUserRole === 'admin' && <p className="text-sm text-text-disabled mt-2">Create one to start the fun!</p>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <CreatePrivateLeagueWizard
        isOpen={isWizardOpen}
        onClose={() => setIsWizardOpen(false)}
        league={league}
        onCreate={handleCreatePrivateGame}
      />
      <LiveGameSetupModal
        isOpen={isLiveGameSetupOpen}
        onClose={() => setIsLiveGameSetupOpen(false)}
        onCreate={handleCreateLiveGame}
        matches={mockMatches.filter(m => m.status === 'upcoming')}
      />
      <LeagueInviteModal 
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        inviteCode={league.invite_code}
        isAdmin={currentUserRole === 'admin'}
        onReset={() => onResetInviteCode(league.id)}
      />
      {viewingSnapshot && (
        <SnapshotModal
          isOpen={!!viewingSnapshot}
          onClose={() => setViewingSnapshot(null)}
          snapshot={viewingSnapshot}
          author={snapshotAuthor}
        />
      )}
      {currentUserRole === 'admin' && (
        <>
          <LeagueManageModal
            isOpen={isManageModalOpen}
            onClose={() => setIsManageModalOpen(false)}
            league={league}
            members={members.filter(m => m.id !== currentUserId)}
            onUpdateDetails={onUpdateDetails}
            onRemoveMember={onRemoveMember}
            onLeave={onLeave}
            onDelete={onDelete}
          />
          <LinkGameModal
            isOpen={isLinkGameModalOpen}
            onClose={() => setIsLinkGameModalOpen(false)}
            onLinkGame={(game) => onLinkGame(league.id, game)}
            linkableGames={linkableGames}
            alreadyLinkedGameIds={leagueGames.filter(lg => lg.league_id === league.id).map(g => g.game_id)}
          />
          <ConfirmationModal
            isOpen={!!gameToUnlink}
            onClose={() => setGameToUnlink(null)}
            onConfirm={handleConfirmUnlink}
            title="Unlink Game"
            message={`Are you sure you want to unlink "${gameToUnlink?.game_name}" from your league?`}
            confirmText="Unlink"
            isDestructive={true}
          />
        </>
      )}
    </div>
  );
};
export default LeaguePage;
