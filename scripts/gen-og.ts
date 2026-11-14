/**
 * Generates public/og.png, the 1200×630 image shown when the site is shared.
 * It draws the years view as of today, so it runs before every (daily) build.
 *
 * Run: bun scripts/gen-og.ts
 */
import { Resvg } from '@resvg/resvg-js';
import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line } from 'd3-shape';
import { PLANETS, periods, sampleOverlap } from '../src/lib/retro';

const W = 1200;
const H = 630;
const DAY = 86_400_000;
// Same as the --planet-* colours in src/styles/base.css.
const COLORS = ['#9aa0d0', '#f4e9c8', '#e8412f', '#efb27a', '#a8861c', '#33b8c8', '#4d6cf2'];
const BG = '#07080d';
const INK = '#f4eedc';

const today = Date.now();
const addYears = (t: number, n: number) => {
  const d = new Date(t);
  return Date.UTC(d.getUTCFullYear() + n, d.getUTCMonth(), d.getUTCDate());
};
const from = addYears(today, -5);
const to = addYears(today, 5);

const left = 140;
const right = W - 60;
const curveTop = 200;
const curveBottom = 400;
const ganttTop = 422;
const rowH = 22;

const x = scaleUtc().domain([from, to]).range([left, right]);
const samples = sampleOverlap(from, to, DAY);
const max = Math.max(3, Math.ceil(Math.max(...samples.map((s) => s[1]))));
const y = scaleLinear().domain([0, max]).range([curveBottom, curveTop]);

const areaPath = area<[number, number]>().x((d) => x(d[0])).y0(curveBottom).y1((d) => y(d[1]))(samples);
const linePath = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]))(samples);

const bars = PLANETS.flatMap((planet, i) => {
  const rowY = ganttTop + i * rowH;
  const label = `<text x="${left - 14}" y="${rowY + rowH / 2 + 5}" text-anchor="end" fill="#b7b8cc" font-size="15">${planet}</text>`;
  const rects = periods[planet]
    .filter((p) => p.end > from && p.start < to)
    .map((p) => {
      const a = Math.max(x(p.start), left);
      const b = Math.min(x(p.end), right);
      return `<rect x="${a}" y="${rowY + 5}" width="${Math.max(3, b - a)}" height="12" rx="3" fill="${COLORS[i]}"/>`;
    });
  return [label, ...rects];
});

const years: string[] = [];
for (let yr = new Date(from).getUTCFullYear() + 1; yr <= new Date(to).getUTCFullYear(); yr++) {
  const tx = x(Date.UTC(yr, 0, 1));
  years.push(`<text x="${tx}" y="${ganttTop + PLANETS.length * rowH + 22}" text-anchor="middle" fill="#7c7e96" font-size="14">${yr}</text>`);
}

const tx = x(today);
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Helvetica, Arial, DejaVu Sans, sans-serif">
  <rect width="${W}" height="${H}" fill="${BG}"/>
  <text x="${left - 80}" y="96" fill="${INK}" font-size="60" font-weight="700">Retro Watch</text>
  <text x="${left - 80}" y="142" fill="#b7b8cc" font-size="26">Which planets are retrograde, and when they overlap</text>
  <path d="${areaPath}" fill="${INK}" fill-opacity="0.08"/>
  <path d="${linePath}" fill="none" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>
  <line x1="${left}" x2="${right}" y1="${curveBottom}" y2="${curveBottom}" stroke="#34374d"/>
  ${bars.join('\n  ')}
  ${years.join('\n  ')}
  <line x1="${tx}" x2="${tx}" y1="${curveTop - 14}" y2="${ganttTop + PLANETS.length * rowH}" stroke="${INK}" stroke-width="2"/>
  <text x="${tx}" y="${curveTop - 22}" text-anchor="middle" fill="${INK}" font-size="16" font-weight="700">Today</text>
</svg>`;

const png = new Resvg(svg, { font: { loadSystemFonts: true, defaultFontFamily: 'DejaVu Sans' } }).render().asPng();
await Bun.write(new URL('../public/og.png', import.meta.url), png);
console.log(`public/og.png ${(png.length / 1024).toFixed(0)} KB`);
