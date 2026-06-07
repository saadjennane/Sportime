import { Profile, SportimeGame, UserTicket } from '../types';
import { isBefore, parseISO } from 'date-fns';
import { levelRank } from '../config/levels';

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

  // Check level (canonical hierarchy: Rookie … GOAT)
  if (levelRank(profile.level) < levelRank(game.minimum_level)) {
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
