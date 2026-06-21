import React, { useState } from 'react';
import { ChevronDown, Lock } from 'lucide-react';
import type { F1MarketView, F1Selection, F1Bet } from '../../features/f1/useRaceBetting';

interface Props {
  market: F1MarketView;
  bets: Map<string, F1Bet>;
  betKey: (marketKey: string, entityId: number | null, selection: string | null) => string;
  onPick: (sel: F1Selection) => void;
}

const TOP_N = 4;

export const F1MarketCard: React.FC<Props> = ({ market, bets, betKey, onPick }) => {
  const [expanded, setExpanded] = useState(false);

  const isOutright = market.type === 'outright';
  // For mutually-exclusive markets, the net of a winning pick is its return minus
  // ALL stakes placed in this market (covering). Recomputes as more picks are added.
  const totalStaked = market.selections.reduce((s, sel) => {
    const b = bets.get(betKey(market.key, sel.entityId, sel.selection));
    return s + (b?.stake ?? 0);
  }, 0);

  const shown = expanded ? market.selections : market.selections.slice(0, TOP_N);

  return (
    <div className="card-base p-3 space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-text-primary text-sm">{market.label}</h3>
        {market.locked && (
          <span className="flex items-center gap-1 text-[11px] text-text-secondary"><Lock size={11} /> Closed</span>
        )}
      </div>

      <div className="space-y-1.5">
        {shown.map((sel) => {
          const bet = bets.get(betKey(market.key, sel.entityId, sel.selection));
          const picked = !!bet;
          const net = bet
            ? (isOutright ? Math.ceil(bet.stake * bet.odds) - totalStaked : bet.potential_win - bet.stake)
            : 0;
          const initials = sel.label.slice(0, 2).toUpperCase();
          const isConstructor = market.scope === 'constructor';
          const num = sel.sublabel?.match(/#\d+/)?.[0];
          return (
            <button
              key={sel.key}
              disabled={market.locked}
              onClick={() => onPick(sel)}
              className={`w-full flex items-center gap-3 p-2.5 rounded-xl border text-left transition-colors disabled:opacity-50 ${
                picked ? 'border-electric-blue bg-electric-blue/10' : 'border-disabled bg-deep-navy'
              }`}
            >
              {isConstructor && sel.teamLogo
                ? <img src={sel.teamLogo} alt="" className="w-12 h-12 rounded-xl object-contain bg-white p-1.5 shrink-0" />
                : sel.image
                  ? <img src={sel.image} alt="" className="w-12 h-12 rounded-full object-cover bg-navy-accent shrink-0" />
                  : <div className="w-12 h-12 rounded-full bg-navy-accent flex items-center justify-center text-xs font-bold text-text-secondary shrink-0">{initials}</div>}
              <div className="min-w-0 flex-1">
                <div className="text-[15px] font-bold text-text-primary truncate leading-tight">{sel.label}</div>
                {picked
                  ? <div className="text-[11px] text-text-secondary mt-0.5">{bet!.stake.toLocaleString()} → <span className={net >= 0 ? 'text-lime-glow' : 'text-hot-red'}>{net >= 0 ? '+' : ''}{net.toLocaleString()}</span></div>
                  : !isConstructor && num && <div className="text-[11px] text-text-secondary tabular-nums mt-0.5">{num}</div>}
              </div>
              {!isConstructor && sel.teamLogo && <img src={sel.teamLogo} alt="" className="w-7 h-7 object-contain bg-white rounded-md p-0.5 shrink-0" />}
              <div className={`text-lg font-extrabold shrink-0 w-14 text-right ${picked ? 'text-electric-blue' : 'text-text-primary'}`}>{sel.odds.toFixed(2)}</div>
            </button>
          );
        })}
      </div>

      {market.selections.length > TOP_N && (
        <button onClick={() => setExpanded((v) => !v)} className="w-full flex items-center justify-center gap-1 py-1.5 text-xs font-semibold text-electric-blue">
          {expanded ? 'Show less' : `See all (${market.selections.length})`}
          <ChevronDown size={13} className={expanded ? 'rotate-180 transition-transform' : 'transition-transform'} />
        </button>
      )}
    </div>
  );
};

export default F1MarketCard;
