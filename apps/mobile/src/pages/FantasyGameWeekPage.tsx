import React, { useState, useMemo, useEffect } from 'react';
import { FantasyGame, UserFantasyTeam, FantasyPlayer, PlayerPosition, Booster, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../../types';
import { Info, Trophy, X, Check, Target, ArrowLeft, Replace, Trash2, Star } from 'lucide-react';
import { FantasyPlayerModal } from '../components/FantasyPlayerModal';
import { FantasyPlayerStatsModal } from '../components/fantasy/FantasyPlayerStatsModal';
import { FantasyLeaderboardModal } from '../components/FantasyLeaderboardModal';
import { mockBoosters } from '../data/mockFantasy.tsx';
import { BoosterSelectionModal } from '../components/BoosterSelectionModal';
import { FantasyRulesModal } from '../components/FantasyRulesModal';
import { processGameWeek, getFantasyGameWeekStats, getGameBoosterUsage } from '../services/fantasyService';
import { useFantasyPlayers, useFantasyTeam } from '../hooks/useFantasy';
import { mockPlayerLast10Stats } from '../data/mockPlayerStats';
import { GameWeekConditions } from '../components/fantasy/GameWeekConditions';
import { FantasyPitch } from '../components/fantasy/FantasyPitch';
import { Bench } from '../components/fantasy/Bench';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { LivePointsBreakdown } from '../components/fantasy/LivePointsBreakdown';
import { LinkGameButton } from '../components/leagues/LinkGameButton';
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
  addToast?: (message: string, type?: 'success' | 'error' | 'info') => void;
}

export const FantasyGameWeekPage: React.FC<FantasyGameWeekPageProps> = (props) => {
  const { game, allPlayers: propPlayers, onBack, initialLeagueContext, allUsers, userLeagues, leagueMembers, leagueGames, currentUserId, onLinkGame, profile, addToast } = props;

  // Real data (Supabase) — replaces the previous mock store + mock players.
  const { players: hookPlayers } = useFantasyPlayers();
  const allPlayers = hookPlayers.length > 0 ? hookPlayers : propPlayers;
  
  const [selectedMatchDayId, setSelectedMatchDayId] = useState(initialLeagueContext ? game.gameWeeks[game.gameWeeks.length - 1].id : (game.gameWeeks.find(gw => gw.status === 'live')?.id || game.gameWeeks.find(gw => gw.status === 'upcoming')?.id || game.gameWeeks[0].id));
  
  const [editingSlot, setEditingSlot] = useState<{ position: PlayerPosition; playerToReplaceId: string | null; isBench?: boolean; slotIndex?: number } | null>(null);
  const [actionSheet, setActionSheet] = useState<{ player: FantasyPlayer; position: PlayerPosition; slotIndex?: number } | null>(null);
  const [statsPlayer, setStatsPlayer] = useState<FantasyPlayer | null>(null);
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

  // Expected starters for this formation (e.g. "2-3-1" = 6 outfield + 1 GK = 7).
  const expectedStarters = (selectedGameWeek.formationConstraint || '2-3-1').split('-').reduce((a, b) => a + Number(b), 0) + 1;
  // Entry deadline = gameweek start; edits lock at kickoff even if the status feed lags.
  const deadlinePassed = selectedGameWeek.startDate ? new Date(selectedGameWeek.startDate) <= new Date() : false;
  const editLocked = isLiveOrFinished || deadlinePassed;
  
  const { team: rawTeam, saveTeam } = useFantasyTeam(currentUserId, selectedMatchDayId);
  // Compose against a real team, or a fresh empty one when none exists yet.
  const userTeam: UserFantasyTeam = useMemo(() => rawTeam ?? {
    userId: currentUserId, gameId: game.id, gameWeekId: selectedMatchDayId,
    starters: [], substitutes: [], captain_id: '', booster_used: null,
    fatigue_state: {}, playerPositions: {},
  }, [rawTeam, currentUserId, game.id, selectedMatchDayId]);

  // Real per-player match stats for this game week (replaces mock stats).
  const [gwStats, setGwStats] = useState<Record<string, any>>({});
  useEffect(() => {
    if (!isLiveOrFinished) { setGwStats({}); return; }
    let cancelled = false;
    const load = () => getFantasyGameWeekStats(selectedGameWeek.id).then(s => { if (!cancelled) setGwStats(s); });
    load();
    const interval = isLive ? setInterval(load, 30000) : undefined;
    return () => { cancelled = true; if (interval) clearInterval(interval); };
  }, [isLiveOrFinished, isLive, selectedGameWeek.id]);

  const { simulationResult } = useMemo(() => {
    if (!userTeam || !isLiveOrFinished) return { simulationResult: null };
    // Apply auto-subs only once the game week is final (minutes are then definitive).
    const { simulationResult } = processGameWeek(userTeam, allPlayers, gwStats, isFinished);
    // For a FINISHED game week, display the server's stored points (source of truth)
    // instead of the client recompute, so there is no client/server mismatch.
    if (isFinished && simulationResult && userTeam.player_points && Object.keys(userTeam.player_points).length > 0) {
      for (const pid of Object.keys(simulationResult.playerResults)) {
        const sp = userTeam.player_points[pid];
        if (sp != null) simulationResult.playerResults[pid].points = sp;
      }
      if (userTeam.total_points != null) simulationResult.teamResult.totalPoints = userTeam.total_points;
    }
    return { simulationResult };
  }, [userTeam, allPlayers, isLiveOrFinished, isFinished, gwStats]);

  const { starters, substitutes, captainId } = useMemo(() => {
    if (!userTeam) return { starters: [], substitutes: [], captainId: null };
    // A starter renders in the slot the user assigned (playerPositions), falling
    // back to the player's primary position — needed for multi-position players.
    const resolve = (id: string) => {
      const p = allPlayers.find(pl => pl.id === id);
      if (!p) return null;
      const assigned = userTeam.playerPositions?.[id];
      return assigned ? { ...p, position: assigned } : p;
    };
    return {
      starters: userTeam.starters.map(resolve).filter(Boolean) as FantasyPlayer[],
      substitutes: userTeam.substitutes.map(resolve).filter(Boolean) as FantasyPlayer[],
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
    return starters.filter(p => gwStats[p.id]?.minutes_played === 0);
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
    setIsTeamConfirmed(false); // Re-enable confirmation on any edit
    void (async () => {
      try {
        const ok = await saveTeam(updatedTeam); // persist to Supabase
        if (ok === false) addToast?.('Could not save your team — try again', 'error');
      } catch {
        addToast?.('Could not save your team — try again', 'error');
      }
    })();
  };

  // Set / unset the captain (the single biggest scoring lever — ×bonus + Double Impact).
  const handleMakeCaptain = (player: FantasyPlayer) => {
    if (editLocked || !userTeam) return;
    handleUpdateUserTeam({ ...userTeam, captain_id: userTeam.captain_id === player.id ? '' : player.id });
    setActionSheet(null);
  };

  const handlePitchSlotClick = (position: PlayerPosition, player: FantasyPlayer | null, slotIndex: number = 0) => {
    if (isLiveOrFinished) {
        if (isLive && player && dnpStarters.some(p => p.id === player.id)) {
            setSubstitutingPlayer(player);
        }
        return;
    }
    if (deadlinePassed) return;

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
    } else if (player) {
      // Filled pitch slot -> action sheet (Stats / Replace / Remove).
      setActionSheet({ player, position, slotIndex });
    } else {
      setEditingSlot({ position, playerToReplaceId: null, isBench: false, slotIndex });
    }
  };

  const handleRemoveFromFormation = (p: FantasyPlayer) => {
    if (editLocked) return;
    const newPositions = { ...(userTeam.playerPositions || {}) };
    const newSlots = { ...(userTeam.playerSlots || {}) };
    delete newPositions[p.id];
    delete newSlots[p.id];
    handleUpdateUserTeam({
      ...userTeam,
      starters: userTeam.starters.filter(id => id !== p.id),
      substitutes: userTeam.substitutes.filter(id => id !== p.id),
      captain_id: userTeam.captain_id === p.id ? '' : userTeam.captain_id,
      playerPositions: newPositions,
      playerSlots: newSlots,
    });
  };

  const handleBenchSlotClick = (position: PlayerPosition, player: FantasyPlayer | null) => {
    if (editLocked) return;
    if (player) {
      setSelectedForSwap(current => (current?.id === player.id ? null : player));
    } else {
      setEditingSlot({ position, playerToReplaceId: null, isBench: true });
    }
  };

  const handleSelectPlayerFromModal = (selectedPlayer: FantasyPlayer) => {
    if (!userTeam || !editingSlot || editLocked) return;

    const { playerToReplaceId } = editingSlot;
    const newStartersIds = [...starters.map(p => p.id)];
    const newSubstitutesIds = [...substitutes.map(p => p.id)];

    if (newStartersIds.includes(selectedPlayer.id) || newSubstitutesIds.includes(selectedPlayer.id)) {
        console.error("Player is already in the team.");
        setEditingSlot(null);
        return;
    }

    // Record the assigned position (multi-position players) and the exact slot.
    const newPositions = { ...(userTeam.playerPositions || {}) };
    const newSlots = { ...(userTeam.playerSlots || {}) };
    if (playerToReplaceId) {
        delete newPositions[playerToReplaceId];
        // the new player inherits the replaced player's slot
        if (newSlots[playerToReplaceId] != null) newSlots[selectedPlayer.id] = newSlots[playerToReplaceId];
        else if (editingSlot.slotIndex != null) newSlots[selectedPlayer.id] = editingSlot.slotIndex;
        delete newSlots[playerToReplaceId];
    } else if (!editingSlot.isBench && editingSlot.slotIndex != null) {
        newSlots[selectedPlayer.id] = editingSlot.slotIndex;
    }
    newPositions[selectedPlayer.id] = editingSlot.position;

    if (playerToReplaceId) {
        const starterIndex = newStartersIds.indexOf(playerToReplaceId);
        if (starterIndex > -1) {
            newStartersIds[starterIndex] = selectedPlayer.id;
            handleUpdateUserTeam({ ...userTeam, starters: newStartersIds, playerPositions: newPositions, playerSlots: newSlots });
        } else {
            const subIndex = newSubstitutesIds.indexOf(playerToReplaceId);
            if (subIndex > -1) {
                newSubstitutesIds[subIndex] = selectedPlayer.id;
                handleUpdateUserTeam({ ...userTeam, substitutes: newSubstitutesIds, playerPositions: newPositions, playerSlots: newSlots });
            }
        }
    } else {
        // Empty slot -> add the player to the formation.
        if (editingSlot.isBench) {
            newSubstitutesIds.push(selectedPlayer.id);
            handleUpdateUserTeam({ ...userTeam, substitutes: newSubstitutesIds, playerPositions: newPositions, playerSlots: newSlots });
        } else {
            newStartersIds.push(selectedPlayer.id);
            handleUpdateUserTeam({ ...userTeam, starters: newStartersIds, playerPositions: newPositions, playerSlots: newSlots });
        }
    }
    setEditingSlot(null);
  };
  
  const handleBoosterSelect = (booster: Booster, targetId?: string) => {
    if (!userTeam || editLocked) return;
    handleUpdateUserTeam({ ...userTeam, booster_used: booster.id, booster_target_id: targetId });
    setIsBoosterModalOpen(false);
  };

  const handleCancelBooster = () => {
    if (!userTeam || editLocked) return;
    handleUpdateUserTeam({ ...userTeam, booster_used: null, booster_target_id: null });
  };

  const handleConfirmTeam = () => {
    if (isLiveOrFinished) return;
    if (deadlinePassed) { addToast?.('The deadline for this game week has passed', 'error'); return; }
    const missing = expectedStarters - starters.length;
    if (missing > 0) { addToast?.(`Complete your XI — ${missing} slot${missing > 1 ? 's' : ''} left`, 'error'); return; }
    if (!captainId) { addToast?.('Pick a captain before confirming ⭐', 'error'); return; }
    if (!areConditionsMet) { addToast?.('Your team violates this game week\'s rules', 'error'); return; }
    setIsTeamConfirmed(true);
    addToast?.(`Team confirmed for ${selectedGameWeek.name} ✓`, 'success');
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

  // Real booster availability: each booster (1/2/3) is usable once per game. A booster
  // committed to ANOTHER game week is "used"; the one on the current week is the active pick.
  const [boosterUsage, setBoosterUsage] = useState<Record<string, number>>({});
  useEffect(() => {
    let cancelled = false;
    getGameBoosterUsage(game.id, currentUserId).then(u => { if (!cancelled) setBoosterUsage(u); }).catch(() => {});
    return () => { cancelled = true; };
  }, [game.id, currentUserId, selectedMatchDayId, userTeam?.booster_used]);

  const boosters = useMemo(() => {
    const usedElsewhere = new Set(
      Object.entries(boosterUsage).filter(([gwId]) => gwId !== selectedMatchDayId).map(([, b]) => b)
    );
    return mockBoosters.map(b => ({ ...b, used: usedElsewhere.has(b.id) }));
  }, [boosterUsage, selectedMatchDayId]);

  const selectedBooster = boosters.find(b => b.id === userTeam?.booster_used);

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
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"><Info size={20} /></button>
          <button onClick={() => setIsLeaderboardOpen(true)} className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue"><Trophy size={20} /></button>
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
      ) : deadlinePassed ? (
        <div className="text-center text-sm font-bold p-2 rounded-lg bg-warm-yellow/15 text-warm-yellow flex items-center justify-center gap-2"><Check size={16} /> Locked — deadline passed</div>
      ) : (
        <div className="text-center text-xs font-semibold p-2 rounded-lg bg-navy-accent text-text-secondary">
          Editable until kickoff{selectedGameWeek.startDate ? ` · ${new Date(selectedGameWeek.startDate).toLocaleString([], { weekday: 'short', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}` : ''}
        </div>
      )}
      
      <GameWeekConditions gameWeek={selectedGameWeek} team={starters} />
      
      {isLiveOrFinished && simulationResult && (
        <LivePointsBreakdown playerResults={simulationResult.playerResults} teamResult={simulationResult.teamResult} teamPlayers={liveStarters} captainId={captainId} isFinished={isFinished} />
      )}

      <FantasyPitch starters={liveStarters} onSlotClick={handlePitchSlotClick} captainId={captainId} selectedForSwap={selectedForSwap} formation={selectedGameWeek.formationConstraint || '2-3-1'} isLive={isLiveOrFinished} playerSlots={userTeam.playerSlots} />

      <Bench substitutes={substitutes} onSlotClick={handleBenchSlotClick} captainId={captainId} selectedForSwap={selectedForSwap} isLive={isLiveOrFinished} />
      
      {!editLocked && (
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {selectedBooster ? (
            <div className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all bg-gradient-to-r from-warm-yellow to-orange-500 text-white">
              {React.cloneElement(selectedBooster.icon, { size: 20 })}
              <span>{selectedBooster.name}</span>
              <button onClick={handleCancelBooster} disabled={isLiveOrFinished} className="ml-1 text-white/80 hover:text-white disabled:opacity-50" aria-label="Cancel booster"><X size={16}/></button>
            </div>
          ) : (
            <button onClick={() => setIsBoosterModalOpen(true)} disabled={isLiveOrFinished} className="flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all disabled:bg-disabled disabled:text-text-disabled disabled:opacity-70 bg-navy-accent hover:bg-white/10"><Target size={18} /> <span>Booster ({boosters.filter(b => !b.used).length})</span></button>
          )}

          <button onClick={handleConfirmTeam} disabled={isTeamConfirmed || editLocked} className="flex-1 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all primary-button"><Check size={18} /> {isTeamConfirmed ? 'Team Confirmed' : 'Confirm Team'}</button>
        </div>
      )}

      {isLive && dnpStarters.length > 0 && <p className="text-center text-xs text-warm-yellow">A starter hasn't played yet. If they finish on 0 minutes, your bench sub of that position is auto‑substituted at the final whistle — or tap them to sub now.</p>}

      {/* MODALS */}
      <FantasyPlayerModal isOpen={!!editingSlot} onClose={() => setEditingSlot(null)} position={editingSlot?.position || 'Attacker'} allPlayers={allPlayers} onSelectPlayer={handleSelectPlayerFromModal} selectedPlayerIds={[...userTeam.starters, ...userTeam.substitutes]} />

      {/* Action sheet for a player already in the formation */}
      {actionSheet && (
        <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4 z-[55] animate-scale-in" onClick={() => setActionSheet(null)}>
          <div className="bg-navy-accent rounded-2xl w-full max-w-sm p-4 border border-white/10" onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-3 mb-2 pb-3 border-b border-white/10">
              <img src={actionSheet.player.photo || `https://api.dicebear.com/8.x/bottts/svg?seed=${actionSheet.player.id}`} alt="" className="w-10 h-10 rounded-full object-cover bg-deep-navy" />
              <p className="font-bold text-text-primary truncate">{actionSheet.player.name}</p>
            </div>
            <button onClick={() => { setStatsPlayer(actionSheet.player); setActionSheet(null); }} className="w-full text-left px-3 py-3 rounded-lg hover:bg-white/5 text-text-primary font-semibold flex items-center gap-3"><Info size={18} /> Stats</button>
            {!editLocked && (
              <button onClick={() => handleMakeCaptain(actionSheet.player)} className="w-full text-left px-3 py-3 rounded-lg hover:bg-warm-yellow/10 text-warm-yellow font-semibold flex items-center gap-3">
                <Star size={18} /> {captainId === actionSheet.player.id ? 'Remove captain' : 'Make captain'}
              </button>
            )}
            {!editLocked && (
              <button onClick={() => { setEditingSlot({ position: actionSheet.position, playerToReplaceId: actionSheet.player.id, isBench: false, slotIndex: actionSheet.slotIndex }); setActionSheet(null); }} className="w-full text-left px-3 py-3 rounded-lg hover:bg-white/5 text-text-primary font-semibold flex items-center gap-3"><Replace size={18} /> Replace</button>
            )}
            {!editLocked && (
              <button onClick={() => { handleRemoveFromFormation(actionSheet.player); setActionSheet(null); }} className="w-full text-left px-3 py-3 rounded-lg hover:bg-hot-red/10 text-hot-red font-semibold flex items-center gap-3"><Trash2 size={18} /> Remove</button>
            )}
            <button onClick={() => setActionSheet(null)} className="w-full text-center px-3 py-2.5 mt-1 text-text-secondary font-semibold">Cancel</button>
          </div>
        </div>
      )}
      <FantasyPlayerStatsModal isOpen={!!statsPlayer} onClose={() => setStatsPlayer(null)} player={statsPlayer} />
      <FantasyLeaderboardModal isOpen={isLeaderboardOpen} onClose={() => setIsLeaderboardOpen(false)} game={game} initialLeagueContext={initialLeagueContext} allUsers={allUsers} userLeagues={userLeagues} leagueMembers={leagueMembers} leagueGames={leagueGames} currentUserId={currentUserId} />
      <BoosterSelectionModal isOpen={isBoosterModalOpen} onClose={() => setIsBoosterModalOpen(false)} boosters={boosters} onSelect={handleBoosterSelect} teamPlayers={starters} />
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
