import { Target, Layers, Shirt, Swords, Crosshair, Zap, Trophy } from 'lucide-react';

/**
 * Single source of truth for a game type's visual identity (icon + accent + label
 * + one-line tagline). Lists are filtered by sport, so the accents never collide
 * within a single list. Used by the game card and the type-filter chips.
 */
export interface GameTypeIdentity {
  name: string;
  tagline: string;
  Icon: any;
  chip: string;       // chip bg + text
  rail: string;       // left rail bg
  dot: string;        // live dot bg
  accentText: string; // standalone accent text
}

export const GAME_TYPE_IDENTITY: Record<string, GameTypeIdentity> = {
  betting:        { name: "Pick'em",      tagline: 'Predict the winners',  Icon: Target,    chip: 'bg-electric-blue/20 text-electric-blue', rail: 'bg-electric-blue', dot: 'bg-electric-blue', accentText: 'text-electric-blue' },
  prediction:     { name: 'Swipe',        tagline: 'Swipe your calls',     Icon: Layers,    chip: 'bg-neon-cyan/20 text-neon-cyan',        rail: 'bg-neon-cyan',     dot: 'bg-neon-cyan',     accentText: 'text-neon-cyan' },
  fantasy:        { name: 'Fantasy',      tagline: 'Build your XI',        Icon: Shirt,     chip: 'bg-lime-glow/20 text-lime-glow',        rail: 'bg-lime-glow',     dot: 'bg-lime-glow',     accentText: 'text-lime-glow' },
  'fantasy-live': { name: 'Fantasy Live', tagline: 'Play live',            Icon: Shirt,     chip: 'bg-purple-600/20 text-purple-400',      rail: 'bg-purple-500',    dot: 'bg-purple-400',    accentText: 'text-purple-400' },
  duel:           { name: 'Duels',        tagline: 'Pick the winner',      Icon: Swords,    chip: 'bg-hot-red/20 text-hot-red',            rail: 'bg-hot-red',       dot: 'bg-hot-red',       accentText: 'text-hot-red' },
  predictor:      { name: 'Predictor',    tagline: 'Predict the podium',   Icon: Crosshair, chip: 'bg-neon-cyan/20 text-neon-cyan',        rail: 'bg-neon-cyan',     dot: 'bg-neon-cyan',     accentText: 'text-neon-cyan' },
  f1fantasy:      { name: 'Fantasy F1',   tagline: 'Build your grid',      Icon: Zap,       chip: 'bg-warm-yellow/20 text-warm-yellow',    rail: 'bg-warm-yellow',   dot: 'bg-warm-yellow',   accentText: 'text-warm-yellow' },
  tournament:     { name: 'Tournament',   tagline: 'Predict the bracket',  Icon: Trophy,    chip: 'bg-warm-yellow/20 text-warm-yellow',    rail: 'bg-warm-yellow',   dot: 'bg-warm-yellow',   accentText: 'text-warm-yellow' },
};

export const gameTypeIdentity = (t: string): GameTypeIdentity => GAME_TYPE_IDENTITY[t] ?? GAME_TYPE_IDENTITY.betting;
