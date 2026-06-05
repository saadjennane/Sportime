import React from 'react';
import { Flame, ShieldCheck, Zap, Users, Trophy } from 'lucide-react';
import { FantasyLiveBooster } from '../types';

export const mockFantasyLiveBoosters: FantasyLiveBooster[] = [
  { id: 1, name: 'Double Impact', type: 'individual', duration: 15, effect: 'x2', icon: <Flame size={20} />, used: false },
  { id: 2, name: 'Recovery Boost', type: 'individual', duration: 0, effect: 'recovery', icon: <ShieldCheck size={20} />, used: false },
  { id: 3, name: 'GOAT Mode', type: 'individual', duration: 15, effect: 'x3', malus: 'Score = 0 if carded/concedes', icon: <Zap size={20} />, used: false },
  { id: 4, name: 'Extra Sub', type: 'team', duration: 0, effect: '+1 sub', icon: <Users size={20} />, used: false },
  { id: 5, name: 'Adrenaline Overdrive', type: 'individual', duration: 15, effect: 'no_fatigue_decay', malus: 'Fatigue = 0% after', icon: <Zap size={20} />, used: false },
  { id: 6, name: 'Let\'s Score', type: 'team', duration: 15, effect: 'goal_x3', malus: 'Concede = -5pts team-wide', icon: <Trophy size={20} />, used: false },
];
