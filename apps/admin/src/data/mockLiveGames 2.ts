import { LiveGame } from '../types';
import { mockMatches } from './mockMatches';

export const mockLiveGames: LiveGame[] = [
  {
    id: 'live-1',
    league_id: 'l_001',
    match_id: '1',
    match_details: mockMatches.find(m => m.id === '1')!,
    created_by: 'user-1',
    status: 'Upcoming',
    bonus_questions: [], // Will be generated dynamically
    players: [],
  },
];
