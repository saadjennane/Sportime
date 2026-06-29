import type { GameRewardTier, RewardItem } from '../types';

/** Normalize a raw `prizes`/`rewards_json` jsonb array into typed reward tiers.
 *  Shared by the challenge, swipe and tournament data layers so the
 *  RewardsPreviewModal always receives a consistent shape. */
export function mapRewards(prizes: any): GameRewardTier[] {
  if (!Array.isArray(prizes)) return [];
  return prizes
    .map((tier: any, index: number): GameRewardTier | null => {
      if (!tier) return null;
      const rewards: RewardItem[] = Array.isArray(tier.rewards)
        ? tier.rewards.map((reward: any, rewardIndex: number): RewardItem | null => {
            if (!reward || typeof reward !== 'object') return null;
            const rawType = reward.type ?? reward.reward_type;
            const allowedRewardTypes: RewardItem['type'][] = ['ticket', 'spin', 'xp', 'giftcard', 'masterpass', 'custom', 'premium_3d', 'premium_7d', 'coins'];
            const normalizedType: RewardItem['type'] = typeof rawType === 'string' && allowedRewardTypes.includes(rawType as RewardItem['type'])
              ? (rawType as RewardItem['type'])
              : 'custom';

            return {
              id: reward.id ?? `${index}-${rewardIndex}`,
              type: normalizedType,
              value: reward.value ?? reward.amount ?? null,
              tier: reward.tier ?? undefined,
              name: reward.name ?? undefined,
              logo: reward.logo ?? undefined,
            };
          }).filter(Boolean) as RewardItem[]
        : [];

      const positionCandidate = tier.positionType ?? tier.position_type;
      const allowedPositionTypes: GameRewardTier['positionType'][] = ['rank', 'range', 'percent'];
      const positionType: GameRewardTier['positionType'] = typeof positionCandidate === 'string' && allowedPositionTypes.includes(positionCandidate as GameRewardTier['positionType'])
        ? (positionCandidate as GameRewardTier['positionType'])
        : 'rank';
      const start = typeof tier.start === 'number' ? tier.start : 1;
      const end =
        typeof tier.end === 'number'
          ? tier.end
          : typeof tier.range_end === 'number'
            ? tier.range_end
            : undefined;

      return {
        id: tier.id ?? String(index),
        positionType,
        start,
        end,
        rewards,
      };
    })
    .filter(Boolean) as GameRewardTier[];
}
