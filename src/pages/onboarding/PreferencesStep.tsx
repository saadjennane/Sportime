import React, { useState, useMemo } from 'react';
import { SearchableSelect } from '../../components/SearchableSelect';
import { mockTeams } from '../../data/mockTeams';
import { mockCountries } from '../../data/mockCountries';
import { Loader2 } from 'lucide-react';

interface PreferencesStepProps {
  onSave: (clubId: string | null, nationalTeam: string | null) => void;
  onSkip: () => void;
  loading: boolean;
}

export const PreferencesStep: React.FC<PreferencesStepProps> = ({ onSave, onSkip, loading }) => {
  const [favoriteClub, setFavoriteClub] = useState<string | null>(null);
  const [favoriteNationalTeam, setFavoriteNationalTeam] = useState<string | null>(null);

  const clubOptions = useMemo(() => mockTeams.map(team => ({
    value: team.id,
    label: team.name,
    icon: team.logo,
  })), []);

  const countryOptions = useMemo(() => mockCountries.map(country => ({
    value: country.name,
    label: country.name,
    icon: country.flag, // Use the emoji directly
  })), []);

  const handleSave = () => {
    onSave(favoriteClub, favoriteNationalTeam);
  };

  return (
    <div className="w-full max-w-md mx-auto p-8 bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900 rounded-3xl shadow-2xl border border-purple-500/20 space-y-8 animate-scale-in">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Define your fan preferences</h1>
        <p className="text-gray-300 mt-2">Choose your favorite club and national team — or skip and do it later from your profile.</p>
      </div>

      <div className="space-y-6">
        <SearchableSelect
          label="Favorite Club"
          options={clubOptions}
          value={favoriteClub}
          onChange={setFavoriteClub}
          placeholder="Search for a club..."
        />
        <SearchableSelect
          label="Favorite National Team"
          options={countryOptions}
          value={favoriteNationalTeam}
          onChange={setFavoriteNationalTeam}
          placeholder="Search for a country..."
        />
      </div>

      <div className="space-y-3">
        <button
          onClick={handleSave}
          disabled={loading}
          className="w-full py-3.5 bg-gradient-to-r from-purple-600 to-blue-600 text-white font-bold rounded-xl shadow-lg shadow-purple-500/30 hover:from-purple-700 hover:to-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {loading ? <Loader2 className="animate-spin mx-auto" /> : 'Save & Continue'}
        </button>
        <button
          onClick={onSkip}
          disabled={loading}
          className="w-full py-3 text-sm font-semibold text-gray-400 hover:bg-gray-700/50 rounded-xl transition-colors disabled:opacity-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
};
