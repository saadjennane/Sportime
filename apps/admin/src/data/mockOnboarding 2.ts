/**
 * Mock Onboarding Data (Stub)
 *
 * NOTE: Onboarding flow is managed via OnboardingPage component.
 * This stub file exists only for backward compatibility with OnboardingFlow.tsx.
 */

export interface OnboardingSlide {
  id: number;
  title: string;
  description: string;
  image?: string;
  icon?: string;
}

export const onboardingSlides: OnboardingSlide[] = [
  {
    id: 1,
    title: 'Welcome to Sportime',
    description: 'Predict match outcomes, compete with friends, and climb the leaderboards!',
    icon: '⚽',
  },
  {
    id: 2,
    title: 'Challenge Betting',
    description: 'Join challenges, make predictions, and win big with your football knowledge.',
    icon: '🎯',
  },
  {
    id: 3,
    title: 'Build Your Squad',
    description: 'Create private leagues with friends and compete for glory.',
    icon: '👥',
  },
  {
    id: 4,
    title: 'Earn Rewards',
    description: 'Level up, earn badges, and unlock exclusive rewards as you play.',
    icon: '🏆',
  },
];
