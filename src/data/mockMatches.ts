import { Match } from '../types';

export const mockMatches: Match[] = [
  {
    id: '1',
    leagueName: 'Premier League',
    leagueLogo: 'https://media.api-sports.io/football/leagues/39.png',
    teamA: { name: 'Man United', emoji: '🔴' },
    teamB: { name: 'Liverpool', emoji: '⚽' },
    kickoffTime: '15:00',
    odds: { teamA: 2.1, draw: 3.2, teamB: 2.8 },
    status: 'upcoming'
  },
  {
    id: '2',
    leagueName: 'La Liga',
    leagueLogo: 'https://media.api-sports.io/football/leagues/140.png',
    teamA: { name: 'Barcelona', emoji: '🔵' },
    teamB: { name: 'Real Madrid', emoji: '⚪' },
    kickoffTime: '18:30',
    odds: { teamA: 2.5, draw: 3.0, teamB: 2.3 },
    status: 'upcoming'
  },
  {
    id: '3',
    leagueName: 'Bundesliga',
    leagueLogo: 'https://media.api-sports.io/football/leagues/78.png',
    teamA: { name: 'Bayern Munich', emoji: '🟥' },
    teamB: { name: 'Dortmund', emoji: '🟨' },
    kickoffTime: '20:00',
    odds: { teamA: 1.9, draw: 3.5, teamB: 3.2 },
    status: 'upcoming'
  },
  {
    id: '4',
    leagueName: 'Premier League',
    leagueLogo: 'https://media.api-sports.io/football/leagues/39.png',
    teamA: { name: 'Chelsea', emoji: '🔷' },
    teamB: { name: 'Arsenal', emoji: '🔴' },
    kickoffTime: '12:30',
    odds: { teamA: 2.4, draw: 3.1, teamB: 2.6 },
    status: 'played',
    result: 'teamA',
    score: { teamA: 2, teamB: 1 }
  },
  {
    id: '5',
    leagueName: 'Ligue 1',
    leagueLogo: 'https://media.api-sports.io/football/leagues/61.png',
    teamA: { name: 'PSG', emoji: '🔴' },
    teamB: { name: 'Marseille', emoji: '⚪' },
    kickoffTime: '16:00',
    odds: { teamA: 1.7, draw: 3.8, teamB: 4.2 },
    status: 'played',
    result: 'draw',
    score: { teamA: 1, teamB: 1 }
  },
  {
    id: '6',
    leagueName: 'Premier League',
    leagueLogo: 'https://media.api-sports.io/football/leagues/39.png',
    teamA: { name: 'Man City', emoji: '💠' },
    teamB: { name: 'Everton', emoji: '🍬' },
    kickoffTime: '17:00',
    odds: { teamA: 1.4, draw: 4.5, teamB: 7.0 },
    status: 'upcoming'
  },
  {
    id: '7',
    leagueName: 'La Liga',
    leagueLogo: 'https://media.api-sports.io/football/leagues/140.png',
    teamA: { name: 'Atletico Madrid', emoji: '🔴' },
    teamB: { name: 'Sevilla', emoji: '⚪' },
    kickoffTime: '19:00',
    odds: { teamA: 1.9, draw: 3.4, teamB: 4.0 },
    status: 'upcoming'
  }
];
