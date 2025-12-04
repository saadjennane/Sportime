import { LiveGameMarket } from '../types';
import { addMinutes } from 'date-fns';

const now = new Date();

export const mockPreMatchMarkets: LiveGameMarket[] = [
  {
    id: 'pre-mkt-1',
    minute: 0,
    type: 'first_goal_scorer',
    title: 'Who will score the first goal?',
    emotion_factor: 1.0,
    odds: [
      { option: 'L. Messi', adjusted: 4.5 },
      { option: 'K. De Bruyne', adjusted: 6.0 },
      { option: 'E. Haaland', adjusted: 3.5 },
      { option: 'Other', adjusted: 1.8 },
      { option: 'No Goal', adjusted: 9.0 },
    ],
    expires_at: addMinutes(now, -1).toISOString(), // Should expire at kickoff
    status: 'open',
  },
  {
    id: 'pre-mkt-2',
    minute: 0,
    type: 'first_half_result',
    title: 'Result at Halftime?',
    emotion_factor: 1.0,
    odds: [
      { option: 'Team A Wins', adjusted: 2.8 },
      { option: 'Draw', adjusted: 2.2 },
      { option: 'Team B Wins', adjusted: 3.5 },
    ],
    expires_at: addMinutes(now, -1).toISOString(), // Should expire at kickoff
    status: 'open',
  },
];
