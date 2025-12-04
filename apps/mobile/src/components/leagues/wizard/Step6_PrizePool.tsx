import React from 'react';
import { WizardState } from './CreatePrivateLeagueWizard';
import { InfoTooltip } from '../../shared/Tooltip';

// --- Utility Functions (moved from paidTournamentUtils.ts to fix import issue) ---
export const calculatePrizePool = (entryFee: number, playerCount: number) => {
  const totalPot = entryFee * playerCount;
  const sportimeFee = totalPot * 0.15;
  const prizePool = totalPot - sportimeFee;
  const first = prizePool * 0.55;
  const second = prizePool * 0.30;
  const third = prizePool * 0.15;

  return { prizePool, first, second, third, sportimeFee };
};

export const getInAppRewards = (entryFee: number) => {
  if (entryFee <= 3) return "Rookie";
  if (entryFee <= 7) return "Pro";
  return "Elite";
};

export const getParticipationCoins = (entryFee: number) => {
  if (entryFee <= 3) return 200;
  if (entryFee <= 7) return 500;
  return 1000;
};
// --- End Utility Functions ---

interface StepProps {
  state: WizardState;
  updateState: (update: Partial<WizardState>) => void;
  next: () => void;
  prev: () => void;
}

export const Step6_PrizePool: React.FC<StepProps> = ({ state, updateState, next, prev }) => {
  const isPaid = state.isPaid || false;
  const entryFee = state.entryFee || 1;
  const playerCount = state.player_count || 4;

  const { prizePool, first, second, third, sportimeFee } = calculatePrizePool(entryFee, playerCount);
  const inAppRewardsTier = getInAppRewards(entryFee);
  const participationCoins = getParticipationCoins(entryFee);

  const handleToggle = (e: React.ChangeEvent<HTMLInputElement>) => {
    updateState({ isPaid: e.target.checked });
  };

  const handleFeeChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let fee = parseInt(e.target.value, 10);
    if (isNaN(fee)) fee = 1;
    if (fee < 1) fee = 1;
    if (fee > 10) fee = 10;
    updateState({ entryFee: fee });
  };

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h3 className="text-2xl font-bold text-text-primary flex items-center justify-center gap-2">
          💰 Add a Prize Pool
          <InfoTooltip text="Let your league compete for real rewards — small entry fee, big bragging rights." />
        </h3>
        <p className="text-text-secondary">Turn your private game into a high-stakes tournament.</p>
      </div>

      <label className="flex items-center justify-center gap-3 p-4 rounded-xl bg-deep-navy/50 cursor-pointer">
        <span className="font-bold text-text-primary">Activate Prize Pool</span>
        <div className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${isPaid ? 'bg-electric-blue' : 'bg-disabled'}`}>
          <span className={`absolute top-1 left-1 w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-300 ${isPaid ? 'translate-x-5' : 'translate-x-0'}`} />
        </div>
        <input type="checkbox" checked={isPaid} onChange={handleToggle} className="hidden" />
      </label>

      {isPaid && (
        <div className="bg-deep-navy/50 p-4 rounded-xl space-y-4 animate-scale-in">
          <h4 className="text-lg font-semibold text-text-primary text-center">Setup Your Prize Game</h4>
          <p className="text-xs text-center text-text-secondary -mt-3">Decide how much to play for, and we’ll handle the rewards automatically.</p>
          
          <div>
            <label htmlFor="entryFee" className="block text-sm font-semibold text-text-secondary mb-1">Entry Fee (€1-10)</label>
            <input
              id="entryFee"
              type="number"
              value={entryFee}
              onChange={handleFeeChange}
              min="1"
              max="10"
              className="input-base"
            />
             <p className="text-xs text-text-disabled text-center mt-1">Sportime keeps 15% to manage payments and reward distribution.</p>
          </div>

          <div>
            <p className="text-sm font-semibold text-text-secondary mb-2 text-center">Here’s what your players can win 👇</p>
            <div className="bg-deep-navy p-3 rounded-lg space-y-2">
              <div className="grid grid-cols-3 gap-2 text-center">
                <div><p className="text-xs text-text-disabled">Total Pot</p><p className="font-bold">€{prizePool.toFixed(2)}</p></div>
                <div><p className="text-xs text-text-disabled">Players</p><p className="font-bold">{playerCount}</p></div>
                <div><p className="text-xs text-text-disabled">Sportime Fee</p><p className="font-bold">€{sportimeFee.toFixed(2)}</p></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-2 border-t border-disabled/50">
                <div><p className="text-xs text-text-disabled">🥇 1st</p><p className="font-bold text-lime-glow">€{first.toFixed(2)}</p></div>
                <div><p className="text-xs text-text-disabled">🥈 2nd</p><p className="font-bold text-lime-glow">€{second.toFixed(2)}</p></div>
                <div><p className="text-xs text-text-disabled">🥉 3rd</p><p className="font-bold text-lime-glow">€{third.toFixed(2)}</p></div>
              </div>
              <div className="text-center text-xs text-text-secondary pt-2 border-t border-disabled/50">
                In-App Rewards: <b className="text-electric-blue">{inAppRewardsTier} Tier</b> | Participation Bonus: <b className="text-warm-yellow">{participationCoins} Coins</b>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex gap-4 pt-4">
        <button onClick={prev} className="secondary-button flex-1 bg-navy-accent border-disabled text-text-secondary hover:border-electric-blue hover:text-electric-blue">
          Back
        </button>
        <button onClick={next} className="primary-button flex-1">
          Continue
        </button>
      </div>
    </div>
  );
};
