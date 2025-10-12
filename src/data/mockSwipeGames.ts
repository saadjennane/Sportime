import { SwipeMatchDay, SwipeMatch } from '../types';
import { v4 as uuidv4 } from 'uuid';

const generateMatches = (count: number): SwipeMatch[] => {
  const teams = [
    { name: 'Spain', emoji: '🇪🇸' }, { name: 'Germany', emoji: '🇩🇪' },
    { name: 'Italy', emoji: '🇮🇹' }, { name: 'Portugal', emoji: '🇵🇹' },
    { name: 'Belgium', emoji: '🇧🇪' }, { name: 'Croatia', emoji: '🇭🇷' },
    { name: 'England', emoji: '🏴󠁧󠁢󠁥󠁮󠁧󠁿' }, { name: 'Brazil', emoji: '🇧🇷' },
    { name: 'Argentina', emoji: '🇦🇷' }, { name: 'Uruguay', emoji: '🇺🇾' }
  ];
  const matches: SwipeMatch[] = [];
  for (let i = 0; i < count; i++) {
    const teamAIndex = Math.floor(Math.random() * teams.length);
    let teamBIndex = Math.floor(Math.random() * teams.length);
    while (teamAIndex === teamBIndex) {
      teamBIndex = Math.floor(Math.random() * teams.length);
    }
    matches.push({
      id: `sm-${uuidv4()}`,
      teamA: teams[teamAIndex],
      teamB: teams[teamBIndex],
      kickoffTime: `${14 + i}:00`,
      odds: {
        teamA: +(1.5 + Math.random() * 2).toFixed(2),
        draw: +(3.0 + Math.random()).toFixed(2),
        teamB: +(1.8 + Math.random() * 2.5).toFixed(2),
      }
    });
  }
  return matches;
};

export const mockSwipeMatchDays: SwipeMatchDay[] = [
  {
    id: 'swipe-1',
    gameType: 'prediction',
    name: 'Match Day 1',
    status: 'Upcoming',
    matches: generateMatches(5),
    entryCost: 250,
    startDate: '2025-08-01',
    endDate: '2025-08-01',
    totalPlayers: 8192,
    is_linkable: true,
  },
  {
    id: 'swipe-2',
    gameType: 'prediction',
    name: 'Match Day 2',
    status: 'Finished',
    matches: generateMatches(5).map(m => ({...m, result: ['teamA', 'draw', 'teamB'][Math.floor(Math.random() * 3)] as 'teamA'|'draw'|'teamB' })),
    entryCost: 100,
    startDate: '2025-07-20',
    endDate: '2025-07-20',
    totalPlayers: 11432,
  },
];
