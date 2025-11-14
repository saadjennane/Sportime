import { PlayerGraph } from '../types';
import { subDays } from 'date-fns';

export const mockPlayerGraph: PlayerGraph = {
  'user-2': { playerId: 'user-2', username: 'JaneDoe', interactions: 12, lastInteraction: subDays(new Date(), 2).toISOString() },
  'user-3': { playerId: 'user-3', username: 'AlexRay', interactions: 8, lastInteraction: subDays(new Date(), 3).toISOString() },
};
