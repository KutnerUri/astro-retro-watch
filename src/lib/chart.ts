import { scaleLinear, scaleUtc } from 'd3-scale';
import { area, line } from 'd3-shape';
import { PLANETS, periods, sampleOverlap, type Period, type Planet } from './retro';

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
  /**
   * Makes the window draggable. Called with the new window centre (ms) when the window is
   * dragged, or when the plot is tapped (the window jumps there).
   */
  onWindowMove?: (center: number) => void;
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
const BASE_M = { top: 22, right: 0, left: 72 };
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

/**
 * Touch tooltips stay up after the finger lifts; a tap anywhere outside the chart closes them.
 * One listener per chart container, replaced on each redraw.
 */
const outsideListeners = new WeakMap<HTMLElement, AbortController>();
function dismissOnOutsideTouch(container: HTMLElement, hide: () => void) {
  outsideListeners.get(container)?.abort();
  const ctrl = new AbortController();
  outsideListeners.set(container, ctrl);
  document.addEventListener('pointerdown', (ev) => !container.contains(ev.target as Node) && hide(), { signal: ctrl.signal });
}

/** Tooltip x: right of the cursor, else left of it, always kept inside the chart. */
const tipLeft = (px: number, w: number, width: number) =>
  Math.max(0, Math.min(width - w, px + 14 + w > width ? px - 14 - w : px + 14));

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
  let windowRect: SVGRectElement | null = null;
  if (o.highlight) {
    const [a, b] = o.highlight.map((t) => x(t));
    windowRect = el('rect', { x: a, y: M.top, width: b - a, height: ganttTop + ganttH - M.top, class: 'highlight' }, svg);
    if (o.onWindowMove) windowRect.classList.add('draggable');
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

  const pxOf = (ev: PointerEvent) => ev.clientX - svg.getBoundingClientRect().left;
  const inPlot = (px: number) => px >= M.left && px <= width - M.right;

  function showAt(px: number) {
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
    tip.style.left = `${tipLeft(px, tip.offsetWidth, width)}px`;
    tip.style.top = `${M.top}px`;
  }
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    dot.setAttribute('visibility', 'hidden');
    tip.hidden = true;
  }
  dismissOnOutsideTouch(container, hide);

  // Mouse: the tooltip follows the cursor. Touch is handled with the window gestures below
  // (tap shows it and it stays; a drag moves the window instead).
  svg.addEventListener('pointermove', (ev) => {
    if (ev.pointerType === 'touch') return;
    const px = pxOf(ev);
    if (inPlot(px)) showAt(px);
    else hide();
  });
  svg.addEventListener('pointerleave', (ev) => ev.pointerType !== 'touch' && hide());
  svg.addEventListener('pointercancel', hide);

  let currentWindow: [number, number] = o.highlight ?? [0, 0];

  // Moving the window.
  //  Mouse: press to jump or grab the window, drag to move it.
  //  Touch: a sideways drag moves it; a tap jumps it there (unless the tap lands inside the
  //  window) and shows that date's tooltip. A vertical swipe scrolls the page and is ignored:
  //  the browser cancels the pointer, so nothing moves until the finger has gone sideways.
  if (windowRect && o.onWindowMove) {
    const onMove = o.onWindowMove;
    const DRAG_PX = 6;
    let grab: number | null = null;
    let down: { x: number; touch: boolean; dragging: boolean } | null = null;
    const timeAt = (px: number) => x.invert(px).getTime();
    // Keep receiving moves when the pointer leaves the chart. Capture can fail (e.g. the
    // pointer already ended); dragging still works without it.
    const capture = (ev: PointerEvent) => {
      try {
        svg.setPointerCapture(ev.pointerId);
      } catch {}
    };
    const startGrab = (px: number) => {
      const t = timeAt(px);
      const [a, b] = currentWindow;
      grab = t >= a && t <= b ? t - (a + b) / 2 : 0;
    };

    svg.addEventListener('pointerdown', (ev) => {
      const px = pxOf(ev);
      if (!inPlot(px)) return;
      const touch = ev.pointerType === 'touch';
      down = { x: px, touch, dragging: !touch };
      if (touch) return; // wait to see whether this is a tap, a drag or a scroll
      ev.preventDefault(); // no text selection while dragging
      capture(ev);
      svg.classList.add('dragging');
      startGrab(px);
      onMove(timeAt(px) - grab!);
    });
    svg.addEventListener('pointermove', (ev) => {
      if (!down) return;
      const px = pxOf(ev);
      if (down.touch && !down.dragging) {
        if (Math.abs(px - down.x) < DRAG_PX) return;
        down.dragging = true;
        capture(ev);
        svg.classList.add('dragging');
        hide();
        startGrab(down.x);
      }
      if (grab !== null) onMove(timeAt(px) - grab);
    });
    svg.addEventListener('pointerup', (ev) => {
      if (down?.touch && !down.dragging) {
        const px = pxOf(ev);
        const t = timeAt(px);
        const [a, b] = currentWindow;
        if (t < a || t > b) onMove(t);
        showAt(px);
      }
      end();
    });
    svg.addEventListener('pointercancel', end);
    function end() {
      down = null;
      grab = null;
      svg.classList.remove('dragging');
    }
  }
  return {
    /** Moves the shaded window without redrawing the chart. */
    setWindow(from: number, to: number) {
      currentWindow = [from, to];
      if (!windowRect) return;
      windowRect.setAttribute('x', String(x(from)));
      windowRect.setAttribute('width', String(x(to) - x(from)));
    },
    /** The time range the chart shows. */
    domain: [o.from, o.to] as const,
  };
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
 * Wave height on a log scale of degrees walked back: 1° maps to 0, 20° to 1.
 * Log keeps the outer planets (3–7°) readable next to Venus and Mars (16°+).
 */
const ARC_MIN = 1;
const ARC_MAX = 20;
const height01 = (deg: number) => Math.log(Math.max(deg, ARC_MIN) / ARC_MIN) / Math.log(ARC_MAX / ARC_MIN);
/** One retrograde's wave at time t: the sin² pulse, peaking at its log-scaled arc. */
const waveAt = (p: Period, t: number) => height01(p.arc) * pulseAt(p, t);

/**
 * One sin² wave per retrograde period, per planet, on a shared 0–1 scale:
 * the pulses that the overlap curve adds together.
 */
export function renderWaves(container: HTMLElement, o: Omit<ChartOptions, 'step' | 'highlight'>) {
  container.replaceChildren();
  const M = { ...BASE_M, left: o.left ?? BASE_M.left };
  const label = o.label ?? ((p: Planet) => p);
  const width = Math.max(320, container.clientWidth);
  const LABEL_H = 15;
  const top = M.top + 2 * LABEL_H;
  const plotH = 230;
  const axisY = top + plotH;
  const height = axisY + AXIS_H;

  const x = scaleUtc().domain([o.from, o.to]).range([M.left, width - M.right]);
  const y = scaleLinear().domain([0, 1]).range([axisY, top]);

  const svg = el('svg', { width, height, viewBox: `0 0 ${width} ${height}`, role: 'img' }, container);
  svg.setAttribute('aria-label', 'Retrograde pulse for each planet');

  // Degree marks on the log scale, labelled inside the plot so they cost no width.
  el('line', { x1: M.left, x2: width - M.right, y1: y(0), y2: y(0), class: 'baseline' }, svg);
  for (const deg of [2, 5, 10, 20]) {
    el('line', { x1: M.left, x2: width - M.right, y1: y(height01(deg)), y2: y(height01(deg)), class: 'grid' }, svg);
    el('text', { x: M.left + 2, y: y(height01(deg)) - 3, class: 'tick' }, svg).textContent = `${deg}°`;
  }

  // Waves, clipped to the plot
  const clipId = `clip-${container.id}`;
  const clip = el('clipPath', { id: clipId }, el('defs', {}, svg));
  el('rect', { x: M.left, y: 0, width: width - M.left - M.right, height: axisY + 1 }, clip);
  const waves = el('g', { 'clip-path': `url(#${clipId})` }, svg);

  const labels: { x: number; y: number; planet: Planet }[] = [];
  const visible = PLANETS.flatMap((planet) => periods[planet].filter((p) => p.end > o.from && p.start < o.to));
  for (const p of visible) {
    const n = 120;
    const pts: [number, number][] = Array.from({ length: n + 1 }, (_, k) => {
      const t = p.start + ((p.end - p.start) * k) / n;
      return [x(t), y(waveAt(p, t))];
    });
    el('path', { d: line()(pts)!, class: 'wave', stroke: color(p.planet), 'stroke-dasharray': DASH[p.planet] }, waves);
    // Label at the peak; if the peak is outside the window, label where the wave meets the edge.
    const mid = (p.start + p.end) / 2;
    const at = Math.min(Math.max(mid, o.from), o.to);
    if (waveAt(p, at) > 0.02) labels.push({ x: x(at), y: y(waveAt(p, at)), planet: p.planet });
  }

  // Direct labels just above each peak. Taller peaks are placed first; a label that would
  // overlap one already placed moves up a step, with a leader line back to its peak.
  labels.sort((a, b) => a.y - b.y);
  const placed: { x: number; y: number; w: number }[] = [];
  const leaders = el('g', {}, svg);
  const texts = el('g', {}, svg);
  for (const l of labels) {
    const w = label(l.planet).length * 9 + 6;
    l.x = Math.min(Math.max(l.x, M.left + w / 2), width - M.right - w / 2);
    let ly = l.y - 7;
    while (placed.some((q) => Math.abs(q.x - l.x) < (q.w + w) / 2 && Math.abs(q.y - ly) < LABEL_H)) ly -= LABEL_H;
    placed.push({ x: l.x, y: ly, w });
    if (ly < l.y - 7) el('line', { x1: l.x, x2: l.x, y1: ly + 3, y2: l.y - 3, class: 'leader' }, leaders);
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

  // Mouse: follows the cursor. Touch: a tap shows that date, sliding sideways scrubs, and the
  // tooltip stays after the finger lifts. A vertical swipe scrolls and cancels it.
  const showFrom = (ev: PointerEvent) => {
    const px = ev.clientX - svg.getBoundingClientRect().left;
    if (px < M.left || px > width - M.right) return hide();
    showAt(px);
  };
  svg.addEventListener('pointerdown', (ev) => ev.pointerType === 'touch' && showFrom(ev));
  svg.addEventListener('pointermove', showFrom);
  svg.addEventListener('pointerleave', (ev) => ev.pointerType !== 'touch' && hide());
  svg.addEventListener('pointercancel', hide);
  dismissOnOutsideTouch(container, hide);

  function showAt(px: number) {
    const t = x.invert(px).getTime();
    cross.setAttribute('x1', String(px));
    cross.setAttribute('x2', String(px));
    cross.setAttribute('visibility', 'visible');
    dots.replaceChildren();
    const active = PLANETS.flatMap((planet) => {
      const p = periods[planet].find((q) => q.start <= t && t < q.end);
      return p ? [{ planet, p, v: waveAt(p, t) }] : [];
    });
    for (const a of active) el('circle', { cx: px, cy: y(a.v), r: 4, fill: color(a.planet), class: 'wave-dot' }, dots);
    tip.innerHTML =
      `<div class="tip-date">${o.hoverFormat(new Date(t))}</div>` +
      (active.length
        ? active
            .map(({ planet, p }) => `<div class="tip-row"><span class="swatch" style="background:${color(planet)}"></span>${planet} <b>${p.arc.toFixed(1)}° back</b><span class="tip-dates">${fmt(p.start)} – ${fmt(p.end)}</span></div>`)
            .join('')
        : '<div class="tip-row">No planet retrograde</div>');
    tip.hidden = false;
    tip.style.left = `${tipLeft(px, tip.offsetWidth, width)}px`;
    tip.style.top = `${top}px`;
  }
  function hide() {
    cross.setAttribute('visibility', 'hidden');
    dots.replaceChildren();
    tip.hidden = true;
  }
}
