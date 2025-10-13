import React, { useState, useMemo, useEffect } from 'react';
import { FantasyGame, UserFantasyTeam, FantasyPlayer, PlayerPosition, Booster, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../../types';
import { ScrollText, Trophy, X, Check, Target, ArrowLeft, Replace } from 'lucide-react';
import { FantasyPlayerModal } from '../components/FantasyPlayerModal';
import { FantasyLeaderboardModal } from '../components/FantasyLeaderboardModal';
import { mockBoosters } from '../data/mockFantasy.tsx';
import { BoosterSelectionModal } from '../components/BoosterSelectionModal';
import { FantasyRulesModal } from '../components/FantasyRulesModal';
import { updateAllPlayerStatuses, processGameWeek } from '../services/fantasyService';
import { mockPlayerLast10Stats, mockPlayerGameWeekStats } from '../data/mockPlayerStats';

// New fantasy components
import { GameWeekConditions } from '../components/fantasy/GameWeekConditions';
import { FantasyPitch } from '../components/fantasy/FantasyPitch';
import { Bench } from '../components/fantasy/Bench';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { LivePointsBreakdown } from '../components/fantasy/LivePointsBreakdown';
import { LinkGameButton } from '../components/leagues/LinkGameButton';
import { useMockStore } from '../store/useMockStore';
import { SubstitutionModal } from '../components/fantasy/SubstitutionModal';


interface FantasyGameWeekPageProps {
  game: FantasyGame;
  allPlayers: FantasyPlayer[];
  onBack: () => void;
  initialLeagueContext?: { leagueId: string; leagueName: string; fromLeague?: boolean };
  allUsers: Profile[];
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
  currentUserId: string;
  onLinkGame: (game: Game) => void;
  profile: Profile;
}

export const FantasyGameWeekPage: React.FC<FantasyGameWeekPageProps> = (props) => {
  const { game, allPlayers: initialPlayers, onBack, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId, onLinkGame, profile } = props;
  
  const { userFantasyTeams, updateUserFantasyTeam } = useMockStore();
  
  const allPlayers = useMemo(() => updateAllPlayerStatuses(initialPlayers, mockPlayerLast10Stats), [initialPlayers]);

  const [selectedMatchDayId, setSelectedMatchDayId] = useState(initialLeagueContext ? game.gameWeeks[game.gameWeeks.length - 1].id : (game.gameWeeks.find(gw => gw.status === 'live')?.id || game.gameWeeks.find(gw => gw.status === 'upcoming')?.id || game.gameWeeks[0].id));
  
  const [editingSlot, setEditingSlot] = useState<{ position: PlayerPosition; playerToReplaceId: string | null } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(!!initialLeagueContext);
  const [isBoosterModalOpen, setIsBoosterModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [selectedForSwap, setSelectedForSwap] = useState<FantasyPlayer | null>(null);
  const [isTeamConfirmed, setIsTeamConfirmed] = useState(false);
  const [substitutingPlayer, setSubstitutingPlayer] = useState<FantasyPlayer | null>(null);

  const selectedGameWeek = useMemo(() => game.gameWeeks.find(gw => gw.id === selectedMatchDayId)!, [game.gameWeeks, selectedMatchDayId]);
  const isLive = selectedGameWeek.status === 'live';
  const isFinished = selectedGameWeek.status === 'finished';
  const isLiveOrFinished = isLive || isFinished;
  
  const userTeam = useMemo(() => {
    return userFantasyTeams.find(t => t.gameWeekId === selectedGameWeek.id);
  }, [userFantasyTeams, selectedGameWeek.id]);

  const { simulationResult, updatedTeam } = useMemo(() => {
    if (!userTeam || !isLiveOrFinished) return { simulationResult: null, updatedTeam: null };
    return processGameWeek(userTeam, allPlayers, mockPlayerGameWeekStats);
  }, [userTeam, allPlayers, isLiveOrFinished]);

  useEffect(() => {
    if (updatedTeam && JSON.stringify(updatedTeam) !== JSON.stringify(userTeam)) {
      updateUserFantasyTeam(updatedTeam);
    }
  }, [updatedTeam, userTeam, updateUserFantasyTeam]);

  const { starters, substitutes, captainId } = useMemo(() => {
    if (!userTeam) return { starters: [], substitutes: [], captainId: null };
    return {
      starters: userTeam.starters.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[],
      substitutes: userTeam.substitutes.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[],
      captainId: userTeam.captain_id,
    };
  }, [userTeam, allPlayers]);

  const liveStarters = useMemo(() => {
    if (!simulationResult) return starters;
    return starters.map(p => {
        const result = simulationResult.playerResults[p.id];
        return result ? { ...p, livePoints: result.points } : p;
    });
  }, [starters, simulationResult]);

  const dnpStarters = useMemo(() => {
    if (!isLive) return [];
    return starters.filter(p => mockPlayerGameWeekStats[p.id]?.minutes_played === 0);
  }, [starters, isLive]);

  const areConditionsMet = useMemo(() => {
    if (!selectedGameWeek.conditions) return true;
    
    return selectedGameWeek.conditions.every(condition => {
      switch (condition.key) {
        case 'max_club_players': {
          const clubCounts = starters.reduce((acc, player) => {
            acc[player.teamName] = (acc[player.teamName] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return Object.values(clubCounts).every(count => count <= (condition.value as number));
        }
        // ... other conditions
        default:
          return true;
      }
    });
  }, [starters, selectedGameWeek.conditions]);

  const handleUpdateUserTeam = (updatedTeam: UserFantasyTeam) => {
    updateUserFantasyTeam(updatedTeam);
    setIsTeamConfirmed(false); // Re-enable confirmation on any edit
  };

  const handlePitchSlotClick = (position: PlayerPosition, player: FantasyPlayer | null) => {
    if (isLiveOrFinished) {
        if (isLive && player && dnpStarters.some(p => p.id === player.id)) {
            setSubstitutingPlayer(player);
        }
        return;
    }

    if (selectedForSwap) {
      if (player) {
        if (userTeam) {
            const newStartersIds = starters.map(p => (p.id === player.id ? selectedForSwap.id : p.id));
            const newSubstitutesIds = substitutes.map(p => (p.id === selectedForSwap.id ? player.id : p.id));
            handleUpdateUserTeam({ ...userTeam, starters: newStartersIds, substitutes: newSubstitutesIds });
        }
        setSelectedForSwap(null);
      } else {
        setSelectedForSwap(null);
      }
    } else {
      setEditingSlot({ position, playerToReplaceId: player?.id || null });
    }
  };

  const handleBenchSlotClick = (position: PlayerPosition, player: FantasyPlayer | null) => {
    if (isLiveOrFinished) return;
    if (player) {
      setSelectedForSwap(current => (current?.id === player.id ? null : player));
    } else {
      setEditingSlot({ position, playerToReplaceId: null });
    }
  };

  const handleSelectPlayerFromModal = (selectedPlayer: FantasyPlayer) => {
    if (!userTeam || !editingSlot || isLiveOrFinished) return;

    const { playerToReplaceId } = editingSlot;
    const newStartersIds = [...starters.map(p => p.id)];
    const newSubstitutesIds = [...substitutes.map(p => p.id)];

    if (newStartersIds.includes(selectedPlayer.id) || newSubstitutesIds.includes(selectedPlayer.id)) {
        console.error("Player is already in the team.");
        setEditingSlot(null);
        return;
    }

    if (playerToReplaceId) {
        const starterIndex = newStartersIds.indexOf(playerToReplaceId);
        if (starterIndex > -1) {
            newStartersIds[starterIndex] = selectedPlayer.id;
            handleUpdateUserTeam({ ...userTeam, starters: newStartersIds });
        } else {
            const subIndex = newSubstitutesIds.indexOf(playerToReplaceId);
            if (subIndex > -1) {
                newSubstitutesIds[subIndex] = selectedPlayer.id;
                handleUpdateUserTeam({ ...userTeam, substitutes: newSubstitutesIds });
            }
        }
    }
    setEditingSlot(null);
  };
  
  const handleBoosterSelect = (booster: Booster, targetId?: string) => {
    if (!userTeam || isLiveOrFinished) return;
    handleUpdateUserTeam({ ...userTeam, booster_used: booster.id, booster_target_id: targetId });
    setIsBoosterModalOpen(false);
  };
  
  const handleCancelBooster = () => {
    if (!userTeam || isLiveOrFinished) return;
    handleUpdateUserTeam({ ...userTeam, booster_used: null, booster_target_id: null });
  };

  const handleConfirmTeam = () => {
    if (isLiveOrFinished || !areConditionsMet) return;
    console.log("Team confirmed:", userTeam);
    setIsTeamConfirmed(true);
  };
  
  const handleSubstitution = (dnpPlayerId: string, subPlayerId: string) => {
    if (!userTeam) return;
    const newStarters = userTeam.starters.map(id => id === dnpPlayerId ? subPlayerId : id);
    const newSubstitutes = userTeam.substitutes.map(id => id === subPlayerId ? dnpPlayerId : id);
    let newCaptainId = userTeam.captain_id;
    if (userTeam.captain_id === dnpPlayerId) {
        newCaptainId = subPlayerId;
    }
    handleUpdateUserTeam({ ...userTeam, starters: newStarters, substitutes: newSubstitutes, captain_id: newCaptainId });
    setSubstitutingPlayer(null);
  };

  const selectedBooster = mockBoosters.find(b => b.id === userTeam?.booster_used);

  return (
    <div className="space-y-4 pb-28">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={18} />
        Back
      </button>

      {/* ... rest of the component ... */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-text-primary">{game.name}</h2>
          <p className="text-sm font-semibold text-text-secondary">{selectedGameWeek.name}</p>
        </div>
        <div className="flex items-center gap-2">
          <LinkGameButton game={game} userId={profile.id} userLeagues={userLeagues} leagueMembers={leagueMembers} leagueGames={leagueGames} onLink={onLinkGame} loading={false} />
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"><ScrollText size={20} /></button>
          <button onClick={() => setIsLeaderboardOpen(true)} className="flex items-center gap-1.5 p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"><Trophy size={20} /><span className="text-xs font-bold">3k/12k</span></button>
        </div>
      </div>

      <div className="-mx-4">
        <MatchDaySwitcher gameWeeks={game.gameWeeks} selectedGameWeekId={selectedMatchDayId} onSelect={setSelectedMatchDayId} />
      </div>

      {isLive ? (
        <div className="text-center text-sm font-bold p-2 rounded-lg bg-hot-red/20 text-hot-red flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-hot-red/70 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-hot-red"></span></span>
            LIVE
        </div>
      ) : isFinished ? (
         <div className="text-center text-sm font-bold p-2 rounded-lg bg-lime-glow/20 text-lime-glow flex items-center justify-center gap-2"><Check size={16} /> Game Week Finished</div>
      ) : (
        <div className="text-center text-xs font-semibold p-2 rounded-lg bg-navy-accent text-text-secondary">Team edit available until deadline</div>
      )}
      
      <GameWeekConditions gameWeek={selectedGameWeek} team={starters} />
      
      {isLiveOrFinished && simulationResult && (
        <LivePointsBreakdown playerResults={simulationResult.playerResults} teamResult={simulationResult.teamResult} teamPlayers={liveStarters} captainId={captainId} isFinished={isFinished} />
      )}

      <FantasyPitch starters={liveStarters} onSlotClick={handlePitchSlotClick} captainId={captainId} selectedForSwap={selectedForSwap} formation={selectedGameWeek.formationConstraint || '2-3-1'} isLive={isLiveOrFinished} />

      <Bench substitutes={substitutes} onSlotClick={handleBenchSlotClick} captainId={captainId} selectedForSwap={selectedForSwap} isLive={isLiveOrFinished} />
      
      {!isLiveOrFinished && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedBooster ? (
            <div className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all bg-gradient-to-r from-warm-yellow to-orange-500 text-white">
              {React.cloneElement(selectedBooster.icon, { size: 20 })}
              <span>{selectedBooster.name}</span>
              <button onClick={handleCancelBooster} disabled={isLiveOrFinished} className="ml-1 text-white/80 hover:text-white disabled:opacity-50" aria-label="Cancel booster"><X size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setIsBoosterModalOpen(true)} disabled={isLiveOrFinished} className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all disabled:bg-disabled disabled:text-text-disabled disabled:opacity-70 bg-navy-accent hover:bg-white/10"><Target size={18} /> <span>Booster ({mockBoosters.filter(b => !b.used).length})</span></button>
          )}

          <button onClick={handleConfirmTeam} disabled={!areConditionsMet || isTeamConfirmed || isLiveOrFinished} title={!areConditionsMet ? "Your team violates GameWeek rules." : ""} className="flex-1 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all primary-button"><Check size={18} /> {isTeamConfirmed ? 'Team Confirmed' : 'Confirm Team'}</button>
        </div>
      )}

      {isLive && dnpStarters.length > 0 && <p className="text-center text-xs text-warm-yellow">A player in your starting lineup did not play. Tap them to make a substitution.</p>}

      {/* MODALS */}
      <FantasyPlayerModal isOpen={!!editingSlot} onClose={() => setEditingSlot(null)} position={editingSlot?.position || 'Attacker'} allPlayers={allPlayers} onSelectPlayer={handleSelectPlayerFromModal} />
      <FantasyLeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} game={game} initialLeagueContext={initialLeagueContext} allUsers={allUsers} userLeagues={userLeagues} leagueMembers={leagueMembers} leagueGames={leagueGames} currentUserId={currentUserId} />
      <BoosterSelectionModal isOpen={isBoosterModalOpen} onClose={() => setIsBoosterModalOpen(false)} boosters={mockBoosters} onSelect={handleBoosterSelect} teamPlayers={starters} />
      <FantasyRulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
      {substitutingPlayer && (
        <SubstitutionModal
          isOpen={!!substitutingPlayer}
          onClose={() => setSubstitutingPlayer(null)}
          dnpPlayer={substitutingPlayer}
          availableSubs={substitutes.filter(s => s.position === substitutingPlayer.position)}
          onConfirm={handleSubstitution}
        />
      )}
    </div>
  );
};
