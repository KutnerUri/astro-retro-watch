import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line } from 'd3-shape';
import { PLANETS, periods, sampleOverlap, type Planet } from './retro';

export interface ChartOptions {
  from: number;
  to: number;
  today: number;
  /** Sampling step for the overlap curve, ms. */
  step: number;
  /** Axis ticks: returns tick dates and a label formatter. */
  ticks: (from: Date, to: Date) => { values: Date[]; format: (d: Date) => string };
  /** Optional shaded window, e.g. the months view inside the years view. */
  highlight?: [number, number];
  /** Formats the date in the hover tooltip. */
  hoverFormat: (d: Date) => string;
  /** Row / peak label for a planet. Defaults to its name. */
  label?: (p: Planet) => string;
  /** Left margin in px (room for row labels). */
  left?: number;
  /** Hide the overlap scale numbers. */
  hideScale?: boolean;
  /** Centre row labels in the left margin (for single-glyph labels). */
  centerLabels?: boolean;
}

const NS = 'http://www.w3.org/2000/svg';
const BASE_M = { top: 22, right: 8, left: 72 };
const CURVE_H = 120;
const GAP = 14;
const ROW_H = 20;
const BAR_H = 10;
const AXIS_H = 26;

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number> = {}, parent?: Element) {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

const color = (p: Planet) => `var(--planet-${p.toLowerCase()})`;

export function renderChart(container: HTMLElement, o: ChartOptions) {
  container.replaceChildren();
  const M = { ...BASE_M, left: o.left ?? BASE_M.left };
  const label = o.label ?? ((p: Planet) => p);
  const width = Math.max(320, container.clientWidth);
  const ganttTop = M.top + CURVE_H + GAP;
  const ganttH = PLANETS.length * ROW_H;
  const height = ganttTop + ganttH + AXIS_H;

  const x = scaleUtc().domain([o.from, o.to]).range([M.left, width - M.right]);
  const samples = sampleOverlap(o.from, o.to, o.step);
  const max = Math.max(3, Math.ceil(Math.max(...samples.map((s) => s[1]))));
  const y = scaleLinear().domain([0, max]).range([M.top + CURVE_H, M.top]);

  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' }, container);
  svg.setAttribute('aria-label', 'Retrograde overlap curve and retrograde periods per planet');

  // Highlighted window (the months view shown inside the years view)
  if (o.highlight) {
    const [a, b] = o.highlight.map((t) => x(t));
    el('rect', { x: a, y: M.top, width: b - a, height: ganttTop + ganttH - M.top, class: 'highlight' }, svg);
  }

  // Y gridlines + labels (whole planets' worth of overlap)
  for (let v = 0; v <= max; v++) {
    el('line', { x1: M.left, x2: width - M.right, y1: y(v), y2: y(v), class: v ? 'grid' : 'baseline' }, svg);
    if (!o.hideScale) el('text', { x: M.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = String(v);
  }
  if (!o.hideScale) el('text', { x: M.left - 8, y: M.top - 10, class: 'tick', 'text-anchor': 'end' }, svg).textContent = 'Overlap';

  // Overlap curve
  const areaPath = area<[number, number]>().x((d) => x(d[0])).y0(y(0)).y1((d) => y(d[1]))(samples)!;
  const linePath = line<[number, number]>().x((d) => x(d[0])).y((d) => y(d[1]))(samples)!;
  el('path', { d: areaPath, class: 'curve-area' }, svg);
  el('path', { d: linePath, class: 'curve-line' }, svg);

  // Gantt rows
  PLANETS.forEach((planet, i) => {
    const rowY = ganttTop + i * ROW_H;
    const labelAttrs = o.centerLabels
      ? { x: M.left / 2, 'text-anchor': 'middle' }
      : { x: M.left - 8, 'text-anchor': 'end' };
    el('text', { ...labelAttrs, y: rowY + ROW_H / 2, class: 'row-label', 'dominant-baseline': 'central', 'data-planet': planet }, svg).textContent = label(planet);
    // Invisible, finger-sized hit area over the label column.
    el('rect', { x: 0, y: rowY, width: M.left, height: ROW_H, class: 'row-hit', 'data-planet': planet }, svg);
    el('line', { x1: M.left, x2: width - M.right, y1: rowY + ROW_H / 2, y2: rowY + ROW_H / 2, class: 'row-track' }, svg);
    for (const p of periods[planet]) {
      if (p.end < o.from || p.start > o.to) continue;
      const a = Math.max(x(p.start), M.left);
      const b = Math.min(x(p.end), width - M.right);
      el('rect', { x: a, y: rowY + (ROW_H - BAR_H) / 2, width: Math.max(2, b - a), height: BAR_H, rx: 2, fill: color(planet) }, svg);
    }
  });

  // X axis
  const axisY = ganttTop + ganttH;
  const { values, format } = o.ticks(new Date(o.from), new Date(o.to));
  for (const d of values) {
    const tx = x(d);
    el('line', { x1: tx, x2: tx, y1: axisY, y2: axisY + 4, class: 'baseline' }, svg);
    const label = format(d);
    if (label) el('text', { x: tx, y: axisY + 16, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = label;
  }

  // Today line through the curve and the Gantt
  const tx = x(o.today);
  el('line', { x1: tx, x2: tx, y1: M.top - 4, y2: axisY, class: 'today' }, svg);
  el('text', { x: tx, y: M.top - 8, class: 'today-label', 'text-anchor': 'middle' }, svg).textContent = 'Today';

  // Hover: crosshair + tooltip listing what is retrograde at that moment
  const cross = el('line', { y1: M.top, y2: axisY, class: 'crosshair', visibility: 'hidden' }, svg);
  const dot = el('circle', { r: 4, class: 'crosshair-dot', visibility: 'hidden' }, svg);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  container.appendChild(tip);

  svg.addEventListener('pointermove', (ev) => {
    const rect = svg.getBoundingClientRect();
    const px = ev.clientX - rect.left;
    if (px < M.left || px > width - M.right) return hide();
    const t = x.invert(px).getTime();
    const k = Math.round((t - o.from) / o.step);
    const value = samples[Math.min(samples.length - 1, Math.max(0, k))][1];
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    dot.setAttribute('cx', String(px));
    dot.setAttribute('cy', String(y(value)));
    dot.setAttribute('visibility', 'visible');

    const active = PLANETS.flatMap((planet) => {
      const p = periods[planet].find((q) => q.start <= t && t < q.end);
      return p ? [{ planet, p }] : [];
    });
    const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
    tip.innerHTML =
      `<div class="tip-date">${o.hoverFormat(new Date(t))}</div>` +
      `<div class="tip-value">${active.length ? `${active.length} planet${active.length > 1 ? 's' : ''} retrograde` : ''}</div>` +
      (active.length
        ? active
            .map(({ planet, p }) => `<div class="tip-row"><span class="swatch" style="background:${color(planet)}"></span>${planet}<span class="tip-dates">${fmt(p.start)} – ${fmt(p.end)}</span></div>`)
            .join('')
        : '<div class="tip-row">No planet retrograde</div>');
    tip.hidden = false;
    const left = px + 14 + tip.offsetWidth > width ? px - 14 - tip.offsetWidth : px + 14;
    tip.style.left = `${left}px`;
    tip.style.top = `${M.top}px`;
  });
  svg.addEventListener('pointerleave', hide);
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
}

/** Dash pattern per planet, so the waves differ by more than colour. */
const DASH: Record<Planet, string> = {
  Mercury: '',
  Venus: '6 4',
  Mars: '2 3',
  Jupiter: '',
  Saturn: '10 4',
  Uranus: '6 4',
  Neptune: '2 3',
};

const pulseAt = (p: { start: number; end: number }, t: number) => Math.sin((Math.PI * (t - p.start)) / (p.end - p.start)) ** 2;

/**
 * One sin² wave per retrograde period, per planet, on a shared 0–1 scale:
 * the pulses that the overlap curve adds together.
 */
export function renderWaves(container: HTMLElement, o: Omit<ChartOptions, 'step' | 'highlight'>) {
  container.replaceChildren();
  const M = { ...BASE_M, left: o.left ?? BASE_M.left };
  const label = o.label ?? ((p: Planet) => p);
  const width = Math.max(320, container.clientWidth);
  const LABEL_ROWS = 3;
  const LABEL_H = 15;
  const top = M.top + LABEL_ROWS * LABEL_H;
  const plotH = 220;
  const axisY = top + plotH;
  const height = axisY + AXIS_H;

  const x = scaleUtc().domain([o.from, o.to]).range([M.left, width - M.right]);
  const y = scaleLinear().domain([0, 1]).range([axisY, top]);

  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' }, container);
  svg.setAttribute('aria-label', 'Retrograde pulse for each planet');

  for (const v of [0, 0.5, 1]) {
    el('line', { x1: M.left, x2: width - M.right, y1: y(v), y2: y(v), class: v ? 'grid' : 'baseline' }, svg);
    if (!o.hideScale) el('text', { x: M.left - 8, y: y(v), class: 'tick', 'text-anchor': 'end', 'dominant-baseline': 'middle' }, svg).textContent = String(v);
  }

  // Waves, clipped to the plot
  const clipId = `clip-${container.id}`;
  const clip = el('clipPath', { id: clipId }, el('defs', {}, svg));
  el('rect', { x: M.left, y: 0, width: width - M.left - M.right, height: axisY + 1 }, clip);
  const waves = el('g', { 'clip-path': `url(#${clipId})` }, svg);

  const labels: { x: number; planet: Planet }[] = [];
  const visible = PLANETS.flatMap((planet) => periods[planet].filter((p) => p.end > o.from && p.start < o.to));
  for (const p of visible) {
    const n = 120;
    const pts: [number, number][] = Array.from({ length: n + 1 }, (_, k) => {
      const t = p.start + ((p.end - p.start) * k) / n;
      return [x(t), y(pulseAt(p, t))];
    });
    el('path', { d: line()(pts)!, class: 'wave', stroke: color(p.planet), 'stroke-dasharray': DASH[p.planet] }, waves);
    const mid = (p.start + p.end) / 2;
    if (mid > o.from && mid < o.to) labels.push({ x: x(mid), planet: p.planet });
  }

  // Direct labels above each peak, stacked into rows so they don't collide
  labels.sort((a, b) => a.x - b.x);
  const rowEnds = Array<number>(LABEL_ROWS).fill(-Infinity);
  // Leaders first, then labels on top with a surface-coloured halo.
  const leaders = el('g', {}, svg);
  const texts = el('g', {}, svg);
  for (const l of labels) {
    const w = label(l.planet).length * 6.5 + 8;
    let row = rowEnds.findIndex((end) => l.x - w / 2 > end);
    if (row < 0) row = LABEL_ROWS - 1;
    rowEnds[row] = l.x + w / 2;
    const ly = top - 6 - row * LABEL_H;
    el('line', { x1: l.x, x2: l.x, y1: ly + 3, y2: y(1) - 3, class: 'leader' }, leaders);
    el('text', { x: l.x, y: ly, class: 'wave-label', 'text-anchor': 'middle' }, texts).textContent = label(l.planet);
  }

  // X axis
  const { values, format } = o.ticks(new Date(o.from), new Date(o.to));
  for (const d of values) {
    const tx = x(d);
    el('line', { x1: tx, x2: tx, y1: axisY, y2: axisY + 4, class: 'baseline' }, svg);
    const label = format(d);
    if (label) el('text', { x: tx, y: axisY + 16, class: 'tick', 'text-anchor': 'middle' }, svg).textContent = label;
  }

  // Today line
  const tx = x(o.today);
  el('line', { x1: tx, x2: tx, y1: M.top - 4, y2: axisY, class: 'today' }, svg);
  el('text', { x: tx, y: M.top - 8, class: 'today-label', 'text-anchor': 'middle' }, svg).textContent = 'Today';

  // Hover: crosshair, a dot on each active wave, tooltip with values
  const cross = el('line', { y1: top, y2: axisY, class: 'crosshair', visibility: 'hidden' }, svg);
  const dots = el('g', {}, svg);
  const tip = document.createElement('div');
  tip.className = 'tooltip';
  tip.hidden = true;
  container.appendChild(tip);
  const fmt = (ms: number) => new Date(ms).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' });

  svg.addEventListener('pointermove', (ev) => {
    const px = ev.clientX - svg.getBoundingClientRect().left;
    if (px < M.left || px > width - M.right) return hide();
    const t = x.invert(px).getTime();
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    dots.replaceChildren();
    const active = PLANETS.flatMap((planet) => {
      const p = periods[planet].find((q) => q.start <= t && t < q.end);
      return p ? [{ planet, p, v: pulseAt(p, t) }] : [];
    });
    for (const a of active) el('circle', { cx: px, cy: y(a.v), r: 4, fill: color(a.planet), class: 'wave-dot' }, dots);
    tip.innerHTML =
      `<div class="tip-date">${o.hoverFormat(new Date(t))}</div>` +
      (active.length
        ? active
            .map(({ planet, p, v }) => `<div class="tip-row"><span class="swatch" style="background:${color(planet)}"></span>${planet} <b>${v.toFixed(2)}</b><span class="tip-dates">${fmt(p.start)} – ${fmt(p.end)}</span></div>`)
            .join('')
        : '<div class="tip-row">No planet retrograde</div>');
    tip.hidden = false;
    tip.style.left = `${px + 14 + tip.offsetWidth > width ? px - 14 - tip.offsetWidth : px + 14}px`;
    tip.style.top = `${top}px`;
  });
  svg.addEventListener('pointerleave', hide);
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    dots.replaceChildren();
    tip.hidden = true;
  }
}
