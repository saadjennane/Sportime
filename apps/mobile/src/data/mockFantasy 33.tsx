import { FantasyGame, FantasyPlayer, UserFantasyTeam, Booster, FantasyLeaderboardEntry } from '../types';
import { subDays, addDays } from 'date-fns';
import { Flame, Zap, ShieldCheck } from 'lucide-react';
import React from 'react';

const today = new Date();

export const mockFantasyPlayers: FantasyPlayer[] = [
  // Goalkeepers
  { id: 'p4', name: 'Alisson', photo: 'https://media.api-sports.io/football/players/304.png', position: 'Goalkeeper', status: 'Key', fatigue: 100, teamName: 'Liverpool', teamLogo: 'https://media.api-sports.io/football/teams/40.png', birthdate: '1992-10-02', pgs: 7.0, liveStatus: 'playing', livePoints: 8.5 },
  { id: 'p12', name: 'M. ter Stegen', photo: 'https://media.api-sports.io/football/players/1101.png', position: 'Goalkeeper', status: 'Key', fatigue: 98, teamName: 'Barcelona', teamLogo: 'https://media.api-sports.io/football/teams/529.png', birthdate: '1992-04-30', pgs: 6.9, liveStatus: 'not_yet_played' },

  // Defenders
  { id: 'p3', name: 'V. van Dijk', photo: 'https://media.api-sports.io/football/players/306.png', position: 'Defender', status: 'Key', fatigue: 92, teamName: 'Liverpool', teamLogo: 'https://media.api-sports.io/football/teams/40.png', birthdate: '1991-07-08', pgs: 7.2, liveStatus: 'playing', livePoints: 12.1 },
  { id: 'p7', name: 'A. Davies', photo: 'https://media.api-sports.io/football/players/1102.png', position: 'Defender', status: 'Key', fatigue: 98, teamName: 'Bayern Munich', teamLogo: 'https://media.api-sports.io/football/teams/157.png', birthdate: '2000-11-02', pgs: 7.1, liveStatus: 'dnp' }, // DNP example
  { id: 'p9', name: 'J. Koundé', photo: 'https://media.api-sports.io/football/players/163.png', position: 'Defender', status: 'Key', fatigue: 94, teamName: 'Barcelona', teamLogo: 'https://media.api-sports.io/football/teams/529.png', birthdate: '1998-11-12', pgs: 6.9, liveStatus: 'not_yet_played' },
  { id: 'p13', name: 'R. James', photo: 'https://media.api-sports.io/football/players/18888.png', position: 'Defender', status: 'Wild', fatigue: 100, teamName: 'Chelsea', teamLogo: 'https://media.api-sports.io/football/teams/49.png', birthdate: '1999-12-08', pgs: 5.9, liveStatus: 'not_yet_played' },

  // Midfielders
  { id: 'p2', name: 'K. De Bruyne', photo: 'https://media.api-sports.io/football/players/62.png', position: 'Midfielder', status: 'Star', fatigue: 88, teamName: 'Man City', teamLogo: 'https://media.api-sports.io/football/teams/50.png', birthdate: '1991-06-28', pgs: 7.8, liveStatus: 'playing', livePoints: 15.2 },
  { id: 'p5', name: 'J. Bellingham', photo: 'https://media.api-sports.io/football/players/874.png', position: 'Midfielder', status: 'Star', fatigue: 85, teamName: 'Real Madrid', teamLogo: 'https://media.api-sports.io/football/teams/541.png', birthdate: '2003-06-29', pgs: 7.9, liveStatus: 'playing', livePoints: 9.8 },
  { id: 'p8', name: 'Pedri', photo: 'https://media.api-sports.io/football/players/1456.png', position: 'Midfielder', status: 'Key', fatigue: 80, teamName: 'Barcelona', teamLogo: 'https://media.api-sports.io/football/teams/529.png', birthdate: '2002-11-25', pgs: 6.8, liveStatus: 'not_yet_played' },
  { id: 'p10', name: 'F. Wirtz', photo: 'https://media.api-sports.io/football/players/2289.png', position: 'Midfielder', status: 'Wild', fatigue: 100, teamName: 'Leverkusen', teamLogo: 'https://media.api-sports.io/football/teams/168.png', birthdate: '2003-05-03', pgs: 5.8, liveStatus: 'not_yet_played' },

  // Attackers
  { id: 'p1', name: 'L. Messi', photo: 'https://media.api-sports.io/football/players/154.png', position: 'Attacker', status: 'Star', fatigue: 95, teamName: 'Inter Miami', teamLogo: 'https://media.api-sports.io/football/teams/10101.png', birthdate: '1987-06-24', pgs: 8.1, liveStatus: 'not_yet_played' },
  { id: 'p6', name: 'E. Haaland', photo: 'https://media.api-sports.io/football/players/969.png', position: 'Attacker', status: 'Star', fatigue: 90, teamName: 'Man City', teamLogo: 'https://media.api-sports.io/football/teams/50.png', birthdate: '2000-07-21', pgs: 8.3, liveStatus: 'playing', livePoints: 22.0 },
  { id: 'p11', name: 'Rafael Leão', photo: 'https://media.api-sports.io/football/players/241.png', position: 'Attacker', status: 'Key', fatigue: 85, teamName: 'AC Milan', teamLogo: 'https://media.api-sports.io/football/teams/489.png', birthdate: '1999-06-10', pgs: 7.3, liveStatus: 'playing', livePoints: 7.0 },
];

export const mockFantasyGame: FantasyGame = {
  id: 'fantasy-1',
  gameType: 'fantasy',
  name: 'Sportime Fantasy',
  status: 'Ongoing',
  startDate: subDays(today, 60).toISOString(),
  endDate: addDays(today, 2).toISOString(),
  entryCost: 1500,
  totalPlayers: 25000,
  is_linkable: true,
  gameWeeks: [
    { 
      id: 'gw-past-4', 
      name: 'MatchDay 1', 
      startDate: subDays(today, 35).toISOString(),
      endDate: subDays(today, 33).toISOString(),
      leagues: ['LaLiga'], 
      status: 'finished',
    },
    { 
      id: 'gw-past-3', 
      name: 'MatchDay 2', 
      startDate: subDays(today, 28).toISOString(),
      endDate: subDays(today, 26).toISOString(),
      leagues: ['Premier League'], 
      status: 'finished',
    },
    { 
      id: 'gw-past-2', 
      name: 'MatchDay 3', 
      startDate: subDays(today, 21).toISOString(),
      endDate: subDays(today, 19).toISOString(),
      leagues: ['Bundesliga'], 
      status: 'finished',
    },
    { 
      id: 'gw-past-1', 
      name: 'MatchDay 4', 
      startDate: subDays(today, 14).toISOString(),
      endDate: subDays(today, 12).toISOString(),
      leagues: ['Serie A'], 
      status: 'finished',
    },
    { 
      id: 'gw0', 
      name: 'MatchDay 5', 
      startDate: subDays(today, 7).toISOString(),
      endDate: subDays(today, 5).toISOString(),
      leagues: ['LaLiga'], 
      status: 'finished',
    },
    { 
      id: 'gw1', 
      name: 'MatchDay 6', 
      startDate: subDays(today, 2).toISOString(),
      endDate: addDays(today, 2).toISOString(),
      leagues: ['LaLiga', 'Premier League'], 
      status: 'live', // Changed to 'live' for testing
      conditions: [
        { key: 'max_club_players', text: 'Max. 2 players from same club', value: 2 },
        { key: 'max_star_players', text: 'Max. 2 Star players', value: 2 },
        { key: 'min_nationality', text: 'Min. 1 player from Brazil', value: 'Brazil' }
      ]
    },
  ],
};

const userFantasyTeam_GW1: UserFantasyTeam = {
  userId: 'user-1',
  gameId: 'fantasy-1',
  gameWeekId: 'gw0', // MatchDay 5
  starters: ['p12', 'p3', 'p7', 'p9', 'p8', 'p10', 'p11'], // No stars for the bonus
  substitutes: ['p4', 'p13'],
  captain_id: 'p3', // Van Dijk
  booster_used: 2, // Golden Game
  fatigue_state: { 'p12': 1, 'p3': 0.8, 'p7': 0.9, 'p9': 1, 'p8': 1, 'p10': 1, 'p11': 0.9, 'p4': 1, 'p13': 1 }
};

const userFantasyTeam_GW2: UserFantasyTeam = {
  userId: 'user-1',
  gameId: 'fantasy-1',
  gameWeekId: 'gw1', // MatchDay 6
  starters: ['p4', 'p3', 'p7', 'p9', 'p2', 'p5', 'p6'], // 1 GK, 3 DEF, 2 MID, 1 FWD
  substitutes: ['p11', 'p8'], // 1 Attacker, 1 Midfielder
  captain_id: 'p6', // Haaland
  booster_used: 1, // Double Impact
  fatigue_state: { 'p4': 1, 'p3': 0.6, 'p7': 0.8, 'p9': 0.9, 'p2': 1, 'p5': 1, 'p6': 1, 'p11': 1, 'p8': 1 }
};

export const mockUserFantasyTeams: UserFantasyTeam[] = [
  userFantasyTeam_GW1,
  userFantasyTeam_GW2,
];


export const mockFantasyLeaderboard: FantasyLeaderboardEntry[] = [
  { rank: 1, username: 'ProGamer', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704d', totalPoints: 1250, boosterUsed: 2 },
  { rank: 2, username: 'saadjennane', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704e', totalPoints: 1190, boosterUsed: 1 },
  { rank: 3, username: 'TheOracle', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704c', totalPoints: 1120, boosterUsed: null },
  { rank: 4, username: 'Player4', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704b', totalPoints: 1080, boosterUsed: null },
  { rank: 5, username: 'Player5', avatar: 'https://i.pravatar.cc/150?u=a042581f4e29026704a', totalPoints: 1050, boosterUsed: 3 },
];

export const mockBoosters: Booster[] = [
  { id: 1, name: 'Double Impact', description: "Multiplies your captain's score by 2.2.", icon: <Flame size={20} className="text-red-500" />, used: false },
  { id: 2, name: 'Golden Game', description: "Get +20% on your entire team's total score.", icon: <Zap size={20} className="text-yellow-500" />, used: true }, // Mock one as used
  { id: 3, name: 'Recovery Boost', description: 'Restore one player to 100% fatigue.', icon: <ShieldCheck size={20} className="text-green-500" />, used: false },
];
