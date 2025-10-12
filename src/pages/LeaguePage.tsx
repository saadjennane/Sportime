import React, { useState, useMemo } from 'react';
import { Profile, UserLeague, LeagueMember, Game, LeagueGame } from '../../types';
import { ArrowLeft, Users, Settings, Link, Gamepad2, Plus, ChevronDown, Folder, FolderOpen } from 'lucide-react';
import { LeagueInviteModal } from '../components/leagues/LeagueInviteModal';
import { LeagueManageModal } from '../components/leagues/LeagueManageModal';
import { LeagueGameCard } from '../components/leagues/LeagueGameCard';
import { LinkGameModal } from '../components/leagues/LinkGameModal';
import { useMockStore } from '../store/useMockStore';
import { ConfirmationModal } from '../components/leagues/ConfirmationModal';
import { AnimatePresence, motion } from 'framer-motion';

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
  onLinkGame: (leagueId: string, game: Game) => void;
  leagueGames: LeagueGame[];
  allGames: Game[];
  linkableGames: Game[];
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
}

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
  const { league, members, memberRoles, currentUserRole, currentUserId, onBack, onUpdateDetails, onRemoveMember, onResetInviteCode, onLeave, onDelete, onViewGame, onLinkGame, leagueGames, allGames, linkableGames, addToast } = props;
  
  const { unlinkGameFromLeague } = useMockStore();
  const [activeTab, setActiveTab] = useState<'members' | 'games'>('games');
  const [isInviteModalOpen, setIsInviteModalOpen] = useState(false);
  const [isManageModalOpen, setIsManageModalOpen] = useState(false);
  const [isLinkGameModalOpen, setIsLinkGameModalOpen] = useState(false);
  const [gameToUnlink, setGameToUnlink] = useState<(LeagueGame & { status: Game['status'] }) | null>(null);
  const [isFinishedOpen, setIsFinishedOpen] = useState(false);

  const adminProfile = members.find(m => m.id === league.created_by);

  const { activeLinkedGames, finishedLinkedGames } = useMemo(() => {
    const allLinkedGames = leagueGames
      .filter(lg => lg.league_id === league.id)
      .map(lg => {
        const gameDetails = allGames.find(g => g.id === lg.game_id);
        return { ...lg, status: gameDetails?.status || 'Finished' as Game['status'] };
      });

    return {
      activeLinkedGames: allLinkedGames.filter(g => g.status !== 'Finished'),
      finishedLinkedGames: allLinkedGames.filter(g => g.status === 'Finished'),
    };
  }, [leagueGames, league.id, allGames]);

  const handleConfirmUnlink = () => {
    if (gameToUnlink) {
      unlinkGameFromLeague(gameToUnlink.game_id, league.id);
      addToast(`"${gameToUnlink.game_name}" unlinked from ${league.name}`, 'success');
      setGameToUnlink(null);
    }
  };

  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to Leagues
      </button>

      {/* Header */}
      <div className="card-base p-5 text-center space-y-3">
        <div className="w-24 h-24 bg-deep-navy rounded-full mx-auto flex items-center justify-center border-2 border-neon-cyan/20">
          {league.image_url ? (
            <img src={league.image_url} alt={league.name} className="w-full h-full object-cover rounded-full" />
          ) : (
            <Users className="w-12 h-12 text-neon-cyan/50" />
          )}
        </div>
        <div>
          <h2 className="text-2xl font-bold text-text-primary">{league.name}</h2>
          {league.description && <p className="text-sm text-text-secondary mt-1">{league.description}</p>}
          <p className="text-xs text-text-disabled mt-2">Created by {adminProfile?.username || '...'} on {new Date(league.created_at).toLocaleDateString()}</p>
        </div>
        <div className="flex justify-center gap-2 pt-2 border-t border-white/10">
          <button onClick={() => setIsInviteModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-navy-accent text-text-secondary px-4 py-2 rounded-lg hover:bg-white/10">
            <Link size={16} /> Invite
          </button>
          {currentUserRole === 'admin' && (
            <button onClick={() => setIsManageModalOpen(true)} className="flex-1 flex items-center justify-center gap-2 text-sm font-semibold bg-navy-accent text-text-secondary px-4 py-2 rounded-lg hover:bg-white/10">
              <Settings size={16} /> Manage
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-navy-accent rounded-xl p-1 gap-1">
        <TabButton label="Members" icon={<Users size={16} />} isActive={activeTab === 'members'} onClick={() => setActiveTab('members')} />
        <TabButton label="Games" icon={<Gamepad2 size={16} />} isActive={activeTab === 'games'} onClick={() => setActiveTab('games')} />
      </div>

      {/* Tab Content */}
      <div className="animate-scale-in">
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
              <button onClick={() => setIsLinkGameModalOpen(true)} className="w-full flex items-center justify-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-4 py-3 rounded-lg hover:bg-lime-glow/30 transition-colors border-2 border-dashed border-lime-glow/30">
                <Plus size={16} /> Link a Game
              </button>
            )}
            {activeLinkedGames.length > 0 ? (
              activeLinkedGames.map(game => (
                <LeagueGameCard key={game.id} game={game} onView={() => onViewGame(game.game_id, game.type)} isAdmin={currentUserRole === 'admin'} onUnlink={() => setGameToUnlink(game)} />
              ))
            ) : (
               <div className="card-base p-8 text-center">
                <div className="text-6xl mb-4">👾</div>
                <p className="text-text-secondary font-medium">No active games linked.</p>
                {currentUserRole === 'admin' && <p className="text-sm text-text-disabled mt-2">Link a game for your league to compete in!</p>}
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
                          <LeagueGameCard key={game.id} game={game} onView={() => onViewGame(game.game_id, game.type)} isAdmin={false} />
                        ))}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Modals */}
      <LeagueInviteModal 
        isOpen={isInviteModalOpen}
        onClose={() => setIsInviteModalOpen(false)}
        inviteCode={league.invite_code}
        isAdmin={currentUserRole === 'admin'}
        onReset={() => onResetInviteCode(league.id)}
      />
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
