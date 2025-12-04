import { Profile, SportimeGame, UserTicket } from '../types';
import { isBefore, parseISO } from 'date-fns';

const LEVEL_HIERARCHY: Record<string, number> = {
  Amateur: 0,
  Pro: 1,
  Expert: 2,
  Master: 3,
  Legend: 4,
  GOAT: 5,
};

export const checkEligibility = (profile: Profile | null, game: SportimeGame, userTickets: UserTicket[]) => {
  if (!profile || profile.is_guest) {
    return { isEligible: false, reasons: ['guest'] };
  }

  const reasons: string[] = [];
  let canPay = false;

  // Check coin balance
  const hasEnoughCoins = profile.coins_balance >= game.entry_cost;
  if (hasEnoughCoins) canPay = true;

  // Check for valid ticket
  const hasValidTicket = userTickets.some(ticket => 
    ticket.user_id === profile.id &&
    ticket.type === game.tier &&
    !ticket.is_used &&
    isBefore(new Date(), parseISO(ticket.expires_at))
  );
  if (hasValidTicket) canPay = true;

  if (!canPay) {
    reasons.push('funds');
  }

  // Check subscription
  if (game.requires_subscription && !profile.is_subscriber) {
    reasons.push('subscription');
  }

  // Check level
  const userLevel = LEVEL_HIERARCHY[profile.level || 'Amateur'];
  const requiredLevel = LEVEL_HIERARCHY[game.minimum_level || 'Amateur'];
  if (userLevel < requiredLevel) {
    reasons.push('level');
  }

  // Check badges
  if (game.required_badges && game.required_badges.length > 0) {
    const userBadges = new Set(profile.badges || []);
    const hasAllBadges = game.required_badges.every(badgeId => userBadges.has(badgeId));
    if (!hasAllBadges) {
      reasons.push('badges');
    }
  }

  return { isEligible: reasons.length === 0, reasons };
};
