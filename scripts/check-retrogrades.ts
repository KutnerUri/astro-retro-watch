// Compares data/retrogrades.json with Swiss Ephemeris station times for 2013–2031.
// Run: bun scripts/check-retrogrades.ts
export {}; // a module, so top-level await is allowed
const old = await Bun.file('scripts/fixtures/swisseph-2013-2031.json').json() as any[];
const neu = (await Bun.file('data/retrogrades.json').json()).planets as Record<string,[string,string][]>;
const ms = (s: string) => Date.parse(s.endsWith('Z') ? s : s + 'Z');
const stats: Record<string,{n:number,miss:number,max:number,sum:number}> = {};
for (const o of old) {
  if (o.clipped_at_chart_boundary) continue;
  const s = stats[o.planet] ??= {n:0,miss:0,max:0,sum:0};
  const a = ms(o.start_utc), b = ms(o.end_utc);
  const m = neu[o.planet].find(([x,y]) => Math.abs(ms(x)-a) < 5*86400e3);
  if (!m) { s.miss++; console.log('missing', o.planet, o.start_utc); continue; }
  for (const d of [Math.abs(ms(m[0])-a), Math.abs(ms(m[1])-b)]) { s.n++; s.sum+=d; s.max=Math.max(s.max,d); }
}
for (const [p,s] of Object.entries(stats)) console.log(p.padEnd(8), 'stations', s.n, 'missing', s.miss, 'mean min', (s.sum/s.n/60e3).toFixed(1), 'max min', (s.max/60e3).toFixed(1));
