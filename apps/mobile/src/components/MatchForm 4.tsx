import React, { useState, useEffect } from 'react';
import { Match } from '../types';

type MatchFormData = Omit<Match, 'id' | 'status' | 'result' | 'score'>;

interface MatchFormProps {
  match?: Match;
  onSubmit: (data: MatchFormData) => void;
  onCancel: () => void;
}

export const MatchForm: React.FC<MatchFormProps> = ({ match, onSubmit, onCancel }) => {
  const [formData, setFormData] = useState<MatchFormData>({
    teamA: { name: '', emoji: '' },
    teamB: { name: '', emoji: '' },
    kickoffTime: '',
    odds: { teamA: 1, draw: 1, teamB: 1 },
  });

  useEffect(() => {
    if (match) {
      setFormData({
        teamA: match.teamA,
        teamB: match.teamB,
        kickoffTime: match.kickoffTime,
        odds: match.odds,
      });
    }
  }, [match]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const keys = name.split('.');
    
    if (keys.length === 2) {
      const [outerKey, innerKey] = keys as [keyof MatchFormData, string];
      setFormData(prev => ({
        ...prev,
        [outerKey]: {
          // @ts-ignore
          ...prev[outerKey],
          [innerKey]: outerKey === 'odds' ? parseFloat(value) : value,
        },
      }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const formField = "w-full p-3 border-2 border-gray-200 rounded-xl focus:border-purple-500 focus:outline-none transition-colors";

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <input type="text" name="teamA.name" value={formData.teamA.name} onChange={handleChange} placeholder="Team A Name" className={formField} required />
        <input type="text" name="teamA.emoji" value={formData.teamA.emoji} onChange={handleChange} placeholder="Team A Emoji" className={formField} required />
      </div>
      <div className="grid grid-cols-2 gap-4">
        <input type="text" name="teamB.name" value={formData.teamB.name} onChange={handleChange} placeholder="Team B Name" className={formField} required />
        <input type="text" name="teamB.emoji" value={formData.teamB.emoji} onChange={handleChange} placeholder="Team B Emoji" className={formField} required />
      </div>
      <input type="text" name="kickoffTime" value={formData.kickoffTime} onChange={handleChange} placeholder="Kickoff Time (e.g., 19:45)" className={formField} required />
      
      <div>
        <label className="block text-sm font-semibold text-gray-700 mb-2">Odds</label>
        <div className="grid grid-cols-3 gap-2">
          <input type="number" name="odds.teamA" value={formData.odds.teamA} onChange={handleChange} placeholder="Team A" step="0.1" min="1" className={formField + " text-center"} required />
          <input type="number" name="odds.draw" value={formData.odds.draw} onChange={handleChange} placeholder="Draw" step="0.1" min="1" className={formField + " text-center"} required />
          <input type="number" name="odds.teamB" value={formData.odds.teamB} onChange={handleChange} placeholder="Team B" step="0.1" min="1" className={formField + " text-center"} required />
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button type="button" onClick={onCancel} className="flex-1 py-3 px-6 bg-gray-100 hover:bg-gray-200 rounded-xl font-semibold text-gray-700 transition-colors">
          Cancel
        </button>
        <button type="submit" className="flex-1 py-3 px-6 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-xl font-semibold transition-all shadow-lg hover:shadow-xl">
          {match ? 'Update Match' : 'Add Match'}
        </button>
      </div>
    </form>
  );
};
