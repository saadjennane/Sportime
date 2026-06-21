import React, { createContext, useContext, useMemo, useState } from 'react';

// The selected "universe". Football is the existing app; F1 swaps the sport-specific
// tabs (Races / F1 Games / F1 Fan Pulse) while Squads + Profile stay shared.
export type Sport = 'football' | 'f1';

const STORAGE_KEY = 'sportime.sport';

interface SportContextValue {
  sport: Sport;
  setSport: (s: Sport) => void;
}

const SportContext = createContext<SportContextValue>({ sport: 'football', setSport: () => {} });

export const SportProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sport, setSportState] = useState<Sport>(() => {
    try { return localStorage.getItem(STORAGE_KEY) === 'f1' ? 'f1' : 'football'; } catch { return 'football'; }
  });
  const setSport = (s: Sport) => {
    setSportState(s);
    try { localStorage.setItem(STORAGE_KEY, s); } catch { /* ignore */ }
  };
  const value = useMemo(() => ({ sport, setSport }), [sport]);
  return <SportContext.Provider value={value}>{children}</SportContext.Provider>;
};

export const useSport = () => useContext(SportContext);
