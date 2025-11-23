import { CoinPack } from '../types';

export const COIN_PACKS: CoinPack[] = [
  { id: 'starter', name: 'Starter Pack', priceEUR: 1.99, coins: 4000, bonus: 0, valuePerCoin: 0.00050 },
  { id: 'rookie', name: 'Rookie Pack', priceEUR: 3.99, coins: 8500, bonus: 6, valuePerCoin: 0.00047 },
  { id: 'pro', name: 'Pro Pack', priceEUR: 6.99, coins: 15000, bonus: 8, valuePerCoin: 0.00046 },
  { id: 'elite', name: 'Elite Pack', priceEUR: 9.99, coins: 22000, bonus: 10, valuePerCoin: 0.00045, isBestValue: true },
  { id: 'master', name: 'Master Pack', priceEUR: 19.99, coins: 45000, bonus: 20, valuePerCoin: 0.00044, isBestValue: true },
];
