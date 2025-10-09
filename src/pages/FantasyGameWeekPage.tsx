import React, { useState, useMemo } from "react";
import {
  FantasyGame,
  UserFantasyTeam,
  FantasyPlayer,
  PlayerPosition,
  Booster,
} from "../types";
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Zap,
  Trophy,
  Clock,
  Check,
  X,
} from "lucide-react";
import { FantasyPlayerCard } from "../components/FantasyPlayerCard";
import { FantasyPlayerModal } from "../components/FantasyPlayerModal";
import { FantasyPointsPopup } from "../components/FantasyPointsPopup";
import { MatchDaySwitcher } from "../components/MatchDaySwitcher";
import { FantasyLeaderboardModal } from "../components/FantasyLeaderboardModal";
import {
  parseISO,
  isWithinInterval,
  differenceInYears,
  format,
} from "date-fns";
import { mockLeagues } from "../data/mockLeagues";
import { mockBoosters } from "../data/mockFantasy";
import { BoosterSelectionModal } from "../components/BoosterSelectionModal";

interface FantasyGameWeekPageProps {
  game: FantasyGame;
  userTeams: UserFantasyTeam[];
  allPlayers: FantasyPlayer[];
  onBack: () => void;
}

export const FantasyGameWeekPage: React.FC<FantasyGameWeekPageProps> = ({
  game,
  userTeams,
  allPlayers,
  onBack,
}) => {
  const activeMatchDay = useMemo(() => {
    const today = new Date();
    return (
      game.gameWeeks.find((gw) =>
        isWithinInterval(today, {
          start: parseISO(gw.startDate),
          end: parseISO(gw.endDate),
        }),
      ) ||
      game.gameWeeks.find((gw) => gw.status === "upcoming") ||
      game.gameWeeks[0]
    );
  }, [game.gameWeeks]);

  const [selectedMatchDayId, setSelectedMatchDayId] = useState(
    activeMatchDay.id,
  );
  const [editingPosition, setEditingPosition] = useState<PlayerPosition | null>(
    null,
  );
  const [viewingPlayer, setViewingPlayer] = useState<FantasyPlayer | null>(
    null,
  );
  const [isLeaderboardOpen, setIsLeaderboardOpen] = useState(false);
  const [isBoosterModalOpen, setIsBoosterModalOpen] = useState(false);

  // Booster state
  const [boosters, setBoosters] = useState<Booster[]>(mockBoosters);
  const [selectedBoosterId, setSelectedBoosterId] = useState<number | null>(
    null,
  );

  const selectedGameWeek = useMemo(
    () => game.gameWeeks.find((gw) => gw.id === selectedMatchDayId)!,
    [game.gameWeeks, selectedMatchDayId],
  );

  const userTeam = useMemo(() => {
    return userTeams.find((t) => t.gameWeekId === selectedGameWeek.id);
  }, [userTeams, selectedGameWeek.id]);

  const starters = useMemo(
    () =>
      (userTeam?.starters
        .map((id) => allPlayers.find((p) => p.id === id))
        .filter(Boolean) as FantasyPlayer[]) || [],
    [userTeam, allPlayers],
  );

  const isEditable =
    selectedGameWeek.id === activeMatchDay.id &&
    activeMatchDay.status === "upcoming";
  const isLive = selectedGameWeek.status === "live";

  const deadline = useMemo(() => {
    if (!selectedGameWeek) return null;
    const deadlineDate = parseISO(selectedGameWeek.startDate);
    return format(deadlineDate, "MMM d, yyyy 'at' h:mm a");
  }, [selectedGameWeek]);

  const handleSelectBooster = (booster: Booster) => {
    setSelectedBoosterId(booster.id);
  };

  const handleCancelBooster = () => {
    setSelectedBoosterId(null);
  };

  const handleConfirmTeam = () => {
    if (selectedBoosterId) {
      // Logic to "use" the booster
      setBoosters((prev) =>
        prev.map((b) =>
          b.id === selectedBoosterId ? { ...b, used: true } : b,
        ),
      );
    }
    // Add other confirmation logic here...
    alert("Team Confirmed!");
  };

  const availableBoosters = boosters.filter((b) => !b.used);
  const boostersLeft = availableBoosters.length;
  const selectedBooster = boosters.find((b) => b.id === selectedBoosterId);

  const renderPitch = () => {
    const positions: Record<PlayerPosition, FantasyPlayer[]> = {
      Goalkeeper: [],
      Defender: [],
      Midfielder: [],
      Attacker: [],
    };
    starters.forEach((player) => positions[player.position].push(player));

    return (
      <div className="bg-green-600/80 rounded-2xl p-4 space-y-4 bg-[url('https://www.transparenttextures.com/patterns/grass.png')]">
        {["Attacker", "Midfielder", "Defender", "Goalkeeper"].map((pos) => (
          <div key={pos} className="flex justify-around items-center">
            {positions[pos as PlayerPosition].map((player) => (
              <FantasyPlayerCard
                key={player.id}
                player={player}
                isCaptain={player.id === userTeam?.captainId}
                onClick={() =>
                  isLive
                    ? setViewingPlayer(player)
                    : isEditable
                      ? setEditingPosition(player.position)
                      : null
                }
                isLive={isLive || selectedGameWeek.status === "finished"}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  const selectedLeagues = mockLeagues.filter((l) =>
    selectedGameWeek.leagues.includes(l.name),
  );

  return (
    <div className="space-y-4 pb-24">
      <div className="flex justify-between items-center">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-gray-600 font-semibold hover:text-purple-600"
        >
          <ArrowLeft size={20} /> Back
        </button>
        <button
          onClick={() => setIsLeaderboardOpen(true)}
          className="p-2 text-gray-600 hover:text-purple-600"
        >
          <Trophy size={24} />
        </button>
      </div>

      <div className="text-center">
        <h2 className="text-2xl font-bold text-gray-800">{game.name}</h2>
        <div className="flex justify-center items-center gap-2 mt-2">
          {selectedLeagues.map((league) => (
            <img
              key={league.id}
              src={league.logo}
              alt={league.name}
              className="w-6 h-6"
              title={league.name}
            />
          ))}
        </div>
      </div>

      <div className="-mx-4">
        <MatchDaySwitcher
          matchDays={game.gameWeeks}
          selectedMatchDayId={selectedMatchDayId}
          onSelect={setSelectedMatchDayId}
        />
      </div>

      {deadline && (
        <div
          className={`text-center text-xs font-semibold p-2 rounded-lg ${isEditable ? "bg-yellow-100 text-yellow-800" : "bg-red-100 text-red-800"}`}
        >
          {isEditable
            ? `You can edit your team until ${deadline}`
            : "Team locked — Matches have started"}
        </div>
      )}

      {renderPitch()}

      <div className="bg-white rounded-2xl shadow-lg p-4">
        <h4 className="font-semibold text-sm mb-2">Bench</h4>
        <div className="flex justify-around items-center">
          {userTeam?.substitutes.map((playerId) => {
            const player = allPlayers.find((p) => p.id === playerId);
            if (!player) return null;
            return (
              <FantasyPlayerCard
                key={player.id}
                player={player}
                isCaptain={false}
                onClick={() =>
                  isLive
                    ? setViewingPlayer(player)
                    : isEditable
                      ? setEditingPosition(player.position)
                      : null
                }
                isLive={isLive || selectedGameWeek.status === "finished"}
              />
            );
          })}
        </div>
      </div>

      {editingPosition && (
        <FantasyPlayerModal
          isOpen={!!editingPosition}
          onClose={() => setEditingPosition(null)}
          position={editingPosition}
          allPlayers={allPlayers}
          onSelectPlayer={() => {}}
        />
      )}
      {viewingPlayer && (
        <FantasyPointsPopup
          player={viewingPlayer}
          onClose={() => setViewingPlayer(null)}
        />
      )}

      <FantasyLeaderboardModal
        isOpen={isLeaderboardOpen}
        onClose={() => setIsLeaderboardOpen(false)}
        gameWeekName={selectedGameWeek.name}
      />

      <BoosterSelectionModal
        isOpen={isBoosterModalOpen}
        onClose={() => setIsBoosterModalOpen(false)}
        boosters={boosters}
        onSelect={handleSelectBooster}
      />

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 max-w-md mx-auto bg-white/80 backdrop-blur-lg p-3 border-t border-gray-200">
        <div className="flex gap-3">
          <button
            onClick={() => setIsBoosterModalOpen(true)}
            disabled={!isEditable || boostersLeft === 0}
            className={`flex-1 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all ${
              !isEditable || boostersLeft === 0
                ? "bg-gray-200 text-gray-500 cursor-not-allowed"
                : selectedBooster
                  ? "bg-gradient-to-r from-yellow-400 to-orange-500 text-white"
                  : "bg-gradient-to-r from-purple-500 to-yellow-400 text-white"
            }`}
          >
            {selectedBooster ? (
              <>
                {selectedBooster.icon}
                <span>{selectedBooster.name}</span>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleCancelBooster();
                  }}
                  className="ml-1 text-white/80 hover:text-white"
                >
                  <X size={14} />
                </button>
              </>
            ) : (
              <>
                <Zap size={16} />
                <span>Booster ({boostersLeft})</span>
              </>
            )}
          </button>
          <button
            onClick={handleConfirmTeam}
            disabled={!isEditable}
            className="flex-1 flex items-center justify-center gap-2 font-semibold py-3 rounded-xl shadow-lg transition-all bg-gradient-to-r from-purple-600 to-blue-600 text-white disabled:bg-gray-200 disabled:text-gray-500 disabled:from-gray-200 disabled:to-gray-300"
          >
            <Check size={18} />
            Confirm Team
          </button>
        </div>
      </div>
    </div>
  );
};
