import { SpinReward, SpinTier, TournamentType } from "../types";

export const SPIN_TIERS: SpinTier[] = ["free", "rookie", "pro", "elite", "premium"];

export const SPIN_REWARDS: Record<SpinTier, SpinReward[]> = {
  free: [], // This is handled by mockFunZone.ts, should be consolidated
  rookie: [
    { id: "ticket_rookie", label: "Rookie Ticket", baseChance: 0.28, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.28, category: 'spin' },
    { id: "masterpass_rookie", label: "Rookie MasterPass", baseChance: 0.10, category: 'masterpass' },
    { id: "boost_50", label: "XP +50", baseChance: 0.12, category: 'xp' },
    { id: "boost_100", label: "XP +100", baseChance: 0.10, category: 'xp' },
    { id: "boost_200", label: "XP +200", baseChance: 0.09, category: 'xp' },
    { id: "ticket_pro", label: "Pro Ticket", baseChance: 0.03, category: 'ticket' },
  ],
  pro: [
    { id: "ticket_pro", label: "Pro Ticket", baseChance: 0.24, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.24, category: 'spin' },
    { id: "boost_200", label: "XP +200", baseChance: 0.18, category: 'xp' },
    { id: "boost_400", label: "XP +400", baseChance: 0.16, category: 'xp' },
    { id: "masterpass_pro", label: "Pro MasterPass", baseChance: 0.08, category: 'masterpass' },
    { id: "ticket_elite", label: "Elite Ticket", baseChance: 0.06, category: 'ticket' },
    { id: "premium_3d", label: "Premium (3 days)", baseChance: 0.04, category: 'premium' },
  ],
  elite: [
    { id: "ticket_elite", label: "Elite Ticket", baseChance: 0.25, category: 'ticket' },
    { id: "extra_spin", label: "Extra Spin", baseChance: 0.25, category: 'spin' },
    { id: "masterpass_elite", label: "Elite MasterPass", baseChance: 0.15, category: 'masterpass' },
    { id: "boost_1200", label: "XP +1200", baseChance: 0.14, category: 'xp' },
    { id: "boost_800", label: "XP +800", baseChance: 0.11, category: 'xp' },
    { id: "gift_card", label: "Gift Card $5", baseChance: 0.06, category: 'gift_card' },
    { id: "premium_7d", label: "Premium (7 days)", baseChance: 0.04, category: 'premium' },
  ],
  premium: [
    { id: "masterpass_pro", label: "Pro MasterPass", baseChance: 0.20, category: 'masterpass' },
    { id: "gift_card_10", label: "Gift Card $10", baseChance: 0.05, category: 'gift_card' },
    { id: "premium_30d", label: "Premium (30 days)", baseChance: 0.10, category: 'premium' },
    { id: "boost_2000", label: "XP +2000", baseChance: 0.25, category: 'xp' },
    { id: "ticket_elite_pack", label: "2x Elite Tickets", baseChance: 0.15, category: 'ticket' },
    { id: "extra_spin_premium", label: "Extra Premium Spin", baseChance: 0.25, category: 'spin' },
  ],
};

export const RARE_REWARD_CATEGORIES: Record<SpinTier, string[]> = {
    free: [],
    rookie: ['masterpass', 'ticket_pro'],
    pro: ['masterpass', 'ticket_elite', 'premium'],
    elite: ['masterpass', 'gift_card', 'premium'],
    premium: ['gift_card', 'premium', 'masterpass_pro'],
};

export const PITY_TIMER_THRESHOLD = 10;
export const PITY_MULTIPLIER = 1.5;

export const ADAPTIVE_RULES: Record<string, { multiplier: number, durationDays: number }> = {
    premium: { multiplier: 0.5, durationDays: 7 },
    gift_card: { multiplier: 0.3, durationDays: 7 },
    masterpass: { multiplier: 0.5, durationDays: 30 },
};
