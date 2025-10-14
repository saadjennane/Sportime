import React, { useState } from 'react';
import { BettingChallenge } from '../types';
import { Play } from 'lucide-react';

interface ChallengesAdminProps {
  challenges: BettingChallenge[];
  onProcessChallengeStart: (challengeId: string) => void;
}

export const ChallengesAdmin: React.FC<ChallengesAdminProps> = ({ challenges, onProcessChallengeStart }) => {
  const upcomingChallenges = challenges.filter(c => c.status === 'Upcoming');
  const otherChallenges = challenges.filter(c => c.status !== 'Upcoming');

  return (
    <div className="space-y-4">
      <h2 className="font-bold text-lg text-electric-blue">Manage Challenges</h2>
      
      {upcomingChallenges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary">Upcoming</h3>
          {upcomingChallenges.map(challenge => (
            <div key={challenge.id} className="card-base p-3 flex items-center justify-between">
              <div>
                <p className="font-bold text-text-primary">{challenge.name}</p>
                <p className="text-xs text-text-disabled">Min Players: {challenge.minimum_players || 'N/A'}, Current: {challenge.participants.length}</p>
              </div>
              <button
                onClick={() => onProcessChallengeStart(challenge.id)}
                className="flex items-center gap-2 text-sm font-semibold bg-lime-glow/20 text-lime-glow px-3 py-2 rounded-lg hover:bg-lime-glow/30"
              >
                <Play size={16} /> Start
              </button>
            </div>
          ))}
        </div>
      )}

      {otherChallenges.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-md font-semibold text-text-secondary">Active/Finished</h3>
          {otherChallenges.map(challenge => (
             <div key={challenge.id} className={`card-base p-3 opacity-70 ${challenge.status === 'Cancelled' ? 'bg-hot-red/10' : ''}`}>
              <p className="font-bold text-text-primary">{challenge.name}</p>
              <p className={`text-xs font-bold ${challenge.status === 'Cancelled' ? 'text-hot-red' : 'text-text-disabled'}`}>Status: {challenge.status}</p>
            </div>
          ))}
        </div>
      )}

      {challenges.length === 0 && (
        <p className="text-center text-text-disabled py-4">No challenges have been created yet.</p>
      )}
    </div>
  );
};
