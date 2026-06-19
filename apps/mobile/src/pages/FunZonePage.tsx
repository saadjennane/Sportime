import React, { useState, useEffect } from 'react';
import { Check, Lock } from 'lucide-react';
import { Profile, SpinTier, UserSpinState } from '../types';
import { getUserSpinState } from '../services/spinService';
import { PullToRefresh } from '../components/PullToRefresh';
import { SpinwheelModal } from '../components/funzone/SpinwheelModal';
import { GamePreviewModal } from '../components/funzone/GamePreviewModal';

type SetupOption = { label: string; value: string | number; statsLevel?: string };
type SetupGroup = { title: string; options: SetupOption[] };
type DailyGame = {
  key: string; icon: string; label: string; accent: string;
  gameType: string; xp: number;
  statsLevel?: string;
  setups?: SetupGroup[];
  launch: (values: (string | number)[]) => void;
};

// Paid spinwheel tiers shown in the 2×2 grid under the featured Free spin.
const PAID_TIERS: { key: SpinTier; label: string; ring: string; text: string }[] = [
  { key: 'amateur', label: 'Amateur', ring: 'ring-lime-glow', text: 'text-lime-glow' },
  { key: 'master', label: 'Master', ring: 'ring-warm-yellow', text: 'text-warm-yellow' },
  { key: 'apex', label: 'Apex', ring: 'ring-hot-red', text: 'text-hot-red' },
  { key: 'premium', label: 'Premium', ring: 'ring-neon-cyan', text: 'text-neon-cyan' },
];
const FREE_COOLDOWN_MS = 24 * 3600 * 1000;
const fmtCountdown = (ms: number): string => {
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000);
  return h > 0 ? `in ${h}h ${m}m` : m > 0 ? `in ${m}m` : 'in <1m';
};
import { prefetchSpinSegments } from '../services/spinSegmentsService';
import { prefetchPlayerIndex } from '../services/playerIndexService';
import { prefetchPlayerToday, prefetchLineupToday, prefetchConnectionsToday, prefetchGridToday, prefetchRapidToday, prefetchHlToday,
  getPlayerToday, getLineupToday, getConnectionsToday, getGridToday, getRapidToday, getHlToday } from '../services/puzzleService';
import { prefetchGridIndex } from '../services/gridService';
import { prefetchValueIndex } from '../services/valueService';
import GuessPlayerGame from './GuessPlayerGame';
import GuessLineupGame from './GuessLineupGame';
import GuessConnectionsGame from './GuessConnectionsGame';
import GuessGridGame from './GuessGridGame';
import RapidFireGame from './RapidFireGame';
import HigherLowerGame from './HigherLowerGame';

interface FunZonePageProps {
  profile: Profile | null;
  addToast: (message: string, type: 'success' | 'error' | 'info') => void;
  onRequireAuth?: () => void;
}

const FunZonePage: React.FC<FunZonePageProps> = ({ profile, addToast, onRequireAuth }) => {
  const [spinState, setSpinState] = useState<UserSpinState | null>(null);
  const [openTier, setOpenTier] = useState<SpinTier | null>(null);
  const [openPlayerPuzzle, setOpenPlayerPuzzle] = useState(false);
  const [openLineupPuzzle, setOpenLineupPuzzle] = useState(false);
  const [openConnections, setOpenConnections] = useState(false);
  const [openGrid, setOpenGrid] = useState(false);
  const [openRapid, setOpenRapid] = useState(false);
  const [openHl, setOpenHl] = useState(false);
  const [doneMap, setDoneMap] = useState<Record<string, boolean>>({});
  const [now, setNow] = useState(Date.now());
  const [previewGame, setPreviewGame] = useState<DailyGame | null>(null);
  const [gridLevel, setGridLevel] = useState<string | undefined>(undefined);
  const [rapidLevel, setRapidLevel] = useState<string | undefined>(undefined);
  const [lineupHoles, setLineupHoles] = useState<number | undefined>(undefined);
  const [playerSetup, setPlayerSetup] = useState<{ scope?: string; hint?: string }>({});
  const [hlCriterion, setHlCriterion] = useState<string | undefined>(undefined);

  // Mark a game tile as "done today" when its play has a finished_at (same RPCs the prefetch warms).
  const loadDoneStates = async () => {
    if (!profile) { setDoneMap({}); return; }
    try {
      const [cn, pl, lu, gd, rf, hl] = await Promise.all([
        getConnectionsToday(), getPlayerToday(), getLineupToday(), getGridToday(), getRapidToday(), getHlToday(),
      ]);
      setDoneMap({
        connections: !!cn.play?.finished_at,
        player: !!pl.play?.finished_at,
        lineup: !!lu.play?.finished_at,
        grid: !!gd.play?.finished_at,
        rapid: !!rf.play?.finished_at,
        hl: !!hl.play?.finished_at,
      });
    } catch { /* keep previous state on error */ }
  };

  // Refresh everything the page shows: prefetch wheel/puzzle content + reload spin state + completion.
  const refresh = async () => {
    prefetchSpinSegments(); prefetchPlayerIndex(); prefetchPlayerToday(); prefetchLineupToday();
    prefetchConnectionsToday(); prefetchGridToday(); prefetchGridIndex(); prefetchRapidToday();
    prefetchHlToday(); prefetchValueIndex();
    loadDoneStates();
    if (profile) { try { setSpinState(await getUserSpinState(profile.id)); } catch {} }
  };

  // Prefetch wheel content so the modal opens instantly (only re-downloads on change).
  useEffect(() => { refresh(); }, []);

  // Tick every minute so the Free wheel flips to "Ready" and its countdown stays live.
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), 60000); return () => clearInterval(t); }, []);

  // Real spin availability — load the user's actual spin state (replaces the mock-ticket check).
  useEffect(() => {
    if (!profile) { setSpinState(null); setDoneMap({}); return; }
    let cancelled = false;
    getUserSpinState(profile.id).then(s => { if (!cancelled) setSpinState(s); }).catch(() => {});
    loadDoneStates();
    return () => { cancelled = true; };
  }, [profile?.id]);

  // Guests get a sign-up prompt instead of a silent dead tap.
  const requireAuth = (fn: () => void) => () => { if (!profile) { onRequireAuth?.(); return; } fn(); };

  // Any wheel opens the modal; the server RPC enforces eligibility (cooldown / no spins).
  const handleSpinwheelClick = (tier: SpinTier) => { if (!profile) { onRequireAuth?.(); return; } setOpenTier(tier); };

  // Daily games rendered as a compact icon grid. Tapping opens a pre-game modal
  // (stats per level + setup selector) which then launches the game.
  const DIFFICULTY_GROUP: SetupGroup = { title: 'Difficulty', options: [
    { label: 'Easy', value: 'easy', statsLevel: 'easy' },
    { label: 'Medium', value: 'medium', statsLevel: 'medium' },
    { label: 'Hard', value: 'hard', statsLevel: 'hard' },
  ] };
  const dailyGames: DailyGame[] = [
    { key: 'connections', icon: '🧠', label: 'Connections', accent: 'from-purple-500/30 to-electric-blue/10',
      gameType: 'connections', xp: 100, statsLevel: 'daily', launch: () => setOpenConnections(true) },
    { key: 'player', icon: '🕵️', label: 'Guess Player', accent: 'from-warm-yellow/30 to-hot-red/10',
      gameType: 'guess_player', xp: 100,
      setups: [
        { title: 'Teams', options: [
          { label: 'Big clubs', value: 'big', statsLevel: 'big' },
          { label: 'All teams', value: 'all', statsLevel: 'all' },
        ] },
        { title: 'Difficulty', options: [
          { label: 'Easy', value: 'easy' }, { label: 'Medium', value: 'medium' }, { label: 'Hard', value: 'hard' },
        ] },
      ],
      launch: ([scope, hint]) => { setPlayerSetup({ scope: scope as string, hint: hint as string }); setOpenPlayerPuzzle(true); } },
    { key: 'lineup', icon: '🧩', label: 'Guess Lineup', accent: 'from-emerald-500/30 to-electric-blue/10',
      gameType: 'guess_lineup', xp: 100,
      setups: [{ title: 'Difficulty · players to find', options: [
        { label: 'Easy · 3', value: 3, statsLevel: 'big_3' },
        { label: 'Medium · 6', value: 6, statsLevel: 'big_6' },
        { label: 'Hard · 11', value: 11, statsLevel: 'big_11' },
      ] }],
      launch: ([holes]) => { setLineupHoles(holes as number); setOpenLineupPuzzle(true); } },
    { key: 'grid', icon: '⬛', label: 'Box2Box', accent: 'from-hot-red/30 to-warm-yellow/10',
      gameType: 'grid', xp: 100, setups: [DIFFICULTY_GROUP],
      launch: ([lvl]) => { setGridLevel(lvl as string); setOpenGrid(true); } },
    { key: 'rapid', icon: '⚡', label: 'Rapid Fire', accent: 'from-warm-yellow/30 to-lime-glow/10',
      gameType: 'rapid', xp: 50, setups: [DIFFICULTY_GROUP],
      launch: ([lvl]) => { setRapidLevel(lvl as string); setOpenRapid(true); } },
    { key: 'hl', icon: '⬆️', label: 'Higher/Lower', accent: 'from-lime-glow/30 to-emerald-500/10',
      gameType: 'higherlower', xp: 50,
      setups: [{ title: 'Stat', options: [
        { label: '💰 Market value', value: 'value', statsLevel: 'value' },
        { label: '📈 Peak value', value: 'peak', statsLevel: 'peak' },
        { label: '🔁 Transfer fee', value: 'fee', statsLevel: 'fee' },
        { label: '🎂 Age', value: 'age', statsLevel: 'age' },
        { label: '📏 Height', value: 'height', statsLevel: 'height' },
        { label: '🏆 Trophies', value: 'trophies', statsLevel: 'trophies' },
        { label: '🧳 Clubs', value: 'clubs', statsLevel: 'clubs' },
      ] }],
      launch: ([crit]) => { setHlCriterion(crit as string); setOpenHl(true); } },
  ];

  const checkSpinAvailability = (tier: SpinTier): boolean => {
    if (!profile) return false;
    if (tier === 'free') {
      if (!spinState?.lastFreeSpinAt) return true; // never used → free spin ready
      return Date.now() - new Date(spinState.lastFreeSpinAt).getTime() >= 24 * 3600 * 1000;
    }
    return (spinState?.availableSpins?.[tier] ?? 0) > 0;
  };

  return (
    <>
      <PullToRefresh onRefresh={refresh}>
      <div className="space-y-6">
        <div className="text-center">
          <h1 className="text-3xl font-bold text-text-primary">FunZone 🎮</h1>
          <p className="text-text-secondary mt-1">Play daily games and spin your way to rewards!</p>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Daily Games</h2>
          <div className="grid grid-cols-3 gap-2">
            {dailyGames.map(g => {
              const done = doneMap[g.key];
              return (
                <button
                  key={g.key}
                  onClick={requireAuth(() => setPreviewGame(g))}
                  className={`relative flex flex-col items-center gap-2 p-3 rounded-2xl card-base active:scale-[0.97] transition-transform ${done ? 'ring-2 ring-lime-glow' : ''}`}
                >
                  {done && (
                    <span className="absolute top-1.5 left-1.5 w-5 h-5 rounded-full bg-lime-glow flex items-center justify-center shadow">
                      <Check size={13} strokeWidth={3} className="text-deep-navy" />
                    </span>
                  )}
                  <div className={`w-14 h-14 rounded-xl bg-gradient-to-br ${g.accent} flex items-center justify-center text-2xl`}>{g.icon}</div>
                  <span className="text-xs font-bold text-text-primary text-center leading-tight">{g.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold text-text-primary">Spinwheels</h2>

          {/* Featured daily Free spin */}
          {(() => {
            const lastFree = spinState?.lastFreeSpinAt ? new Date(spinState.lastFreeSpinAt).getTime() : null;
            const ready = !lastFree || now - lastFree >= FREE_COOLDOWN_MS;
            const remaining = lastFree ? lastFree + FREE_COOLDOWN_MS - now : 0;
            return (
              <button
                onClick={() => handleSpinwheelClick('free')}
                className={`w-full flex items-center gap-3 p-4 rounded-2xl card-base text-left active:scale-[0.99] transition-transform ${ready ? 'ring-2 ring-lime-glow' : ''}`}
              >
                <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-lime-glow/30 to-lime-glow/5 flex items-center justify-center text-2xl flex-shrink-0">🎡</div>
                <div className="flex-1 min-w-0">
                  <p className="font-extrabold text-text-primary">Free Spin</p>
                  <p className={`text-xs font-semibold ${ready ? 'text-lime-glow' : 'text-text-secondary'}`}>
                    {ready ? '● Ready · spin once daily' : `Next spin ${fmtCountdown(remaining)}`}
                  </p>
                </div>
                <span className={`px-4 py-2 rounded-xl text-sm font-bold flex-shrink-0 ${ready ? 'primary-button' : 'bg-navy-accent text-text-secondary'}`}>
                  {ready ? 'Spin' : 'Soon'}
                </span>
              </button>
            );
          })()}

          {/* Ticket / subscriber wheels */}
          <div className="grid grid-cols-2 gap-2">
            {PAID_TIERS.map(t => {
              const count = spinState?.availableSpins?.[t.key] ?? 0;
              const avail = checkSpinAvailability(t.key);
              return (
                <button
                  key={t.key}
                  onClick={() => handleSpinwheelClick(t.key)}
                  className={`flex flex-col gap-1 p-3 rounded-2xl card-base text-left active:scale-[0.97] transition-transform ${avail ? `ring-2 ${t.ring}` : 'opacity-60'}`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-text-primary text-sm">{t.label}</span>
                    {avail
                      ? <span className={`text-xs font-extrabold ${t.text}`}>×{count}</span>
                      : <Lock size={13} className="text-text-disabled" />}
                  </div>
                  <span className={`text-[11px] font-semibold ${avail ? t.text : 'text-text-disabled'}`}>
                    {avail ? '● available' : t.key === 'premium' ? 'Members only' : '0 · get ticket'}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
      </PullToRefresh>

      {profile && openTier && (
        <SpinwheelModal
          isOpen={!!openTier}
          onClose={() => setOpenTier(null)}
          tier={openTier}
          userId={profile.id}
          addToast={addToast}
        />
      )}
      {previewGame && (
        <GamePreviewModal
          meta={{ icon: previewGame.icon, label: previewGame.label, accent: previewGame.accent,
            gameType: previewGame.gameType, xp: previewGame.xp, statsLevel: previewGame.statsLevel, setups: previewGame.setups }}
          done={!!doneMap[previewGame.key]}
          onClose={() => setPreviewGame(null)}
          onPlay={(v) => { previewGame.launch(v); setPreviewGame(null); }}
        />
      )}
      {profile && openConnections && (
        <GuessConnectionsGame userId={profile.id} onBack={() => setOpenConnections(false)} addToast={addToast} />
      )}
      {profile && openGrid && (
        <GuessGridGame userId={profile.id} initialLevel={gridLevel} onBack={() => setOpenGrid(false)} addToast={addToast} />
      )}
      {profile && openRapid && (
        <RapidFireGame userId={profile.id} initialLevel={rapidLevel} onBack={() => setOpenRapid(false)} addToast={addToast} />
      )}
      {profile && openHl && (
        <HigherLowerGame userId={profile.id} initialCriterion={hlCriterion} onBack={() => setOpenHl(false)} addToast={addToast} />
      )}
      {profile && openPlayerPuzzle && (
        <GuessPlayerGame userId={profile.id} initialScope={playerSetup.scope as any} initialHint={playerSetup.hint as any} onBack={() => setOpenPlayerPuzzle(false)} addToast={addToast} />
      )}
      {profile && openLineupPuzzle && (
        <GuessLineupGame userId={profile.id} initialHoles={lineupHoles} onBack={() => setOpenLineupPuzzle(false)} addToast={addToast} />
      )}
    </>
  );
};

export default FunZonePage;
