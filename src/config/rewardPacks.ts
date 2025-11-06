import { GameRewardTier, TournamentType } from '../types';
import { v4 as uuidv4 } from 'uuid';

type RewardPackMatrix = Record<TournamentType, Record<string, GameRewardTier[]>>;

const createReward = (type: any, tier?: any, value?: any) => ({ id: uuidv4(), type, tier, value });

export const BASE_REWARD_PACKS: RewardPackMatrix = {
  amateur: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("ticket", "master"), createReward("xp", undefined, 200)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "amateur"), createReward("xp", undefined, 100)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 50)] },
    ],
    series: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "amateur"), createReward("ticket", "master")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "amateur")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 10), createReward("masterpass", "master")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("ticket", "master")] },
    ],
  },
  master: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("ticket", "apex"), createReward("xp", undefined, 1000)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "master"), createReward("xp", undefined, 500)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 250)] },
    ],
    series: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "master"), createReward("ticket", "apex")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "master")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 25), createReward("masterpass", "apex")] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("ticket", "apex")] },
    ],
  },
  apex: {
    matchday: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("premium_7d"), createReward("xp", undefined, 2500)] },
      { id: uuidv4(), positionType: 'rank', start: 2, rewards: [createReward("spin", "apex"), createReward("xp", undefined, 1200)] },
      { id: uuidv4(), positionType: 'rank', start: 3, rewards: [createReward("xp", undefined, 600)] },
    ],
    series: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("masterpass", "apex"), createReward("giftcard", undefined, 15)] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("spin", "apex")] },
    ],
    season: [
      { id: uuidv4(), positionType: 'rank', start: 1, rewards: [createReward("giftcard", undefined, 50), createReward("custom", undefined, { name: "Official Team Jersey" })] },
      { id: uuidv4(), positionType: 'percent', start: 10, rewards: [createReward("premium_3d")] },
    ],
  },
};
