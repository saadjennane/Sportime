import { ProgressionMilestone, FreeSpinReward } from '../types';

export const PROGRESSION_MILESTONES: ProgressionMilestone[] = [
  { wins: 5, rewards: [{ type: 'coins', value: 100 }] },
  { wins: 10, rewards: [{ type: 'coins', value: 150 }] },
  { wins: 20, rewards: [{ type: 'coins', value: 200 }] },
  { wins: 30, rewards: [{ type: 'coins', value: 300 }] },
  { wins: 50, rewards: [{ type: 'coins', value: 500 }, { type: 'spin', value: 'rookie' }] },
  { wins: 75, rewards: [{ type: 'coins', value: 700 }, { type: 'spin', value: 'pro' }] },
  { wins: 100, rewards: [{ type: 'coins', value: 1000 }, { type: 'spin', value: 'elite' }] },
  { wins: 150, rewards: [{ type: 'coins', value: 1500 }, { type: 'badge', value: 'FunZone Master' }] },
];

export const FREE_SPIN_REWARDS: FreeSpinReward[] = [
  { label: "+10 coins", type: "coins", value: 10, probability: 0.25 },
  { label: "+20 coins", type: "coins", value: 20, probability: 0.20 },
  { label: "+40 coins", type: "coins", value: 40, probability: 0.10 },
  { label: "+10 XP", type: "xp", value: 10, probability: 0.20 },
  { label: "+20 XP", type: "xp", value: 20, probability: 0.10 },
  { label: "+40 XP", type: "xp", value: 40, probability: 0.05 },
  { label: "No luck today 😅", type: "none", value: 0, probability: 0.10 }
];
