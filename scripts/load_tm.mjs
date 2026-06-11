// Load the CSVs produced by seed_transfermarkt.R into Supabase tm_* tables.
// Usage: node scripts/load_tm.mjs   (reads scripts/tm_out/*.csv, upserts as admin)
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const BASE = 'https://crypuzduplbzbmvefvzr.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ';
const OUT = 'scripts/tm_out';

// table -> { file, conflict (columns for upsert), numeric (cols to cast) }
const TABLES = [
  { t: 'tm_leagues',            f: 'tm_leagues.csv',            c: 'league_id' },
  { t: 'tm_clubs',              f: 'tm_clubs.csv',              c: 'club_id',  num: ['club_id'] },
  { t: 'tm_club_seasons',       f: 'tm_club_seasons.csv',       c: 'league_id,season,club_id', num: ['season','club_id'] },
  { t: 'tm_players',            f: 'tm_players.csv',            c: 'player_id', num: ['player_id','height_cm','current_market_value_eur'] },
  { t: 'tm_squad_memberships',  f: 'tm_squad_memberships.csv',  c: 'player_id,club_id,season', num: ['player_id','club_id','season','age','market_value_eur'] },
  { t: 'tm_transfers',          f: 'tm_transfers.csv',          c: 'player_id,transfer_date,to_club_id,from_club_id', num: ['player_id','from_club_id','to_club_id','fee_eur','market_value_eur'] },
  { t: 'tm_market_values',      f: 'tm_market_values.csv',      c: 'player_id,value_date', num: ['player_id','value_eur','club_id'] },
];

function parseCSV(text) {
  const rows = []; let row = [], field = '', q = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (q) { if (ch === '"') { if (text[i + 1] === '"') { field += '"'; i++; } else q = false; } else field += ch; }
    else if (ch === '"') q = true;
    else if (ch === ',') { row.push(field); field = ''; }
    else if (ch === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else if (ch !== '\r') field += ch;
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows;
}

async function token() {
  const r = await fetch(`${BASE}/auth/v1/token?grant_type=password`, {
    method: 'POST', headers: { apikey: ANON, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@sportime.app', password: 'Sportime-Admin-2026' }),
  });
  return (await r.json()).access_token;
}

async function load(jwt, { t, f, c, num = [] }) {
  const path = join(OUT, f);
  if (!existsSync(path)) { console.log(`skip ${f} (missing)`); return; }
  const rows = parseCSV(readFileSync(path, 'utf8')).filter(r => r.length > 1);
  const header = rows.shift();
  const records = rows.map(r => {
    const o = {};
    header.forEach((h, i) => {
      let v = r[i];
      if (v === '' || v === 'NA' || v === 'NULL' || v == null) { o[h] = null; return; }
      o[h] = num.includes(h) ? Number(String(v).replace(/[^0-9.\-]/g, '')) || null : v;
    });
    return o;
  });
  let done = 0;
  for (let i = 0; i < records.length; i += 500) {
    const batch = records.slice(i, i + 500);
    const res = await fetch(`${BASE}/rest/v1/${t}?on_conflict=${encodeURIComponent(c)}`, {
      method: 'POST',
      headers: { apikey: ANON, Authorization: `Bearer ${jwt}`, 'Content-Type': 'application/json', Prefer: 'resolution=merge-duplicates,return=minimal' },
      body: JSON.stringify(batch),
    });
    if (!res.ok) { console.error(`  ${t} batch failed:`, await res.text()); break; }
    done += batch.length;
  }
  console.log(`${t}: ${done}/${records.length} rows`);
}

const jwt = await token();
for (const spec of TABLES) await load(jwt, spec);
console.log('done');
