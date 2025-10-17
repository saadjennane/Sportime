import { GameRewardTier, TournamentType } from '../types';
import { v4 as uuidv4 } from 'uuid';

type RewardPackMatrix = Record<TournamentType, Record<string, GameRewardTier[]>>;

const createReward = (type: any, tier?: any, value?: any) => ({ id: uuidv4(), type, tier, value });

export const BASE_REWARD_PACKS: RewardPackMatrix = {
  rookie: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("ticket", "pro"), createReward("xp", undefined, 200)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "rookie"), createReward("xp", undefined, 100)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 50)] },
    ],
    "mini-series": [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "rookie"), createReward("ticket", "pro")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "rookie")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 10), createReward("masterpass", "pro")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("ticket", "pro")] },
    ],
  },
  pro: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("ticket", "elite"), createReward("xp", undefined, 1000)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "pro"), createReward("xp", undefined, 500)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 250)] },
    ],
    "mini-series": [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "pro"), createReward("ticket", "elite")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "pro")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 25), createReward("masterpass", "elite")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("ticket", "elite")] },
    ],
  },
  elite: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("premium_7d"), createReward("xp", undefined, 2500)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "elite"), createReward("xp", undefined, 1200)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 600)] },
    ],
    "mini-series": [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "elite"), createReward("giftcard", undefined, 15)] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "elite")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 50), createReward("custom", undefined, { name: "Official Team Jersey" })] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("premium_3d")] },
    ],
  },
};
