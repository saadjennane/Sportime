import { useState } from 'react';
import { Trash2, GripVertical, Plus, X } from 'lucide-react';
import type { RewardItem, RewardTier } from '../services/rewardService';
import { createRewardPack, updateRewardPack } from '../services/rewardService';

const PALETTE: { type: string; label: string; cls: string }[] = [
  { type: 'coins', label: 'Coins', cls: 'bg-warm-yellow/15 text-warm-yellow border-warm-yellow/30' },
  { type: 'xp', label: 'XP', cls: 'bg-electric-blue/15 text-electric-blue border-electric-blue/30' },
  { type: 'ticket', label: 'Ticket', cls: 'bg-lime-glow/15 text-lime-glow border-lime-glow/30' },
  { type: 'spin', label: 'Spin', cls: 'bg-neon-cyan/15 text-neon-cyan border-neon-cyan/30' },
  { type: 'giftcard', label: 'Gift card', cls: 'bg-[#D500F9]/15 text-[#D500F9] border-[#D500F9]/30' },
  { type: 'masterpass', label: 'Master Pass', cls: 'bg-hot-red/15 text-hot-red border-hot-red/30' },
  { type: 'premium_3d', label: 'Premium 3d', cls: 'bg-purple-400/15 text-purple-300 border-purple-400/30' },
  { type: 'premium_7d', label: 'Premium 7d', cls: 'bg-purple-400/15 text-purple-300 border-purple-400/30' },
  { type: 'custom', label: 'Custom', cls: 'bg-text-disabled/15 text-text-secondary border-border-subtle' },
];
const TICKET_TIERS = ['amateur', 'master', 'apex'];
const SPIN_TIERS = ['free', 'amateur', 'master', 'apex', 'premium'];
const FIELDS: Record<string, string[]> = {
  coins: ['value'], xp: ['value'], ticket: ['ticketTier'], spin: ['spinTier'],
  giftcard: ['value', 'name'], masterpass: [], premium_3d: [], premium_7d: [], custom: ['name'],
};

let idc = 0;
const newId = () => `t${Date.now().toString(36)}_${idc++}`;

export function RewardPackBuilder({ initialPack, onSaved, onClose }: { initialPack?: any; onSaved: () => void; onClose: () => void }) {
  const [name, setName] = useState(initialPack?.name ?? '');
  const [tiers, setTiers] = useState<RewardTier[]>(initialPack?.tiers ?? []);
  const [players, setPlayers] = useState(100);
  const [msg, setMsg] = useState('');

  const addTier = (positionType: RewardTier['positionType']) =>
    setTiers([...tiers, { id: newId(), positionType, start: 1, end: positionType === 'rank' ? 1 : 10, rewards: [] }]);
  const patchTier = (id: string, patch: Partial<RewardTier>) => setTiers(tiers.map(t => t.id === id ? { ...t, ...patch } : t));
  const removeTier = (id: string) => setTiers(tiers.filter(t => t.id !== id));
  const dropItem = (tierId: string, type: string) => {
    const item: RewardItem = { type, quantity: 1 };
    if (type === 'ticket') item.tier = 'amateur'; if (type === 'spin') item.tier = 'free';
    if (type === 'coins') item.value = 1000; if (type === 'xp') item.value = 100; if (type === 'giftcard') item.value = 10;
    patchTier(tierId, { rewards: [...(tiers.find(t => t.id === tierId)?.rewards ?? []), item] });
  };
  const patchItem = (tierId: string, idx: number, patch: Partial<RewardItem>) => {
    const t = tiers.find(x => x.id === tierId); if (!t) return;
    patchTier(tierId, { rewards: t.rewards.map((r, i) => i === idx ? { ...r, ...patch } : r) });
  };
  const removeItem = (tierId: string, idx: number) => {
    const t = tiers.find(x => x.id === tierId); if (!t) return;
    patchTier(tierId, { rewards: t.rewards.filter((_, i) => i !== idx) });
  };

  // Validation: no overlapping rank/range positions; percent total ≤ 100.
  const overlaps: string[] = [];
  const ranked = tiers.filter(t => t.positionType === 'rank' || t.positionType === 'range');
  for (let i = 0; i < ranked.length; i++) for (let j = i + 1; j < ranked.length; j++) {
    const a = ranked[i], b = ranked[j];
    if (a.start <= b.end && b.start <= a.end) overlaps.push(`Positions ${a.start}-${a.end} & ${b.start}-${b.end} overlap`);
  }
  const pctTotal = tiers.filter(t => t.positionType === 'percent').reduce((s, t) => s + (t.end || 0), 0);
  if (pctTotal > 100) overlaps.push(`Percent tiers total ${pctTotal}% > 100%`);

  const winnersOf = (t: RewardTier) =>
    t.positionType === 'rank' ? 1 : t.positionType === 'range' ? Math.max(0, t.end - t.start + 1)
    : t.positionType === 'percent' ? Math.round(players * (t.end / 100)) : players;
  const totalCoins = tiers.reduce((s, t) => s + winnersOf(t) * t.rewards.filter(r => r.type === 'coins').reduce((a, r) => a + (r.value || 0) * r.quantity, 0), 0);
  const totalItems = tiers.reduce((s, t) => s + winnersOf(t) * t.rewards.filter(r => r.type !== 'coins').reduce((a, r) => a + r.quantity, 0), 0);

  const save = async () => {
    if (!name) return setMsg('Name the pack first');
    if (overlaps.length) return setMsg('Fix overlaps before saving');
    const res = initialPack?.id ? await updateRewardPack(initialPack.id, { name, tiers }) : await createRewardPack(name, tiers);
    if ((res as any).error) return setMsg((res as any).error.message);
    onSaved();
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-surface border border-border-subtle rounded-xl w-full max-w-5xl max-h-[90vh] overflow-y-auto p-5" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <input value={name} onChange={e => setName(e.target.value)} placeholder="Reward pack name" className="inp w-72 text-base font-semibold" />
          <button onClick={onClose} className="text-text-secondary"><X size={20} /></button>
        </div>

        <div className="grid grid-cols-[1fr_220px] gap-4">
          {/* LEFT — the pack (brackets + drop zones) */}
          <div className="space-y-3">
            <div className="flex gap-2">
              {(['rank', 'range', 'percent', 'participation'] as const).map(pt => (
                <button key={pt} onClick={() => addTier(pt)} className="flex items-center gap-1 bg-background-dark border border-border-subtle text-text-secondary px-2.5 py-1.5 rounded-lg text-xs font-semibold capitalize">
                  <Plus size={13} /> {pt}
                </button>
              ))}
            </div>

            {tiers.length === 0 && <div className="text-text-disabled text-sm border border-dashed border-border-subtle rounded-lg p-6 text-center">Add a bracket (rank / range / percent / participation), then drag rewards from the right.</div>}

            {tiers.map(t => (
              <div key={t.id} className="border border-border-subtle rounded-lg p-3 bg-background-dark/40"
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); dropItem(t.id, e.dataTransfer.getData('text/plain')); }}>
                <div className="flex items-center gap-2 mb-2">
                  <GripVertical size={14} className="text-text-disabled" />
                  <span className="text-xs font-bold uppercase text-text-secondary">{t.positionType}</span>
                  {t.positionType === 'rank' && <PosInput label="Position" v={t.start} on={n => patchTier(t.id, { start: n, end: n })} />}
                  {t.positionType === 'range' && <><PosInput label="From" v={t.start} on={n => patchTier(t.id, { start: n })} /><PosInput label="To" v={t.end} on={n => patchTier(t.id, { end: n })} /></>}
                  {t.positionType === 'percent' && <PosInput label="Top %" v={t.end} on={n => patchTier(t.id, { start: 1, end: n })} />}
                  {t.positionType === 'participation' && <span className="text-xs text-text-disabled">everyone (1 → {players})</span>}
                  <span className="ml-auto text-xs text-text-disabled">{winnersOf(t)} winner(s)</span>
                  <button onClick={() => removeTier(t.id)} className="text-hot-red"><Trash2 size={14} /></button>
                </div>
                <div className="flex flex-wrap gap-2 min-h-[40px]">
                  {t.rewards.length === 0 && <span className="text-text-disabled text-xs self-center px-2">Drop rewards here…</span>}
                  {t.rewards.map((r, i) => (
                    <div key={i} className="flex items-center gap-1.5 bg-surface border border-border-subtle rounded-lg px-2 py-1.5 text-xs">
                      <span className="font-semibold capitalize text-text-primary">{r.type.replace('_', ' ')}</span>
                      {FIELDS[r.type]?.includes('value') && <input type="number" value={r.value ?? 0} onChange={e => patchItem(t.id, i, { value: Number(e.target.value) })} className="w-16 bg-background-dark rounded px-1 py-0.5 text-text-primary" />}
                      {FIELDS[r.type]?.includes('ticketTier') && <select value={r.tier} onChange={e => patchItem(t.id, i, { tier: e.target.value })} className="bg-background-dark rounded px-1 py-0.5 text-text-primary capitalize">{TICKET_TIERS.map(x => <option key={x}>{x}</option>)}</select>}
                      {FIELDS[r.type]?.includes('spinTier') && <select value={r.tier} onChange={e => patchItem(t.id, i, { tier: e.target.value })} className="bg-background-dark rounded px-1 py-0.5 text-text-primary capitalize">{SPIN_TIERS.map(x => <option key={x}>{x}</option>)}</select>}
                      {FIELDS[r.type]?.includes('name') && <input value={r.name ?? ''} onChange={e => patchItem(t.id, i, { name: e.target.value })} placeholder="name" className="w-20 bg-background-dark rounded px-1 py-0.5 text-text-primary" />}
                      <span className="text-text-disabled">×</span>
                      <input type="number" min={1} value={r.quantity} onChange={e => patchItem(t.id, i, { quantity: Number(e.target.value) })} className="w-10 bg-background-dark rounded px-1 py-0.5 text-text-primary" />
                      <button onClick={() => removeItem(t.id, i)} className="text-hot-red ml-0.5"><X size={12} /></button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* RIGHT — palette */}
          <div className="space-y-2">
            <p className="text-xs text-text-disabled font-semibold uppercase">Drag a reward →</p>
            {PALETTE.map(p => (
              <div key={p.type} draggable onDragStart={e => e.dataTransfer.setData('text/plain', p.type)}
                className={`cursor-grab active:cursor-grabbing border rounded-lg px-3 py-2 text-sm font-semibold ${p.cls}`}>{p.label}</div>
            ))}
          </div>
        </div>

        {/* Footer — validation + prize pool */}
        <div className="mt-4 border-t border-border-subtle pt-3 space-y-2">
          {overlaps.map((o, i) => <p key={i} className="text-hot-red text-xs">⚠ {o}</p>)}
          <div className="flex items-center gap-4 text-sm">
            <label className="flex items-center gap-1 text-text-secondary text-xs">Players (estimate) <input type="number" value={players} onChange={e => setPlayers(Number(e.target.value))} className="w-20 inp inline-block" /></label>
            <span className="text-text-secondary">Prize pool: <b className="text-warm-yellow">{totalCoins.toLocaleString()}</b> coins + <b className="text-electric-blue">{totalItems}</b> items</span>
            {msg && <span className="text-hot-red text-xs">{msg}</span>}
            <button onClick={save} disabled={overlaps.length > 0} className="ml-auto bg-lime-glow text-deep-navy font-bold px-5 py-2 rounded-lg disabled:opacity-40">Save pack</button>
          </div>
        </div>
      </div>
    </div>
  );
}

function PosInput({ label, v, on }: { label: string; v: number; on: (n: number) => void }) {
  return <label className="flex items-center gap-1 text-xs text-text-secondary">{label}<input type="number" min={1} value={v} onChange={e => on(Number(e.target.value))} className="w-14 bg-background-dark border border-border-subtle rounded px-1.5 py-0.5 text-text-primary" /></label>;
}
