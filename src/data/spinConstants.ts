import { SpinReward, SpinTier } from '../types';

export const SPIN_TIERS: SpinTier[] = ["amateur", "master", "apex"];

export const SPIN_REWARDS: Record<SpinTier, SpinReward[]> = {
  amateur: [
    { id: "ticket_amateur", label: "Amateur Ticket", baseChance: 0.28, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.28, category: 'spin' },
    { id: "masterpass_amateur", label: "Amateur MasterPass", baseChance: 0.10, category: 'masterpass' },
    { id: "boost_50", label: "XP +50", baseChance: 0.12, category: 'xp' },
    { id: "boost_100", label: "XP +100", baseChance: 0.10, category: 'xp' },
    { id: "boost_200", label: "XP +200", baseChance: 0.09, category: 'xp' },
    { id: "ticket_master", label: "Master Ticket", baseChance: 0.03, category: 'ticket' },
  ],
  master: [
    { id: "ticket_master", label: "Master Ticket", baseChance: 0.24, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.24, category: 'spin' },
    { id: "boost_200", label: "XP +200", baseChance: 0.18, category: 'xp' },
    { id: "boost_400", label: "XP +400", baseChance: 0.16, category: 'xp' },
    { id: "masterpass_master", label: "Master MasterPass", baseChance: 0.08, category: 'masterpass' },
    { id: "ticket_apex", label: "Apex Ticket", baseChance: 0.06, category: 'ticket' },
    { id: "premium_3d", label: "Premium (3 days)", baseChance: 0.04, category: 'premium' },
  ],
  apex: [
    { id: "ticket_apex", label: "Apex Ticket", baseChance: 0.25, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.25, category: 'spin' },
    { id: "masterpass_apex", label: "Apex MasterPass", baseChance: 0.15, category: 'masterpass' },
    { id: "boost_1200", label: "XP +1200", baseChance: 0.14, category: 'xp' },
    { id: "boost_800", label: "XP +800", baseChance: 0.11, category: 'xp' },
    { id: "gift_card", label: "Gift Card $5", baseChance: 0.06, category: 'gift_card' },
    { id: "premium_7d", label: "Premium (7 days)", baseChance: 0.04, category: 'premium' },
  ],
};

export const RARE_REWARD_CATEGORIES: Record<SpinTier, string[]> = {
    amateur: ['masterpass', 'ticket_master'],
    master: ['masterpass', 'ticket_apex', 'premium'],
    apex: ['masterpass', 'gift_card', 'premium'],
};

export const PITY_TIMER_THRESHOLD = 10;
export const PITY_MULTIPLIER = 1.5;

export const ADAPTIVE_RULES: Record<string, { multiplier: number, durationDays: number }> = {
    premium: { multiplier: 0.5, durationDays: 7 },
    gift_card: { multiplier: 0.3, durationDays: 7 },
    masterpass: { multiplier: 0.5, durationDays: 30 },
};
