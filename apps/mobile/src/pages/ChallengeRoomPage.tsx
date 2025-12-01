import React, { useState, useMemo } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, ChallengeBet, BoosterSelection, DailyChallengeEntry, LeaderboardEntry, Profile, UserLeague, LeagueMember, LeagueGame, Game } from '../types';
import { ArrowLeft, Coins, ShieldAlert, Trophy, ScrollText } from 'lucide-react';
import { ChallengeBetController } from '../components/ChallengeBetController';
import { BoosterSelector } from '../components/BoosterSelector';
import { BoosterInfoModal } from '../components/BoosterInfoModal';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { addDays, parseISO, isBefore, format } from 'date-fns';
import { RulesModal } from '../components/RulesModal';
import { LinkGameButton } from '../components/leagues/LinkGameButton';

interface ChallengeRoomPageProps {
  challenge: Challenge;
  matches: ChallengeMatch[];
  userEntry: UserChallengeEntry;
  onUpdateDailyBets: (challengeId: string, day: number, bets: ChallengeBet[]) => void;
  onSetDailyBooster: (challengeId: string, day: number, booster: BoosterSelection | undefined) => void;
  onBack: () => void;
  onViewLeaderboard: (challengeId: string) => void;
  boosterInfoPreferences: { x2: boolean, x3: boolean };
  onUpdateBoosterPreferences: (booster: 'x2' | 'x3') => void;
  onLinkGame: (game: Game) => void;
  profile: Profile;
  userLeagues: UserLeague[];
  leagueMembers: LeagueMember[];
  leagueGames: LeagueGame[];
}

const calculateChallengePoints = (entry: UserChallengeEntry, matches: ChallengeMatch[]): number => {
  let totalPoints = 0;
  entry.dailyEntries.forEach(dailyEntry => {
    const booster = dailyEntry.booster;
    dailyEntry.bets.forEach(bet => {
      const match = matches.find(m => m.id === bet.challengeMatchId);
      if (!match || match.status !== 'played' || !match.result) return;
      const isWin = match.result === bet.prediction;
      const isBoosted = booster?.matchId === bet.challengeMatchId;
      if (isWin) {
        let gain = (bet.amount * match.odds[bet.prediction]);
        if (isBoosted) {
          if (booster?.type === 'x2') gain *= 2;
          else if (booster?.type === 'x3') gain *= 3;
        }
        totalPoints += gain;
      } else if (isBoosted && booster?.type === 'x3') {
        totalPoints -= 200;
      }
    });
  });
  return Math.round(totalPoints);
};

// Helper to get group key based on period_type
const getGroupKeyForMatch = (match: ChallengeMatch, periodType: 'matchdays' | 'calendar' | undefined): string => {
  if (periodType === 'calendar') {
    // For calendar mode, group by actual kickoff date
    return match.kickoffTime ? format(new Date(match.kickoffTime), 'yyyy-MM-dd') : match.day.toString();
  }
  // For matchday mode (default), group by matchday number
  return match.day.toString();
};

const ChallengeRoomPage: React.FC<ChallengeRoomPageProps> = (props) => {
  const { challenge, matches, userEntry, onUpdateDailyBets, onSetDailyBooster, onBack, onViewLeaderboard, boosterInfoPreferences, onUpdateBoosterPreferences, onLinkGame, profile, userLeagues, leagueMembers, leagueGames } = props;

  // Debug logging
  console.log('[ChallengeRoomPage] matches:', matches.length, 'days:', [...new Set(matches.map(m => m.day))]);
  console.log('[ChallengeRoomPage] userEntry.dailyEntries:', userEntry.dailyEntries);
  console.log('[ChallengeRoomPage] period_type:', challenge.period_type);

  // Check if a specific match is locked (kickoff has passed)
  const isMatchLocked = (match: ChallengeMatch): boolean => {
    if (challenge.status === 'Finished') return true;
    if (!match.kickoffTime) return false;
    return new Date(match.kickoffTime).getTime() <= Date.now();
  };

  // Check if ALL bets should be locked (for UI elements like booster selector)
  const hasFirstMatchStarted = (): boolean => {
    // Find earliest kickoff time from matches
    const kickoffTimes = matches
      .map(m => m.kickoffTime ? new Date(m.kickoffTime).getTime() : null)
      .filter((t): t is number => t !== null);

    if (kickoffTimes.length > 0) {
      const firstKickoff = Math.min(...kickoffTimes);
      return Date.now() >= firstKickoff;
    }

    // Fallback: if no kickoff times, check if status is Finished
    return challenge.status === 'Finished';
  };

  const betsLocked = hasFirstMatchStarted();

  // Get unique groups based on period_type
  const matchGroups = useMemo(() => {
    const groups = new Map<string, { key: string; matches: ChallengeMatch[]; displayName: string; date: Date; matchdays: number[] }>();

    matches.forEach(match => {
      const key = getGroupKeyForMatch(match, challenge.period_type);
      if (!groups.has(key)) {
        let displayName: string;
        let date: Date;

        if (challenge.period_type === 'calendar') {
          // Calendar mode: use actual date
          date = match.kickoffTime ? new Date(match.kickoffTime) : addDays(parseISO(challenge.start_date), match.day - 1);
          displayName = format(date, 'MMM d');
        } else {
          // Matchday mode: use day number
          date = addDays(parseISO(challenge.start_date), match.day - 1);
          displayName = `Day ${match.day}`;
        }

        groups.set(key, { key, matches: [], displayName, date, matchdays: [] });
      }
      const group = groups.get(key)!;
      group.matches.push(match);
      if (!group.matchdays.includes(match.day)) {
        group.matchdays.push(match.day);
      }
    });

    // Sort by date
    return Array.from(groups.values()).sort((a, b) => a.date.getTime() - b.date.getTime());
  }, [matches, challenge.period_type, challenge.start_date]);

  const matchDaysForSwitcher = useMemo(() => {
    return matchGroups.map(group => ({
      id: group.key,
      name: group.displayName,
      startDate: group.date.toISOString(),
      endDate: group.date.toISOString(),
      leagues: [],
      status: challenge.status,
    }));
  }, [matchGroups, challenge.status]);

  // Initialize selectedGroupKey based on current date
  const [selectedGroupKey, setSelectedGroupKey] = useState<string>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Find the first group that is today or in the future
    for (const group of matchGroups) {
      const groupDate = new Date(group.date);
      groupDate.setHours(0, 0, 0, 0);
      if (groupDate >= today) {
        return group.key;
      }
    }
    // Default to last group
    return matchGroups[matchGroups.length - 1]?.key || '1';
  });

  const [armingBooster, setArmingBooster] = useState<{ groupKey: string, type: 'x2' | 'x3' } | null>(null);
  const [modalState, setModalState] = useState<{ groupKey: string, type: 'x2' | 'x3' } | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  // Get current group
  const currentGroup = useMemo(() => {
    return matchGroups.find(g => g.key === selectedGroupKey) || matchGroups[0];
  }, [matchGroups, selectedGroupKey]);

  // Get bets and calculate remaining balance for current group
  // For calendar mode, we need to aggregate bets across all matchdays in the group
  const { groupBets, remainingGroupBalance, groupBooster } = useMemo(() => {
    if (!currentGroup) return { groupBets: [], remainingGroupBalance: 1000, groupBooster: undefined };

    // Get all daily entries that belong to this group
    const dailyBalance = 1000;
    let totalBet = 0;
    let bets: ChallengeBet[] = [];
    let booster: BoosterSelection | undefined;

    currentGroup.matchdays.forEach(matchday => {
      const dailyEntry = userEntry.dailyEntries.find(d => d.day === matchday);
      if (dailyEntry) {
        // Only include bets for matches that are actually in this group
        const matchIdsInGroup = new Set(currentGroup.matches.map(m => m.id));
        const groupBetsFromDay = dailyEntry.bets.filter(b => matchIdsInGroup.has(b.challengeMatchId));
        bets = [...bets, ...groupBetsFromDay];
        totalBet += groupBetsFromDay.reduce((sum, b) => sum + b.amount, 0);

        // Check if booster is on a match in this group
        if (dailyEntry.booster && matchIdsInGroup.has(dailyEntry.booster.matchId)) {
          booster = dailyEntry.booster;
        }
      }
    });

    return { groupBets: bets, remainingGroupBalance: dailyBalance - totalBet, groupBooster: booster };
  }, [currentGroup, userEntry.dailyEntries]);

  const handleBetChange = (matchId: string, prediction: 'teamA' | 'draw' | 'teamB' | null, amount: number) => {
    // Find which matchday this match belongs to
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    const dailyEntry = userEntry.dailyEntries.find(d => d.day === match.day);
    if (!dailyEntry) return;

    const otherBets = dailyEntry.bets.filter(b => b.challengeMatchId !== matchId);
    let newBets: ChallengeBet[];
    if (prediction === null) {
      newBets = otherBets;
    } else {
      // Auto-allocate full daily balance if there's only one match in this group
      let finalAmount = amount;
      if (currentGroup && currentGroup.matches.length === 1 && amount === 0) {
        finalAmount = 1000; // dailyBalance
      }
      newBets = [...otherBets, { challengeMatchId: matchId, prediction, amount: finalAmount }];
    }
    onUpdateDailyBets(challenge.id, match.day, newBets);
  };

  const handleBoosterClick = (type: 'x2' | 'x3') => {
    if (groupBooster) return; // Already has a booster

    if (armingBooster?.groupKey === selectedGroupKey && armingBooster?.type === type) {
      setArmingBooster(null);
      return;
    }

    if (!boosterInfoPreferences[type]) {
      setModalState({ groupKey: selectedGroupKey, type });
    } else {
      setArmingBooster({ groupKey: selectedGroupKey, type });
    }
  };

  const handleActivateBoosterFromModal = () => {
    if (modalState) {
      setArmingBooster({ groupKey: modalState.groupKey, type: modalState.type });
      setModalState(null);
    }
  };

  const handleApplyBooster = (matchId: string) => {
    if (!armingBooster || armingBooster.groupKey !== selectedGroupKey) return;

    // Find which matchday this match belongs to
    const match = matches.find(m => m.id === matchId);
    if (!match) return;

    onSetDailyBooster(challenge.id, match.day, { type: armingBooster.type, matchId });
    setArmingBooster(null);
  };

  const handleCancelBooster = () => {
    // Find the matchday with the booster
    if (!currentGroup) return;

    for (const matchday of currentGroup.matchdays) {
      const dailyEntry = userEntry.dailyEntries.find(d => d.day === matchday);
      if (dailyEntry?.booster && currentGroup.matches.some(m => m.id === dailyEntry.booster?.matchId)) {
        onSetDailyBooster(challenge.id, matchday, undefined);
        break;
      }
    }
    setArmingBooster(null);
  };

  const { rank, totalPlayers } = useMemo(() => {
    const mockDailyEntries: DailyChallengeEntry[] = [
      { day: 1, bets: [{ challengeMatchId: 'cm-new-1', prediction: 'draw', amount: 1000 }], booster: { type: 'x2', matchId: 'cm-new-1' } },
      { day: 2, bets: [{ challengeMatchId: 'cm-new-3', prediction: 'teamA', amount: 1000 }] }
    ];
    const mockEntry: UserChallengeEntry = { challengeId: challenge.id, dailyEntries: mockDailyEntries, user_id: 'mock-user', entryMethod: 'coins' };

    const otherPlayers = [
      { username: 'TopPlayer', entry: mockEntry },
      { username: 'SmartBettor', entry: { ...mockEntry, dailyEntries: [{ day: 1, bets: [{ challengeMatchId: 'cm-new-2', prediction: 'teamA', amount: 1000 }] }, { day: 2, bets: [] }] } },
    ];
    const userPoints = calculateChallengePoints(userEntry, matches);
    const allEntries: Omit<LeaderboardEntry, 'rank'>[] = [
      { username: 'You', finalCoins: 0, points: userPoints },
      ...otherPlayers.map(player => ({ username: player.username, finalCoins: 0, points: calculateChallengePoints(player.entry, matches) }))
    ];
    const sortedLeaderboard = allEntries.sort((a, b) => b.points - a.points).map((entry, index) => ({ ...entry, rank: index + 1 }));
    const userRank = sortedLeaderboard.find(e => e.username === 'You')?.rank || 0;
    return { rank: userRank, totalPlayers: challenge.totalPlayers };
  }, [userEntry, matches, challenge]);

  const dailyBalance = 1000;

  const formatNumberShort = (num: number) => {
    if (num >= 1000) return `${(num / 1000).toFixed(1)}k`;
    return num.toString();
  };

  const { points, pointsLabel } = useMemo(() => {
    if (!currentGroup) return { points: 0, pointsLabel: 'Potential Points' };

    const groupMatches = currentGroup.matches;
    const isDayFinished = groupMatches.every(m => m.status === 'played');

    if (isDayFinished) {
      let finalPoints = 0;
      groupBets.forEach(bet => {
        const match = groupMatches.find(m => m.id === bet.challengeMatchId);
        if (match && match.result) {
          if (match.result === bet.prediction) {
            let gain = (bet.amount * match.odds[bet.prediction]);
            if (groupBooster?.matchId === bet.challengeMatchId) {
              if (groupBooster.type === 'x2') gain *= 2;
              if (groupBooster.type === 'x3') gain *= 3;
            }
            finalPoints += gain;
          } else {
            if (groupBooster?.matchId === bet.challengeMatchId && groupBooster.type === 'x3') {
              finalPoints -= 200;
            }
          }
        }
      });
      return { points: Math.round(finalPoints), pointsLabel: 'Final Points' };
    } else {
      const potentialPoints = groupBets.reduce((total, bet) => {
        const match = groupMatches.find(m => m.id === bet.challengeMatchId);
        if (match) {
          total += (bet.amount * match.odds[bet.prediction]);
        }
        return total;
      }, 0);
      return { points: Math.round(potentialPoints), pointsLabel: 'Potential Points' };
    }
  }, [currentGroup, groupBets, groupBooster]);


  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-text-secondary font-semibold hover:text-electric-blue">
        <ArrowLeft size={20} /> Back to Games
      </button>

      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-text-primary">{challenge.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <LinkGameButton
            game={challenge}
            userId={profile.id}
            userLeagues={userLeagues}
            leagueMembers={leagueMembers}
            leagueGames={leagueGames}
            onLink={onLinkGame}
            loading={false}
          />
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue">
            <ScrollText size={20} />
          </button>
          <button onClick={() => onViewLeaderboard(challenge.id)} className="flex items-center gap-1.5 p-2 bg-navy-accent rounded-lg shadow-sm text-text-secondary hover:text-electric-blue">
            <Trophy size={20} />
            <span className="text-xs font-bold">{formatNumberShort(rank)}/{formatNumberShort(totalPlayers)}</span>
          </button>
        </div>
      </div>

      <div className="-mx-4">
        <MatchDaySwitcher
          gameWeeks={matchDaysForSwitcher}
          selectedGameWeekId={selectedGroupKey}
          onSelect={(id) => setSelectedGroupKey(id)}
        />
      </div>

      <div className="card-base p-4 text-center animate-scale-in">
        <p className="text-sm font-semibold text-text-secondary">{pointsLabel}</p>
        <p className={`text-3xl font-bold ${points >= 0 ? 'text-lime-glow' : 'text-hot-red'}`}>
            {points >= 0 ? `+${points.toLocaleString()}` : points.toLocaleString()}
        </p>
      </div>

      {betsLocked && (
        <div className="bg-warm-yellow/10 border-l-4 border-warm-yellow text-warm-yellow p-4 rounded-r-lg">
          <div className="flex">
            <div className="py-1"><ShieldAlert size={20} className="mr-3" /></div>
            <div>
              <p className="font-bold">Bets are Locked</p>
              <p className="text-sm">This challenge has started. You can no longer place or modify bets.</p>
            </div>
          </div>
        </div>
      )}

      {currentGroup && (
        <div className="space-y-6">
          <div className="card-base p-4 space-y-4 animate-scale-in">
            <div className="flex justify-between items-center border-b border-white/10 pb-3">
              <div className="flex items-baseline gap-3">
                {!betsLocked && <BoosterSelector
                  day={currentGroup.matchdays[0] || 1}
                  activeBooster={groupBooster}
                  armingBoosterType={armingBooster?.groupKey === selectedGroupKey ? armingBooster.type : undefined}
                  onBoosterClick={(type) => handleBoosterClick(type)}
                  onCancel={() => handleCancelBooster()}
                />}
              </div>
              <div className="flex items-center gap-2 bg-deep-navy px-3 py-1.5 rounded-lg">
                <Coins size={16} className="text-warm-yellow" />
                <span className="font-bold text-text-primary">{remainingGroupBalance.toLocaleString()}</span>
                <span className="text-xs text-text-disabled">left</span>
              </div>
            </div>

            {armingBooster?.groupKey === selectedGroupKey && !groupBooster && (
              <div className="bg-warm-yellow/10 border border-warm-yellow/20 p-3 rounded-lg text-center">
                <p className="text-sm font-semibold text-warm-yellow">
                  Select a match below to apply the <span className="font-bold">{armingBooster.type.toUpperCase()}</span> booster.
                </p>
              </div>
            )}

            <div className="space-y-3">
              {currentGroup.matches.map(match => {
                const bet = groupBets.find(b => b.challengeMatchId === match.id);
                return (
                  <ChallengeBetController
                    key={match.id}
                    match={match}
                    bet={bet}
                    onBetChange={(pred, amount) => handleBetChange(match.id, pred, amount)}
                    disabled={isMatchLocked(match)}
                    maxAmount={remainingGroupBalance + (bet?.amount || 0)}
                    isBoosterArmed={armingBooster?.groupKey === selectedGroupKey && !groupBooster}
                    onApplyBooster={() => handleApplyBooster(match.id)}
                    isBoosted={groupBooster?.matchId === match.id}
                    boosterType={groupBooster?.matchId === match.id ? groupBooster.type : undefined}
                    profile={profile}
                  />
                );
              })}
            </div>
          </div>
        </div>
      )}

      {modalState && (
        <BoosterInfoModal
          boosterType={modalState.type}
          isOpen={!!modalState}
          onClose={() => setModalState(null)}
          onActivate={handleActivateBoosterFromModal}
          onSetDontShowAgain={() => onUpdateBoosterPreferences(modalState.type)}
        />
      )}
      <RulesModal isOpen={isRulesModalOpen} onClose={() => setIsRulesModalOpen(false)} />
    </div>
  );
};

export default ChallengeRoomPage;
