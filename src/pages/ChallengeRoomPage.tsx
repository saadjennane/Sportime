import React, { useState, useMemo } from 'react';
import { Challenge, ChallengeMatch, UserChallengeEntry, ChallengeBet, BoosterSelection, DailyChallengeEntry, LeaderboardEntry } from '../types';
import { ArrowLeft, Coins, ShieldAlert, Trophy, ScrollText } from 'lucide-react';
import { ChallengeBetController } from '../components/ChallengeBetController';
import { BoosterSelector } from '../components/BoosterSelector';
import { BoosterInfoModal } from '../components/BoosterInfoModal';
import { MatchDaySwitcher } from '../components/fantasy/MatchDaySwitcher';
import { addDays, parseISO, isBefore } from 'date-fns';
import { RulesModal } from '../components/RulesModal';

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
        let profit = (bet.amount * match.odds[bet.prediction]) - bet.amount;
        if (isBoosted) {
          if (booster?.type === 'x2') profit *= 2;
          else if (booster?.type === 'x3') profit *= 3;
        }
        totalPoints += profit;
      } else if (isBoosted && booster?.type === 'x3') {
        totalPoints -= 200;
      }
    });
  });
  return Math.round(totalPoints);
};

const ChallengeRoomPage: React.FC<ChallengeRoomPageProps> = ({ challenge, matches, userEntry, onUpdateDailyBets, onSetDailyBooster, onBack, onViewLeaderboard, boosterInfoPreferences, onUpdateBoosterPreferences }) => {
  const betsLocked = challenge.status === 'Ongoing' || challenge.status === 'Finished';

  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const challengeStartDate = parseISO(challenge.startDate);

    for (const dailyEntry of userEntry.dailyEntries) {
        const dayDate = addDays(challengeStartDate, dailyEntry.day - 1);
        if (!isBefore(dayDate, today)) {
            return dailyEntry.day;
        }
    }
    return userEntry.dailyEntries[userEntry.dailyEntries.length - 1]?.day || 1;
  });

  const [armingBooster, setArmingBooster] = useState<{ day: number, type: 'x2' | 'x3' } | null>(null);
  const [modalState, setModalState] = useState<{ day: number, type: 'x2' | 'x3' } | null>(null);
  const [isRulesModalOpen, setIsRulesModalOpen] = useState(false);

  const matchDaysForSwitcher = useMemo(() => {
    return userEntry.dailyEntries.map(dailyEntry => {
      const date = addDays(parseISO(challenge.startDate), dailyEntry.day - 1);
      return {
        id: dailyEntry.day.toString(),
        name: `Day ${dailyEntry.day}`,
        startDate: date.toISOString(),
        endDate: date.toISOString(),
        leagues: [],
        status: challenge.status,
      };
    });
  }, [userEntry.dailyEntries, challenge.startDate, challenge.status]);

  const handleBetChange = (day: number, matchId: string, prediction: 'teamA' | 'draw' | 'teamB' | null, amount: number) => {
    const dailyEntry = userEntry.dailyEntries.find(d => d.day === day);
    if (!dailyEntry) return;

    const otherBets = dailyEntry.bets.filter(b => b.challengeMatchId !== matchId);
    let newBets: ChallengeBet[];
    if (prediction === null) {
      newBets = otherBets;
    } else {
      newBets = [...otherBets, { challengeMatchId: matchId, prediction, amount }];
    }
    onUpdateDailyBets(challenge.id, day, newBets);
  };

  const handleBoosterClick = (day: number, type: 'x2' | 'x3') => {
    const dailyEntry = userEntry.dailyEntries.find(d => d.day === day);
    if (!dailyEntry || dailyEntry.booster) return;

    if (armingBooster?.day === day && armingBooster?.type === type) {
      setArmingBooster(null);
      return;
    }

    if (!boosterInfoPreferences[type]) {
      setModalState({ day, type });
    } else {
      setArmingBooster({ day, type });
    }
  };

  const handleActivateBoosterFromModal = () => {
    if (modalState) {
      setArmingBooster({ day: modalState.day, type: modalState.type });
      setModalState(null);
    }
  };

  const handleApplyBooster = (day: number, matchId: string) => {
    if (!armingBooster || armingBooster.day !== day) return;
    onSetDailyBooster(challenge.id, day, { type: armingBooster.type, matchId });
    setArmingBooster(null);
  };

  const handleCancelBooster = (day: number) => {
    onSetDailyBooster(challenge.id, day, undefined);
    setArmingBooster(null);
  };

  const { rank, totalPlayers } = useMemo(() => {
    const mockDailyEntries: DailyChallengeEntry[] = [
      { day: 1, bets: [{ challengeMatchId: 'cm-new-1', prediction: 'draw', amount: 1000 }], booster: { type: 'x2', matchId: 'cm-new-1' } },
      { day: 2, bets: [{ challengeMatchId: 'cm-new-3', prediction: 'teamA', amount: 1000 }] }
    ];
    const mockEntry: UserChallengeEntry = { challengeId: challenge.id, dailyEntries: mockDailyEntries };

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
    const dayEntry = userEntry.dailyEntries.find(d => d.day === selectedDay);
    if (!dayEntry) return { points: 0, pointsLabel: 'Potential Points' };

    const dayMatches = matches.filter(m => m.day === selectedDay);
    const isDayFinished = dayMatches.every(m => m.status === 'played');

    if (isDayFinished) {
        let finalPoints = 0;
        dayEntry.bets.forEach(bet => {
            const match = dayMatches.find(m => m.id === bet.challengeMatchId);
            if (match && match.result) {
                if (match.result === bet.prediction) {
                    let profit = (bet.amount * match.odds[bet.prediction]) - bet.amount;
                    if (dayEntry.booster?.matchId === bet.challengeMatchId) {
                        if (dayEntry.booster.type === 'x2') profit *= 2;
                        if (dayEntry.booster.type === 'x3') profit *= 3;
                    }
                    finalPoints += profit;
                } else {
                    if (dayEntry.booster?.matchId === bet.challengeMatchId && dayEntry.booster.type === 'x3') {
                        finalPoints -= 200;
                    }
                }
            }
        });
        return { points: Math.round(finalPoints), pointsLabel: 'Final Points' };
    } else {
        const potentialPoints = dayEntry.bets.reduce((total, bet) => {
            const match = dayMatches.find(m => m.id === bet.challengeMatchId);
            if (match) {
                total += (bet.amount * match.odds[bet.prediction]) - bet.amount;
            }
            return total;
        }, 0);
        return { points: Math.round(potentialPoints), pointsLabel: 'Potential Points' };
    }
  }, [userEntry, selectedDay, matches]);


  return (
    <div className="space-y-6">
      <button onClick={onBack} className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600">
        <ArrowLeft size={20} /> Back to Challenges
      </button>

      <div className="flex justify-between items-start">
        <div>
            <h2 className="text-2xl font-bold text-gray-800">{challenge.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setIsRulesModalOpen(true)} className="p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <ScrollText size={20} />
          </button>
          <button onClick={() => onViewLeaderboard(challenge.id)} className="flex items-center gap-1.5 p-2 bg-white rounded-lg shadow-sm text-gray-600 hover:text-purple-600">
            <Trophy size={20} />
            <span className="text-xs font-bold">{formatNumberShort(rank)}/{formatNumberShort(totalPlayers)}</span>
          </button>
        </div>
      </div>

      <div className="-mx-4">
        <MatchDaySwitcher
          gameWeeks={matchDaysForSwitcher}
          selectedGameWeekId={selectedDay.toString()}
          onSelect={(id) => setSelectedDay(Number(id))}
        />
      </div>

      <div className="bg-white rounded-2xl shadow-lg p-4 text-center animate-scale-in">
        <p className="text-sm font-semibold text-gray-500">{pointsLabel}</p>
        <p className={`text-3xl font-bold ${points >= 0 ? 'text-purple-700' : 'text-red-600'}`}>
            {points >= 0 ? `+${points.toLocaleString()}` : points.toLocaleString()}
        </p>
      </div>

      {betsLocked && (
        <div className="bg-yellow-100 border-l-4 border-yellow-500 text-yellow-700 p-4 rounded-r-lg">
          <div className="flex">
            <div className="py-1"><ShieldAlert size={20} className="mr-3" /></div>
            <div>
              <p className="font-bold">Bets are Locked</p>
              <p className="text-sm">This challenge has started. You can no longer place or modify bets.</p>
            </div>
          </div>
        </div>
      )}

      <div className="space-y-6">
        {userEntry.dailyEntries
          .filter(d => d.day === selectedDay)
          .map(dailyEntry => {
          const dayMatches = matches.filter(m => m.day === dailyEntry.day);
          const totalBetOnDay = dailyEntry.bets.reduce((sum, b) => sum + b.amount, 0);
          const remainingDayBalance = dailyBalance - totalBetOnDay;

          return (
            <div key={dailyEntry.day} className="bg-white rounded-2xl shadow-lg p-4 space-y-4 animate-scale-in">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <div className="flex items-baseline gap-3">
                  {!betsLocked && <BoosterSelector
                    day={dailyEntry.day}
                    activeBooster={dailyEntry.booster}
                    armingBoosterType={armingBooster?.day === dailyEntry.day ? armingBooster.type : undefined}
                    onBoosterClick={(type) => handleBoosterClick(dailyEntry.day, type)}
                    onCancel={() => handleCancelBooster(dailyEntry.day)}
                  />}
                </div>
                <div className="flex items-center gap-2 bg-purple-50 px-3 py-1.5 rounded-lg">
                  <Coins size={16} className="text-purple-600" />
                  <span className="font-bold text-purple-700">{remainingDayBalance.toLocaleString()}</span>
                  <span className="text-xs text-purple-500">left</span>
                </div>
              </div>
              
              {armingBooster?.day === dailyEntry.day && !dailyEntry.booster && (
                <div className="bg-yellow-100 border border-yellow-300 p-3 rounded-lg text-center">
                  <p className="text-sm font-semibold text-yellow-800">
                    Select a match below to apply the <span className="font-bold">{armingBooster.type.toUpperCase()}</span> booster.
                  </p>
                </div>
              )}

              <div className="space-y-3">
                {dayMatches.map(match => {
                  const bet = dailyEntry.bets.find(b => b.challengeMatchId === match.id);
                  return (
                    <ChallengeBetController
                      key={match.id}
                      match={match}
                      bet={bet}
                      onBetChange={(pred, amount) => handleBetChange(dailyEntry.day, match.id, pred, amount)}
                      disabled={betsLocked}
                      maxAmount={remainingDayBalance + (bet?.amount || 0)}
                      isBoosterArmed={armingBooster?.day === dailyEntry.day && !dailyEntry.booster}
                      onApplyBooster={() => handleApplyBooster(dailyEntry.day, match.id)}
                      isBoosted={dailyEntry.booster?.matchId === match.id}
                      boosterType={dailyEntry.booster?.matchId === match.id ? dailyEntry.booster.type : undefined}
                    />
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

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
