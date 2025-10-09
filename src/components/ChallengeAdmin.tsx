import React, { useState } from "react";
import { v4 as uuidv4 } from "uuid";
import { Challenge, ChallengeMatch, ChallengeStatus } from "../types";
import { ChevronDown, PlusCircle, Play, Square } from "lucide-react";

interface ChallengeAdminProps {
  challenges: Challenge[];
  challengeMatches: ChallengeMatch[];
  onAddChallenge: (
    challenge: Omit<Challenge, "id" | "status" | "totalPlayers">,
  ) => void;
  onAddChallengeMatch: (
    challengeMatch: Omit<ChallengeMatch, "id" | "status" | "result">,
  ) => void;
  onResolveChallengeMatch: (
    challengeMatchId: string,
    result: "teamA" | "draw" | "teamB",
  ) => void;
  onUpdateChallengeStatus: (
    challengeId: string,
    status: ChallengeStatus,
  ) => void;
}

export const ChallengeAdmin: React.FC<ChallengeAdminProps> = ({
  challenges,
  challengeMatches,
  onAddChallenge,
  onAddChallengeMatch,
  onResolveChallengeMatch,
  onUpdateChallengeStatus,
}) => {
  const [showAddChallenge, setShowAddChallenge] = useState(false);

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <button
          onClick={() => setShowAddChallenge(!showAddChallenge)}
          className="w-full flex justify-between items-center font-bold text-lg text-purple-700"
        >
          <span>
            {showAddChallenge ? "Close Form" : "Create New Challenge"}
          </span>
          <ChevronDown
            className={`w-6 h-6 transition-transform ${showAddChallenge ? "rotate-180" : ""}`}
          />
        </button>
        {showAddChallenge && (
          <div className="mt-4">
            <ChallengeForm
              onSubmit={(data) => {
                onAddChallenge(data);
                setShowAddChallenge(false);
              }}
            />
          </div>
        )}
      </div>

      <div className="space-y-4">
        <h2 className="font-bold text-xl text-gray-700 px-2">
          Manage Challenges
        </h2>
        {challenges.map((challenge) => (
          <ChallengeAdminCard
            key={challenge.id}
            challenge={challenge}
            matches={challengeMatches.filter(
              (m) => m.challengeId === challenge.id,
            )}
            onAddMatch={onAddChallengeMatch}
            onResolveMatch={onResolveChallengeMatch}
            onUpdateStatus={onUpdateChallengeStatus}
          />
        ))}
      </div>
    </div>
  );
};

const ChallengeForm: React.FC<{
  onSubmit: (data: Omit<Challenge, "id" | "status" | "totalPlayers">) => void;
}> = ({ onSubmit }) => {
  const [formData, setFormData] = useState({
    name: "",
    startDate: "",
    endDate: "",
    entryCost: "1000",
    challengeBalance: "1000",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      entryCost: parseInt(formData.entryCost),
      challengeBalance: parseInt(formData.challengeBalance),
    });
  };

  const formField =
    "w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <input
        type="text"
        name="name"
        placeholder="Challenge Name"
        onChange={handleChange}
        className={formField}
        required
      />
      <div className="grid grid-cols-2 gap-4">
        <input
          type="date"
          name="startDate"
          onChange={handleChange}
          className={formField}
          required
        />
        <input
          type="date"
          name="endDate"
          onChange={handleChange}
          className={formField}
          required
        />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input
          type="number"
          name="entryCost"
          placeholder="Entry Cost"
          onChange={handleChange}
          className={formField}
          required
        />
        <input
          type="number"
          name="challengeBalance"
          placeholder="Challenge Balance"
          onChange={handleChange}
          className={formField}
          required
        />
      </div>
      <button
        type="submit"
        className="w-full py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl"
      >
        Create Challenge
      </button>
    </form>
  );
};

const ChallengeAdminCard: React.FC<{
  challenge: Challenge;
  matches: ChallengeMatch[];
  onAddMatch: (match: Omit<ChallengeMatch, "id" | "status" | "result">) => void;
  onResolveMatch: (matchId: string, result: "teamA" | "draw" | "teamB") => void;
  onUpdateStatus: (challengeId: string, status: ChallengeStatus) => void;
}> = ({ challenge, matches, onAddMatch, onResolveMatch, onUpdateStatus }) => {
  const [showAddMatch, setShowAddMatch] = useState(false);

  const statusColors = {
    Upcoming: "bg-blue-100 text-blue-800",
    Ongoing: "bg-green-100 text-green-800",
    Finished: "bg-gray-200 text-gray-700",
  };

  return (
    <div className="bg-white rounded-2xl shadow-lg p-4 space-y-3">
      <div className="flex justify-between items-start">
        <div>
          <h3 className="font-bold text-gray-800">{challenge.name}</h3>
          <div className="flex items-center gap-2 mt-2">
            {challenge.status === "Upcoming" && (
              <button
                onClick={() => onUpdateStatus(challenge.id, "Ongoing")}
                className="flex items-center gap-1 text-xs font-semibold bg-green-100 text-green-700 px-2 py-1 rounded-md hover:bg-green-200"
              >
                <Play size={12} /> Start
              </button>
            )}
            {challenge.status === "Ongoing" && (
              <button
                onClick={() => onUpdateStatus(challenge.id, "Finished")}
                className="flex items-center gap-1 text-xs font-semibold bg-red-100 text-red-700 px-2 py-1 rounded-md hover:bg-red-200"
              >
                <Square size={12} /> End
              </button>
            )}
          </div>
        </div>
        <span
          className={`text-xs font-bold px-2 py-1 rounded-full self-start ${statusColors[challenge.status]}`}
        >
          {challenge.status}
        </span>
      </div>
      <div className="space-y-2 border-t pt-3">
        <h4 className="text-sm font-semibold text-gray-600">Matches</h4>
        {matches.map((match) => (
          <ChallengeMatchAdminItem
            key={match.id}
            match={match}
            onResolve={onResolveMatch}
          />
        ))}
      </div>
      {showAddMatch ? (
        <ChallengeMatchForm
          challengeId={challenge.id}
          onSubmit={onAddMatch}
          onCancel={() => setShowAddMatch(false)}
        />
      ) : (
        <button
          onClick={() => setShowAddMatch(true)}
          className="w-full flex items-center justify-center gap-2 text-sm p-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-semibold"
        >
          <PlusCircle size={16} /> Add Match
        </button>
      )}
    </div>
  );
};

const ChallengeMatchAdminItem: React.FC<{
  match: ChallengeMatch;
  onResolve: (id: string, res: "teamA" | "draw" | "teamB") => void;
}> = ({ match, onResolve }) => {
  return (
    <div className="bg-gray-50 p-3 rounded-lg">
      <p className="text-sm font-semibold">
        {match.teamA.name} vs {match.teamB.name} (Day {match.day})
      </p>
      {match.status === "upcoming" ? (
        <div className="grid grid-cols-3 gap-1 mt-2">
          <button
            onClick={() => onResolve(match.id, "teamA")}
            className="text-xs p-1 bg-blue-100 text-blue-800 rounded hover:bg-blue-200"
          >
            A Wins
          </button>
          <button
            onClick={() => onResolve(match.id, "draw")}
            className="text-xs p-1 bg-yellow-100 text-yellow-800 rounded hover:bg-yellow-200"
          >
            Draw
          </button>
          <button
            onClick={() => onResolve(match.id, "teamB")}
            className="text-xs p-1 bg-red-100 text-red-800 rounded hover:bg-red-200"
          >
            B Wins
          </button>
        </div>
      ) : (
        <p className="text-xs font-bold text-green-600 mt-1">
          Result: {match.result}
        </p>
      )}
    </div>
  );
};

const ChallengeMatchForm: React.FC<{
  challengeId: string;
  onSubmit: (data: Omit<ChallengeMatch, "id" | "status" | "result">) => void;
  onCancel: () => void;
}> = ({ challengeId, onSubmit, onCancel }) => {
  const [data, setData] = useState({
    day: 1,
    teamA_name: "",
    teamA_emoji: "",
    teamB_name: "",
    teamB_emoji: "",
    odds_teamA: "2.0",
    odds_draw: "3.0",
    odds_teamB: "2.5",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setData({ ...data, [e.target.name]: e.target.value });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      challengeId,
      day: Number(data.day),
      teamA: { name: data.teamA_name, emoji: data.teamA_emoji },
      teamB: { name: data.teamB_name, emoji: data.teamB_emoji },
      odds: {
        teamA: parseFloat(data.odds_teamA),
        draw: parseFloat(data.odds_draw),
        teamB: parseFloat(data.odds_teamB),
      },
    });
    onCancel();
  };

  const formField = "w-full p-2 border border-gray-300 rounded-md text-sm";

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-gray-100 p-3 rounded-lg space-y-2 mt-2"
    >
      <input
        type="number"
        name="day"
        value={data.day}
        onChange={handleChange}
        placeholder="Day"
        className={formField}
      />
      <div className="grid grid-cols-2 gap-2">
        <input
          name="teamA_name"
          onChange={handleChange}
          placeholder="Team A Name"
          className={formField}
        />
        <input
          name="teamA_emoji"
          onChange={handleChange}
          placeholder="Team A Emoji"
          className={formField}
        />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <input
          name="teamB_name"
          onChange={handleChange}
          placeholder="Team B Name"
          className={formField}
        />
        <input
          name="teamB_emoji"
          onChange={handleChange}
          placeholder="Team B Emoji"
          className={formField}
        />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <input
          name="odds_teamA"
          value={data.odds_teamA}
          onChange={handleChange}
          placeholder="Odds A"
          className={formField}
        />
        <input
          name="odds_draw"
          value={data.odds_draw}
          onChange={handleChange}
          placeholder="Odds Draw"
          className={formField}
        />
        <input
          name="odds_teamB"
          value={data.odds_teamB}
          onChange={handleChange}
          placeholder="Odds B"
          className={formField}
        />
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 text-sm py-2 bg-gray-300 rounded-lg"
        >
          Cancel
        </button>
        <button
          type="submit"
          className="flex-1 text-sm py-2 bg-purple-600 text-white rounded-lg"
        >
          Add
        </button>
      </div>
    </form>
  );
};
