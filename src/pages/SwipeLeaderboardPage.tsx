import React, { useMemo } from "react";
import { SwipeMatchDay, UserSwipeEntry, SwipeLeaderboardEntry } from "../types";
import { ArrowLeft, Trophy, Medal, Award } from "lucide-react";

interface SwipeLeaderboardPageProps {
  matchDay: SwipeMatchDay;
  userEntry: UserSwipeEntry;
  onBack: () => void;
}

const calculateSwipePoints = (
  entry: UserSwipeEntry,
  matchDay: SwipeMatchDay,
): number => {
  let totalPoints = 0;
  entry.predictions.forEach((prediction) => {
    const match = matchDay.matches.find((m) => m.id === prediction.matchId);
    if (match && match.result && match.result === prediction.prediction) {
      totalPoints += match.odds[prediction.prediction] * 100;
    }
  });
  return Math.round(totalPoints);
};

const getRankIcon = (rank: number) => {
  if (rank === 1) return <Trophy size={20} className="text-yellow-500" />;
  if (rank === 2) return <Medal size={20} className="text-gray-400" />;
  if (rank === 3) return <Award size={20} className="text-orange-400" />;
  return (
    <span className="font-bold text-gray-500 w-5 text-center">{rank}</span>
  );
};

const SwipeLeaderboardPage: React.FC<SwipeLeaderboardPageProps> = ({
  matchDay,
  userEntry,
  onBack,
}) => {
  const leaderboard = useMemo(() => {
    // Mock other players for leaderboard generation
    const otherPlayers = Array.from({ length: 20 }, (_, i) => ({
      username: `Player_${i + 1}`,
      entry: {
        ...userEntry,
        predictions: matchDay.matches.map((m) => ({
          matchId: m.id,
          prediction: ["teamA", "draw", "teamB"][
            Math.floor(Math.random() * 3)
          ] as "teamA" | "draw" | "teamB",
        })),
      },
    }));

    const userPoints = calculateSwipePoints(userEntry, matchDay);

    const allEntries: Omit<SwipeLeaderboardEntry, "rank">[] = [
      { username: "You", points: userPoints },
      ...otherPlayers.map((player) => ({
        username: player.username,
        points: calculateSwipePoints(player.entry, matchDay),
      })),
    ];

    return allEntries
      .sort((a, b) => b.points - a.points)
      .map((entry, index) => ({ ...entry, rank: index + 1 }));
  }, [userEntry, matchDay]);

  return (
    <div className="animate-scale-in space-y-4">
      <button
        onClick={onBack}
        className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600"
      >
        <ArrowLeft size={20} /> Back to Game
      </button>

      <div className="bg-white rounded-2xl shadow-lg p-5 space-y-4">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-purple-700">
            {matchDay.name}
          </h2>
          <p className="text-sm font-semibold text-gray-500">
            Final Leaderboard
          </p>
        </div>
        <div className="space-y-2">
          {leaderboard.map((entry) => (
            <div
              key={entry.rank}
              className={`flex items-center p-3 rounded-xl ${entry.username === "You" ? "bg-purple-50 border-2 border-purple-200" : "bg-gray-50"}`}
            >
              <div className="w-8 flex justify-center">
                {getRankIcon(entry.rank)}
              </div>
              <div className="flex-1 font-semibold text-gray-800">
                {entry.username}
              </div>
              <div className="text-right">
                <p className="font-bold text-purple-600">
                  {entry.points.toLocaleString()} pts
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default SwipeLeaderboardPage;
