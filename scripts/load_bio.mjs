import { readFileSync } from 'node:fs';
const BASE='https://crypuzduplbzbmvefvzr.supabase.co';
const ANON='eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNyeXB1emR1cGxiemJtdmVmdnpyIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTk4MjA1NjgsImV4cCI6MjA3NTM5NjU2OH0.jsUTKfIjsLF2wlbBPeJDlFPj2ICozE6VaqYA7egKrsQ';
function pcsv(t){const r=[];let row=[],f='',q=false;for(let i=0;i<t.length;i++){const c=t[i];if(q){if(c==='"'){if(t[i+1]==='"'){f+='"';i++}else q=false}else f+=c}else if(c==='"')q=true;else if(c===','){row.push(f);f=''}else if(c==='\n'){row.push(f);r.push(row);row=[];f=''}else if(c!=='\r')f+=c}if(f.length||row.length){row.push(f);r.push(row)}return r}
const tok=await(await fetch(`${BASE}/auth/v1/token?grant_type=password`,{method:'POST',headers:{apikey:ANON,'Content-Type':'application/json'},body:JSON.stringify({email:'admin@sportime.app',password:'Sportime-Admin-2026'})})).json();
const jwt=tok.access_token;
const rows=pcsv(readFileSync('scripts/tm_out/tm_players_bio.csv','utf8')).filter(r=>r.length>1);
const h=rows.shift();
const recs=rows.map(r=>{const o={};h.forEach((k,i)=>o[k]=r[i]);return o}).filter(o=>o.player_id);
let done=0;const num=v=>{const n=Number(String(v).replace(/[^0-9.\-]/g,''));return Number.isFinite(n)?Math.round(n):null};
for(let i=0;i<recs.length;i+=20){
  await Promise.all(recs.slice(i,i+20).map(async o=>{
    const body={photo_url:o.photo_url&&o.photo_url!=='NA'?o.photo_url:null, birth_place:o.birth_place&&o.birth_place!=='NA'?o.birth_place:null, max_market_value_eur:num(o.max_market_value_eur)};
    const res=await fetch(`${BASE}/rest/v1/tm_players?player_id=eq.${o.player_id}`,{method:'PATCH',headers:{apikey:ANON,Authorization:`Bearer ${jwt}`,'Content-Type':'application/json',Prefer:'return=minimal'},body:JSON.stringify(body)});
    if(res.ok)done++;
  }));
}
console.log(`bio patched: ${done}/${recs.length}`);
