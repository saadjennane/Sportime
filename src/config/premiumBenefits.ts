export interface PremiumBenefit {
  icon: string;
  title: string;
  description: string;
}

export const PREMIUM_BENEFITS: PremiumBenefit[] = [
  {
    icon: '💰',
    title: '5,000 Welcome Coins',
    description: 'Get a one-time bonus of 5,000 coins instantly upon subscribing.'
  },
  {
    icon: '🎟️',
    title: 'Double Daily Tickets',
    description: 'Receive two free tickets every day to enter exclusive tournaments.'
  },
  {
    icon: '⚡',
    title: '2x XP Gain',
    description: 'Level up twice as fast with a permanent experience point booster on all activities.'
  },
  {
    icon: '💎',
    title: 'Exclusive Tournaments',
    description: 'Access premium-only tournaments with bigger prize pools and unique rewards.'
  },
  {
    icon: '✨',
    title: 'Cosmetic Badge',
    description: 'Show off your premium status with an exclusive badge on your profile.'
  },
  {
    icon: '🤫',
    title: 'Ad-Free Experience',
    description: 'Enjoy Sportime completely uninterrupted, with no ads.'
  }
];
