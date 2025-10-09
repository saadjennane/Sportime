import React, { useState, useMemo } from 'react';
import { FantasyGame, UserFantasyTeam, FantasyPlayer, PlayerPosition, Booster } from '../types';
import { ScrollText, Trophy, X, Check, Target, ArrowLeft } from 'lucide-react';
import { FantasyPlayerModal } from '../components/FantasyPlayerModal';
import { FantasyLeaderboardModal } from '../components/FantasyLeaderboardModal';
import { mockLeagues } from '../data/mockLeagues';
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


interface FantasyGameWeekPageProps {
  game: FantasyGame;
  userTeams: UserFantasyTeam[];
  allPlayers: FantasyPlayer[];
  onBack: () => void;
}

export const FantasyGameWeekPage: React.FC<FantasyGameWeekPageProps> = ({ game, userTeams: initialUserTeams, allPlayers: initialPlayers, onBack }) => {
  const allPlayers = useMemo(() => updateAllPlayerStatuses(initialPlayers, mockPlayerLast10Stats), [initialPlayers]);

  const [selectedMatchDayId, setSelectedMatchDayId] = useState(game.gameWeeks.find(gw => gw.status === 'live')?.id || game.gameWeeks.find(gw => gw.status === 'upcoming')?.id || game.gameWeeks[0].id);
  const [userTeams, setUserTeams] = useState(initialUserTeams);

  const [editingSlot, setEditingSlot] = useState<{ position: PlayerPosition; playerToReplaceId: string | null } | null>(null);
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isBoosterModalOpen, setIsBoosterModalOpen] = useState(false);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);
  const [selectedForSwap, setSelectedForSwap] = useState<FantasyPlayer | null>(null);
  const [isTeamConfirmed, setIsTeamConfirmed] = useState(false);

  const selectedGameWeek = useMemo(() => game.gameWeeks.find(gw => gw.id === selectedMatchDayId)!, [game.gameWeeks, selectedMatchDayId]);
  const isLive = selectedGameWeek.status === 'live';
  const isFinished = selectedGameWeek.status === 'finished';
  const isLiveOrFinished = isLive || isFinished;
  
  const userTeam = useMemo(() => {
    return userTeams.find(t => t.gameWeekId === selectedGameWeek.id);
  }, [userTeams, selectedGameWeek.id]);

  const simulationResult = useMemo(() => {
    if (!userTeam || !isLiveOrFinished) return null;
    return processGameWeek(userTeam, allPlayers, mockPlayerGameWeekStats);
  }, [userTeam, allPlayers, isLiveOrFinished]);

  const { effectiveStarters, effectiveCaptainId } = useMemo(() => {
    if (!userTeam) return { effectiveStarters: [], effectiveCaptainId: null };

    const initialStarters = userTeam.starters.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[];
    let subs = userTeam.substitutes.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[];
    
    let currentStarters = [...initialStarters];
    let currentCaptainId = userTeam.captain_id;

    if (isLiveOrFinished) {
        const dnpStarters = currentStarters.filter(p => p.liveStatus === 'dnp');
        dnpStarters.forEach(dnpPlayer => {
            const subIndex = subs.findIndex(sub => sub.position === dnpPlayer.position && !sub.isSubbedIn);
            if (subIndex > -1) {
                const subPlayer = subs[subIndex];
                subPlayer.isSubbedIn = true;
                
                // Swap player
                currentStarters = currentStarters.map(p => p.id === dnpPlayer.id ? subPlayer : p);
                
                // If captain is DNP, sub inherits captaincy
                if (dnpPlayer.id === currentCaptainId) {
                    currentCaptainId = subPlayer.id;
                }
                
                // Mark sub as used
                subs.splice(subIndex, 1);
            }
        });
    }
    
    return {
        effectiveStarters: currentStarters,
        effectiveCaptainId: currentCaptainId,
    };
  }, [userTeam, allPlayers, isLiveOrFinished]);

  const substitutes = useMemo(() => (userTeam?.substitutes.map(id => allPlayers.find(p => p.id === id)).filter(Boolean) as FantasyPlayer[]) || [], [userTeam, allPlayers]);

  const updateUserTeam = (updatedTeam: UserFantasyTeam) => {
    setUserTeams(prev => prev.map(t => t.gameWeekId === updatedTeam.gameWeekId ? updatedTeam : t));
    setIsTeamConfirmed(false); // Re-enable confirmation on any edit
  };

  const handlePitchSlotClick = (position: PlayerPosition, player: FantasyPlayer | null) => {
    if (isLiveOrFinished) return;

    if (selectedForSwap) {
      if (player) {
        if (userTeam) {
            const newStartersIds = effectiveStarters.map(p => (p.id === player.id ? selectedForSwap.id : p.id));
            const newSubstitutesIds = substitutes.map(p => (p.id === selectedForSwap.id ? player.id : p.id));
            updateUserTeam({ ...userTeam, starters: newStartersIds, substitutes: newSubstitutesIds });
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
    const newStartersIds = [...effectiveStarters.map(p => p.id)];
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
            updateUserTeam({ ...userTeam, starters: newStartersIds });
        } else {
            const subIndex = newSubstitutesIds.indexOf(playerToReplaceId);
            if (subIndex > -1) {
                newSubstitutesIds[subIndex] = selectedPlayer.id;
                updateUserTeam({ ...userTeam, substitutes: newSubstitutesIds });
            }
        }
    }
    setEditingSlot(null);
  };
  
  const handleBoosterSelect = (booster: Booster) => {
    if (!userTeam || isLiveOrFinished) return;
    updateUserTeam({ ...userTeam, booster_used: booster.id });
    setIsBoosterModalOpen(false);
  };
  
  const handleCancelBooster = () => {
    if (!userTeam || isLiveOrFinished) return;
    updateUserTeam({ ...userTeam, booster_used: null });
  };

  const handleConfirmTeam = () => {
    if (isLiveOrFinished || !areConditionsMet) return;
    console.log("Team confirmed:", userTeam);
    setIsTeamConfirmed(true);
  };

  const areConditionsMet = useMemo(() => {
    if (!selectedGameWeek.conditions) return true;
    return selectedGameWeek.conditions.every(condition => {
      switch (condition.key) {
        case 'max_club_players':
          const clubCounts = effectiveStarters.reduce((acc, player) => {
            acc[player.teamName] = (acc[player.teamName] || 0) + 1;
            return acc;
          }, {} as Record<string, number>);
          return Object.values(clubCounts).every(count => count <= (condition.value as number));
        default: return true;
      }
    });
  }, [effectiveStarters, selectedGameWeek.conditions]);

  const selectedLeagues = mockLeagues.filter(l => selectedGameWeek.leagues.includes(l.name));
  const remainingBoosters = mockBoosters.filter(b => !b.used);
  const selectedBooster = mockBoosters.find(b => b.id === userTeam?.booster_used);

  return (
    <div className="space-y-4 pb-28">
      <button onClick={onBack} className="flex items-center gap-2 text-sm text-gray-600 font-semibold hover:text-purple-700">
        <ArrowLeft size={18} />
        Back to Games
      </button>

      {/* 1. TOP SECTION */}
      <div className="flex justify-between items-start">
        <div>
          <h2 className="text-xl font-bold text-gray-800">{game.name}</h2>
          <p className="text-sm font-semibold text-gray-500">{selectedGameWeek.name}</p>
          <div className="flex items-center gap-2 mt-1">
            {selectedLeagues.map(league => <img key={league.id} src={league.logo} alt={league.name} className="w-5 h-5" title={league.name} />)}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <ScrollText size={20} />
          </button>
          <button onClick={() => setIsLeaderboardOpen(true)} className="flex items-center gap-1.5 p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <Trophy size={20} />
            <span className="text-xs font-bold">3k/12k</span>
          </button>
        </div>
      </div>

      {/* 2. MATCHDAY CAROUSEL */}
      <div className="-mx-4">
        <MatchDaySwitcher 
          gameWeeks={game.gameWeeks}
          selectedGameWeekId={selectedMatchDayId}
          onSelect={setSelectedMatchDayId}
        />
      </div>

      {/* 3. DEADLINE/LIVE INFOBULE */}
      {isLive ? (
        <div className="text-center text-sm font-bold p-2 rounded-lg bg-red-100 text-red-600 flex items-center justify-center gap-2">
            <span className="relative flex h-3 w-3">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-3 w-3 bg-red-500"></span>
            </span>
            LIVE
        </div>
      ) : isFinished ? (
         <div className="text-center text-sm font-bold p-2 rounded-lg bg-green-100 text-green-700 flex items-center justify-center gap-2">
            <Check size={16} />
            Game Week Finished
        </div>
      ) : (
        <div className="text-center text-xs font-semibold p-2 rounded-lg bg-gray-100 text-gray-600">
          Team edit available until deadline
        </div>
      )}
      
      {/* 4. & 5. GAME WEEK CONDITIONS & BONUSES */}
      <GameWeekConditions gameWeek={selectedGameWeek} team={effectiveStarters} />
      
      {/* NEW: LIVE/FINAL POINTS BREAKDOWN */}
      {isLiveOrFinished && simulationResult && (
        <LivePointsBreakdown 
          playerResults={simulationResult.playerResults}
          teamResult={simulationResult.teamResult}
          teamPlayers={effectiveStarters}
          captainId={effectiveCaptainId}
          isFinished={isFinished}
        />
      )}

      {/* 6. TEAM GRID */}
      <FantasyPitch 
        starters={effectiveStarters} 
        onSlotClick={handlePitchSlotClick} 
        captainId={effectiveCaptainId}
        selectedForSwap={selectedForSwap}
        formation={selectedGameWeek.formationConstraint || '2-3-1'}
        isLive={isLiveOrFinished}
      />

      {/* 7. BENCH */}
      <Bench 
        substitutes={substitutes} 
        onSlotClick={handleBenchSlotClick} 
        captainId={effectiveCaptainId}
        selectedForSwap={selectedForSwap}
        isLive={isLiveOrFinished}
      />
      
      {/* 8. ACTION BUTTONS */}
      {!isLiveOrFinished && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedBooster ? (
            <div className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all bg-gradient-to-r from-yellow-400 to-orange-500 text-white">
              {React.cloneElement(selectedBooster.icon, { size: 20 })}
              <span>{selectedBooster.name}</span>
              <button 
                onClick={handleCancelBooster} 
                disabled={isLiveOrFinished}
                className="ml-1 text-white/80 hover:text-white disabled:opacity-50"
                aria-label="Cancel booster"
              >
                <X size={16}/>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => setIsBoosterModalOpen(true)} 
              disabled={isLiveOrFinished || remainingBoosters.length === 0}
              className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all disabled:bg-gray-200 disabled:text-gray-500 disabled:opacity-70 bg-white hover:bg-gray-50"
            >
              <Target size={18} /> 
              <span>Booster ({remainingBoosters.length})</span>
            </button>
          )}

          <button 
              onClick={handleConfirmTeam}
              disabled={!areConditionsMet || isTeamConfirmed}
              title={!areConditionsMet ? "Complete all mandatory conditions first." : isTeamConfirmed ? "Your team is already confirmed." : "Submit your final team."}
              className="flex-1 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all bg-gradient-to-r from-purple-600 to-blue-600 text-white disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed"
          >
            {isTeamConfirmed ? <><Check size={18} /> Team Confirmed</> : <><Check size={18} /> Confirm Team</>}
          </button>
        </div>
      )}

      {/* MODALS */}
      <FantasyPlayerModal 
        isOpen={!!editingSlot} 
        onClose={() => setEditingSlot(null)} 
        position={editingSlot?.position || 'Attacker'} 
        allPlayers={allPlayers} 
        onSelectPlayer={handleSelectPlayerFromModal} 
      />
      <FantasyLeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} gameWeekName={selectedGameWeek.name} />
      <BoosterSelectionModal isOpen={isBoosterModalOpen} onClose={() => setIsBoosterModalOpen(false)} boosters={mockBoosters} onSelect={handleBoosterSelect} />
      <FantasyRulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
    </div>
  );
};
