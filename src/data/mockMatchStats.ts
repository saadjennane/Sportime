import { MatchStats } from '../types';

export const mockMatchStats: MatchStats = {
  matchId: "2", // Corresponds to Barcelona vs Real Madrid
  teams: {
    home: {
      name: "Barcelona",
      formSummary: {
        played: 5, wins: 4, draws: 1, losses: 0,
        goalsFor: 12, goalsAgainst: 4,
        formString: "W W D W W"
      },
      formMatches: [
        { date: "2025-10-10", competition: "La Liga", homeTeam: "Barcelona", awayTeam: "Girona", homeScore: 3, awayScore: 1, result: "W" },
        { date: "2025-10-03", competition: "Champions League", homeTeam: "Barcelona", awayTeam: "Inter Milan", homeScore: 2, awayScore: 2, result: "D" },
        { date: "2025-09-28", competition: "La Liga", homeTeam: "Celta Vigo", awayTeam: "Barcelona", homeScore: 1, awayScore: 4, result: "W" },
        { date: "2025-09-21", competition: "La Liga", homeTeam: "Barcelona", awayTeam: "Mallorca", homeScore: 3, awayScore: 0, result: "W" },
        { date: "2025-09-14", competition: "La Liga", homeTeam: "Real Sociedad", awayTeam: "Barcelona", homeScore: 1, awayScore: 2, result: "W" }
      ]
    },
    away: {
      name: "Real Madrid",
      formSummary: {
        played: 5, wins: 3, draws: 1, losses: 1,
        goalsFor: 9, goalsAgainst: 5,
        formString: "L W D W W"
      },
      formMatches: [
        { date: "2025-10-10", competition: "La Liga", homeTeam: "Valencia", awayTeam: "Real Madrid", homeScore: 1, awayScore: 2, result: "W" },
        { date: "2025-10-03", competition: "Champions League", homeTeam: "Real Madrid", awayTeam: "Juventus", homeScore: 1, awayScore: 1, result: "D" },
        { date: "2025-09-28", competition: "La Liga", homeTeam: "Real Madrid", awayTeam: "Betis", homeScore: 2, awayScore: 0, result: "W" },
        { date: "2025-09-21", competition: "La Liga", homeTeam: "Atletico Madrid", awayTeam: "Real Madrid", homeScore: 3, awayScore: 1, result: "L" },
        { date: "2025-09-14", competition: "La Liga", homeTeam: "Real Madrid", awayTeam: "Sevilla", homeScore: 3, awayScore: 2, result: "W" }
      ]
    }
  },
  h2h: [
    { date: "2025-03-16", competition: "La Liga", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "0–1" },
    { date: "2024-10-26", competition: "La Liga", homeTeam: "Barcelona", awayTeam: "Real Madrid", score: "1–2" },
    { date: "2024-04-21", competition: "La Liga", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "3–2" },
    { date: "2024-01-14", competition: "Supercopa", homeTeam: "Real Madrid", awayTeam: "Barcelona", score: "4–1" },
    { date: "2023-10-28", competition: "La Liga", homeTeam: "Barcelona", awayTeam: "Real Madrid", score: "1–2" }
  ],
  lineup: {
    status: "confirmed",
    formation: "4-3-3",
    lastUpdated: "2025-10-17T18:45:00Z",
    source: "Opta MockFeed",
    starters: [
      { name: "Ter Stegen", position: "GK" },
      { name: "Koundé", position: "DF" },
      { name: "Araújo", position: "DF" },
      { name: "Cubarsí", position: "DF" },
      { name: "Cancelo", position: "DF" },
      { name: "Gündoğan", position: "MF" },
      { name: "Pedri", position: "MF" },
      { name: "F. de Jong", position: "MF" },
      { name: "Lamine Yamal", position: "FW" },
      { name: "Lewandowski (C)", position: "FW" },
      { name: "Raphinha", position: "FW" }
    ],
    bench: [
      { name: "Iñaki Peña", position: "GK" },
      { name: "Iñigo Martínez", position: "DF" },
      { name: "Fermín López", position: "MF" },
      { name: "João Félix", position: "FW" }
    ],
    absentees: [
      { name: "Gavi", reason: "injured (knee)" },
      { name: "Balde", reason: "injured (hamstring)" }
    ]
  }
};
