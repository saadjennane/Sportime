interface MarketTemplate {
  title: string;
  options: string[];
  rarity?: 'common' | 'rare';
}

export const marketTemplates: Record<string, MarketTemplate> = {
  // Time-based
  early_goal_window: {
    title: "Goal before 20'?",
    options: ["Yes", "No"],
    rarity: "common",
  },
  mid_half_momentum: {
    title: "Will either team score before Halftime?",
    options: ["Yes", "No"],
    rarity: "common",
  },
  second_half_boost: {
    title: "Next team to score?",
    options: ["Team A", "Team B", "None"],
    rarity: "common",
  },
  late_draw_drama: {
    title: "Match ends in a draw?",
    options: ["Yes", "No"],
    rarity: "rare",
  },
  final_push: {
    title: "Another goal before Full Time?",
    options: ["Yes", "No"],
    rarity: "common",
  },

  // Event-based
  goal_event: {
    title: "Will the losing team equalize?",
    options: ["Yes", "No"],
    rarity: "common",
  },
  equalizer_event: {
    title: "Will the match end in a draw?",
    options: ["Yes", "No"],
    rarity: "common",
  },
  red_card_event: {
    title: "Will the red-carded team concede again?",
    options: ["Yes", "No"],
    rarity: "rare",
  },
  lead_by_two: {
    title: "Will the losing team score next?",
    options: ["Yes", "No"],
    rarity: "common",
  },

  // Narrative
  tension_builds: {
    title: "Will there be a winner?",
    options: ["Yes", "No"],
    rarity: "common",
  },
  last_chance: {
    title: "Who scores the last goal?",
    options: ["Team A", "Team B", "None"],
    rarity: "rare",
  },
};
