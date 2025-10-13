import { LiveGame, LiveGamePlayerEntry } from '../types';

// --- SCORING LOGIC ---

export function calculateLiveGameScores(game: LiveGame): LiveGame {
  const actualScore = game.match_details.score;
  if (!actualScore) return game;

  const updatedPlayers = game.players.map(player => {
    const predScore = player.predicted_score;
    let scoreFinal = 0;

    // 1. Result Points (15)
    const actualResult = actualScore.home > actualScore.away ? 'home' : actualScore.home < actualScore.away ? 'away' : 'draw';
    const predResult = predScore.home > predScore.away ? 'home' : predScore.home < predScore.away ? 'away' : 'draw';
    const result_points = actualResult === predResult ? 15 : 0;
    scoreFinal += result_points;

    // 2. Goal Difference Points (15)
    const actualGD = actualScore.home - actualScore.away;
    const predGD = predScore.home - predScore.away;
    const diffGD = Math.abs(actualGD - predGD);
    let gd_points = 0;
    if (diffGD === 0) gd_points = 15;
    else if (diffGD === 1) gd_points = 8;
    else if (diffGD === 2) gd_points = 4;
    scoreFinal += gd_points;

    // 3. Per-Team Accuracy Points (15)
    const deltaTeams = Math.abs(predScore.home - actualScore.home) + Math.abs(predScore.away - actualScore.away);
    const team_points = Math.max(0, 15 - 4 * deltaTeams);
    scoreFinal += team_points;

    // 4. Exact Score Bonus (15)
    const exact_points = (predScore.home === actualScore.home && predScore.away === actualScore.away) ? 15 : 0;
    scoreFinal += exact_points;
    
    // Apply halftime malus if applicable
    if (player.midtime_edit) {
        scoreFinal *= 0.6;
    }

    // Bonus Questions (40)
    let bonus_total = 0;
    player.bonus_answers.forEach(ans => {
        const question = game.bonus_questions.find(q => q.id === ans.question_id);
        if (question && question.answer === ans.choice) {
            bonus_total += 10;
        }
    });

    return {
        ...player,
        result_points,
        gd_points,
        team_points,
        exact_points,
        score_final: Math.round(scoreFinal),
        bonus_total,
        total_points: Math.round(scoreFinal) + bonus_total,
    };
  });

  return { ...game, players: updatedPlayers };
}
