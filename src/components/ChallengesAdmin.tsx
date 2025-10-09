import React, { useState, useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { ChevronDown, Plus, Edit, Trash2, Play, Square } from "lucide-react";

type Challenge = any; // Using 'any' for now as the type definition is complex

interface ChallengesAdminProps {
  addToast: (message: string, type: "success" | "error" | "info") => void;
}

const GAME_TYPES = ["betting", "prediction", "fantasy", "quiz"];
const FORMATS = ["leaderboard", "championship", "elimination"];
const SPORTS = ["football", "basketball", "tennis", "f1", "nba"];
const STATUSES = ["upcoming", "active", "finished"];

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = ({
  addToast,
}) => {
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [leagues, setLeagues] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);
  const [editingChallenge, setEditingChallenge] = useState<Challenge | null>(
    null,
  );
  const [isFormOpen, setIsFormOpen] = useState(false);

  useEffect(() => {
    fetchChallenges();
    fetchLeagues();
    fetchMatches();
  }, []);

  const fetchChallenges = async () => {
    const { data, error } = await supabase
      .from("challenges")
      .select("*, challenge_leagues(league_id), challenge_matches(match_id)");
    if (error) addToast("Error fetching challenges", "error");
    else setChallenges(data || []);
  };

  const fetchLeagues = async () => {
    const { data, error } = await supabase.from("leagues").select("id, name");
    if (error) addToast("Error fetching leagues", "error");
    else setLeagues(data || []);
  };

  const fetchMatches = async () => {
    // This could be a very large table, so consider pagination or filtering in a real app
    const { data, error } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id"); // Simplified for display
    if (error) addToast("Error fetching matches", "error");
    else setMatches(data || []);
  };

  const handleFormSubmit = async (formData: any) => {
    const { selectedLeagues, selectedMatches, ...challengeData } = formData;

    // Upsert challenge
    const { data: savedChallenge, error: challengeError } = await supabase
      .from("challenges")
      .upsert(challengeData)
      .select()
      .single();
    if (challengeError || !savedChallenge) {
      addToast(challengeError?.message || "Failed to save challenge", "error");
      return;
    }

    // Handle leagues
    await supabase
      .from("challenge_leagues")
      .delete()
      .eq("challenge_id", savedChallenge.id);
    if (selectedLeagues?.length > 0) {
      const leagueLinks = selectedLeagues.map((league_id: string) => ({
        challenge_id: savedChallenge.id,
        league_id,
      }));
      const { error: leagueError } = await supabase
        .from("challenge_leagues")
        .insert(leagueLinks);
      if (leagueError) addToast("Failed to link leagues", "error");
    }

    // Handle matches
    await supabase
      .from("challenge_matches")
      .delete()
      .eq("challenge_id", savedChallenge.id);
    if (selectedMatches?.length > 0) {
      const matchLinks = selectedMatches.map((match_id: string) => ({
        challenge_id: savedChallenge.id,
        match_id,
      }));
      const { error: matchError } = await supabase
        .from("challenge_matches")
        .insert(matchLinks);
      if (matchError) addToast("Failed to link matches", "error");
    }

    addToast(
      `Challenge '${savedChallenge.name}' saved successfully!`,
      "success",
    );
    setIsFormOpen(false);
    setEditingChallenge(null);
    fetchChallenges();
  };

  const handleDelete = async (challengeId: string) => {
    if (
      window.confirm(
        "Are you sure you want to delete this challenge? This is irreversible.",
      )
    ) {
      // Manually delete related records first due to RLS
      await supabase
        .from("challenge_leagues")
        .delete()
        .eq("challenge_id", challengeId);
      await supabase
        .from("challenge_matches")
        .delete()
        .eq("challenge_id", challengeId);
      const { error } = await supabase
        .from("challenges")
        .delete()
        .eq("id", challengeId);
      if (error)
        addToast(`Error deleting challenge: ${error.message}`, "error");
      else {
        addToast("Challenge deleted successfully", "success");
        fetchChallenges();
      }
    }
  };

  const openForm = (challenge: Challenge | null = null) => {
    setEditingChallenge(challenge);
    setIsFormOpen(true);
  };

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-2xl shadow-lg p-5">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-lg text-purple-700">
            Manage Challenges
          </h2>
          <button
            onClick={() => openForm()}
            className="flex items-center gap-2 text-sm font-semibold bg-purple-100 text-purple-700 px-3 py-2 rounded-lg hover:bg-purple-200"
          >
            <Plus /> Add New Challenge
          </button>
        </div>
      </div>

      {isFormOpen && (
        <ChallengeForm
          challenge={editingChallenge}
          leagues={leagues}
          matches={matches}
          onSubmit={handleFormSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingChallenge(null);
          }}
        />
      )}

      <div className="space-y-4">
        {challenges.map((challenge) => (
          <div
            key={challenge.id}
            className="bg-white rounded-2xl shadow-lg p-4 space-y-3"
          >
            <div className="flex justify-between items-start">
              <h3 className="font-bold text-gray-800">{challenge.name}</h3>
              <span className="text-xs font-bold px-2 py-1 rounded-full bg-blue-100 text-blue-800">
                {challenge.status}
              </span>
            </div>
            <div className="flex gap-2 text-xs">
              <span className="font-semibold bg-gray-200 px-2 py-1 rounded">
                {challenge.game_type}
              </span>
              <span className="font-semibold bg-gray-200 px-2 py-1 rounded">
                {challenge.format}
              </span>
              <span className="font-semibold bg-gray-200 px-2 py-1 rounded">
                {challenge.sport}
              </span>
            </div>
            <div className="flex justify-end gap-2 border-t pt-3">
              <button
                onClick={() => openForm(challenge)}
                className="p-2 hover:bg-gray-100 rounded-full"
              >
                <Edit size={16} />
              </button>
              <button
                onClick={() => handleDelete(challenge.id)}
                className="p-2 hover:bg-red-100 rounded-full text-red-500"
              >
                <Trash2 size={16} />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

const ChallengeForm: React.FC<{
  challenge: Challenge | null;
  leagues: any[];
  matches: any[];
  onSubmit: (data: any) => void;
  onCancel: () => void;
}> = ({ challenge, leagues, matches, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState({
    name: challenge?.name || "",
    description: challenge?.description || "",
    game_type: challenge?.game_type || GAME_TYPES[0],
    format: challenge?.format || FORMATS[0],
    sport: challenge?.sport || SPORTS[0],
    start_date: challenge?.start_date ? challenge.start_date.split("T")[0] : "",
    end_date: challenge?.end_date ? challenge.end_date.split("T")[0] : "",
    entry_cost: challenge?.entry_cost || 0,
    status: challenge?.status || STATUSES[0],
    prizes: JSON.stringify(challenge?.prizes || {}, null, 2),
    rules: JSON.stringify(challenge?.rules || {}, null, 2),
    entry_conditions: JSON.stringify(
      challenge?.entry_conditions || {},
      null,
      2,
    ),
    selectedLeagues:
      challenge?.challenge_leagues?.map((l: any) => l.league_id) || [],
    selectedMatches:
      challenge?.challenge_matches?.map((m: any) => m.match_id) || [],
  });

  const handleChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >,
  ) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleMultiSelectChange = (
    e: React.ChangeEvent<HTMLSelectElement>,
    field: "selectedLeagues" | "selectedMatches",
  ) => {
    const options = Array.from(
      e.target.selectedOptions,
      (option) => option.value,
    );
    setFormData((prev) => ({ ...prev, [field]: options }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const submissionData = {
        ...formData,
        id: challenge?.id,
        prizes: JSON.parse(formData.prizes),
        rules: JSON.parse(formData.rules),
        entry_conditions: JSON.parse(formData.entry_conditions),
        entry_cost: Number(formData.entry_cost),
        start_date: formData.start_date
          ? new Date(formData.start_date).toISOString()
          : null,
        end_date: formData.end_date
          ? new Date(formData.end_date).toISOString()
          : null,
      };
      onSubmit(submissionData);
    } catch (error) {
      alert("Invalid JSON in one of the fields. Please check your syntax.");
    }
  };

  const formField =
    "w-full p-2 border-2 border-gray-200 rounded-xl bg-gray-50 focus:border-purple-500 focus:outline-none transition-colors";
  const jsonField = `${formField} font-mono text-xs h-24`;

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <form
        onSubmit={handleSubmit}
        className="bg-white rounded-2xl shadow-xl p-6 space-y-4 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
      >
        <h2 className="text-xl font-bold">
          {challenge ? "Edit" : "Create"} Challenge
        </h2>

        <input
          name="name"
          value={formData.name}
          onChange={handleChange}
          placeholder="Challenge Name"
          className={formField}
          required
        />
        <textarea
          name="description"
          value={formData.description}
          onChange={handleChange}
          placeholder="Description"
          className={formField}
        />

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <select
            name="game_type"
            value={formData.game_type}
            onChange={handleChange}
            className={formField}
          >
            {GAME_TYPES.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <select
            name="format"
            value={formData.format}
            onChange={handleChange}
            className={formField}
          >
            {FORMATS.map((f) => (
              <option key={f} value={f}>
                {f}
              </option>
            ))}
          </select>
          <select
            name="sport"
            value={formData.sport}
            onChange={handleChange}
            className={formField}
          >
            {SPORTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="text-xs">Start Date</label>
            <input
              type="date"
              name="start_date"
              value={formData.start_date}
              onChange={handleChange}
              className={formField}
            />
          </div>
          <div>
            <label className="text-xs">End Date</label>
            <input
              type="date"
              name="end_date"
              value={formData.end_date}
              onChange={handleChange}
              className={formField}
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <input
            type="number"
            name="entry_cost"
            value={formData.entry_cost}
            onChange={handleChange}
            placeholder="Entry Cost"
            className={formField}
          />
          <select
            name="status"
            value={formData.status}
            onChange={handleChange}
            className={formField}
          >
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-xs">Prizes (JSON)</label>
          <textarea
            name="prizes"
            value={formData.prizes}
            onChange={handleChange}
            className={jsonField}
          />
        </div>
        <div>
          <label className="text-xs">Rules (JSON)</label>
          <textarea
            name="rules"
            value={formData.rules}
            onChange={handleChange}
            className={jsonField}
          />
        </div>
        <div>
          <label className="text-xs">Entry Conditions (JSON)</label>
          <textarea
            name="entry_conditions"
            value={formData.entry_conditions}
            onChange={handleChange}
            className={jsonField}
          />
        </div>

        <div>
          <label className="text-xs">Link Leagues</label>
          <select
            multiple
            value={formData.selectedLeagues}
            onChange={(e) => handleMultiSelectChange(e, "selectedLeagues")}
            className={`${formField} h-32`}
          >
            {leagues.map((l) => (
              <option key={l.id} value={l.id}>
                {l.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="text-xs">Link Matches</label>
          <select
            multiple
            value={formData.selectedMatches}
            onChange={(e) => handleMultiSelectChange(e, "selectedMatches")}
            className={`${formField} h-32`}
          >
            {matches.map((m) => (
              <option key={m.id} value={m.id}>
                Match ID: {m.id}
              </option>
            ))}
          </select>
        </div>

        <div className="flex gap-3 pt-4">
          <button
            type="button"
            onClick={onCancel}
            className="flex-1 py-3 bg-gray-200 rounded-xl font-semibold"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-semibold"
          >
            Save Challenge
          </button>
        </div>
      </form>
    </div>
  );
};
