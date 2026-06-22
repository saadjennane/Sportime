import { useEffect, useState } from 'react';
import { Flag } from 'lucide-react';
import { supabase } from '../lib/supabaseClient';
import { Spinner } from '../components/ui/States';
import { F1OddsAdmin } from '../components/F1OddsAdmin';
import { F1DuelsAdmin } from '../components/F1DuelsAdmin';
import { F1PredictorAdmin } from '../components/F1PredictorAdmin';
import { F1FantasyAdmin } from '../components/F1FantasyAdmin';

interface F1Market {
  key: string;
  label: string;
  type: string;
  scope: string;
  source: string;
  sort_order: number;
  is_visible: boolean;
}

const TYPE_LABEL: Record<string, string> = {
  outright: 'Outright · 1 winner',
  yesno_entity: 'Yes/No per entity',
  yesno_single: 'Yes/No',
};

function MarketsTab() {
  const [markets, setMarkets] = useState<F1Market[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    const { data } = await supabase.from('f1_markets').select('*').order('sort_order');
    setMarkets((data ?? []) as F1Market[]);
    setLoading(false);
  };
  useEffect(() => { load(); }, []);

  const toggle = async (m: F1Market) => {
    setBusy(m.key);
    setError(null);
    const next = !m.is_visible;
    setMarkets((prev) => prev.map((x) => (x.key === m.key ? { ...x, is_visible: next } : x))); // optimistic
    const { error: e } = await supabase.rpc('f1_set_market_visible', { p_key: m.key, p_visible: next });
    if (e) {
      setError(`Could not update "${m.label}": ${e.message}`);
      setMarkets((prev) => prev.map((x) => (x.key === m.key ? { ...x, is_visible: m.is_visible } : x))); // revert
    }
    setBusy(null);
  };

  const visibleCount = markets.filter((m) => m.is_visible).length;

  return (
    <div>
      <p className="text-text-secondary mb-5">
        Toggle which betting markets appear in the mobile app for Grands Prix.{' '}
        {!loading && <span className="font-semibold">{visibleCount}/{markets.length} visible.</span>}
      </p>

      {error && <div className="mb-4 p-3 rounded-lg bg-hot-red/10 text-hot-red text-sm">{error}</div>}

      {loading ? (
        <Spinner label="Loading markets…" />
      ) : (
        <div className="space-y-2">
          {markets.map((m) => (
            <div
              key={m.key}
              className="flex items-center justify-between gap-4 p-4 bg-surface border border-border-subtle rounded-xl"
            >
              <div className="min-w-0">
                <div className="font-semibold">{m.label}</div>
                <div className="text-xs text-text-secondary mt-0.5">
                  {TYPE_LABEL[m.type] ?? m.type} · {m.scope} ·{' '}
                  {m.source === 'derived' ? 'auto-derived' : 'manual odds'}
                </div>
              </div>
              <button
                onClick={() => toggle(m)}
                disabled={busy === m.key}
                aria-label={`Toggle ${m.label}`}
                className={`relative w-12 h-7 rounded-full transition-colors shrink-0 ${
                  m.is_visible ? 'bg-lime-glow' : 'bg-border-subtle'
                } ${busy === m.key ? 'opacity-50' : ''}`}
              >
                <span
                  className={`absolute top-0.5 left-0.5 w-6 h-6 rounded-full bg-white transition-transform ${
                    m.is_visible ? 'translate-x-5' : ''
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function F1Page() {
  const [tab, setTab] = useState<'markets' | 'odds' | 'duels' | 'predictor' | 'fantasy'>('markets');
  const TabBtn = ({ id, label }: { id: 'markets' | 'odds' | 'duels' | 'predictor' | 'fantasy'; label: string }) => (
    <button
      onClick={() => setTab(id)}
      className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
        tab === id ? 'bg-electric-blue text-white' : 'bg-surface border border-border-subtle text-text-secondary'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-3xl font-bold mb-5 flex items-center gap-2">
        <Flag className="w-7 h-7 text-electric-blue" /> Formula 1
      </h1>
      <div className="flex gap-2 mb-6">
        <TabBtn id="markets" label="Markets" />
        <TabBtn id="odds" label="Odds" />
        <TabBtn id="duels" label="Teammates Duels" />
        <TabBtn id="predictor" label="GP Predictor" />
        <TabBtn id="fantasy" label="Fantasy F1" />
      </div>
      {tab === 'markets' ? <MarketsTab /> : tab === 'odds' ? <F1OddsAdmin /> : tab === 'duels' ? <F1DuelsAdmin /> : tab === 'predictor' ? <F1PredictorAdmin /> : <F1FantasyAdmin />}
    </div>
  );
}
