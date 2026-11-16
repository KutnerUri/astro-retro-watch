/**
 * The orbit map's geometry and shape data. `MapSvg.astro` renders a frame from it (on the page and for the share
 * image), and the page script in `OrbitMap.astro` uses it to move that frame along in time.
 *
 * Map units: the page's viewBox is -100…100 on both axes, the Sun at the centre, north up.
 */
import { asteroidPositions, type Kind } from './asteroids';
import { periodDays, position, speedKms, type Body } from './orbits';
import { GLYPH, activeAt, type Planet } from './retro';

const DAY = 86_400_000;

export const fixed = (n: number) => n.toFixed(2);

export type Attrs = Record<string, string | number>;
/** An SVG element as data: tag and attributes. */
export type Shape = [tag: string, attrs: Attrs];

// Sizes: the Sun and the planets on one log scale of real equatorial radius (km). True sizes would be
// specks next to the distances, so sizes get their own scale: Mercury (smallest) is pinned at 0.7 units and
// the Sun at 5, and every ×10 in real radius adds the same amount in between.
const RADIUS_KM: Record<Body | 'Sun', number> = {
  Sun: 695_700, Mercury: 2_440, Venus: 6_052, Earth: 6_371, Mars: 3_390,
  Jupiter: 69_911, Saturn: 58_232, Uranus: 25_362, Neptune: 24_622,
};
const MIN_SIZE = 0.7, SUN_SIZE = 5;
const drawnSize = (b: Body | 'Sun') =>
  MIN_SIZE + ((SUN_SIZE - MIN_SIZE) * Math.log(RADIUS_KM[b] / RADIUS_KM.Mercury)) / Math.log(RADIUS_KM.Sun / RADIUS_KM.Mercury);

// True scale (the map’s scale button): distances linear in AU, with Neptune's orbit where the log scale puts it,
// and bodies at their real size on that same scale, which makes them specks far below a pixel.
// `trueScale` runs 0 (the usual log map) to 1 (true scale); in between is the animation from one to the other.
const AU_KM = 149_597_871;
const UNITS_PER_AU = 92 / 30.5;
let trueScale = 0;
export const setTrueScale = (mix: number) => { trueScale = mix; };
/** A body's true radius in map units at true scale. */
export const trueSize = (b: Body | 'Sun') => (RADIUS_KM[b] / AU_KM) * UNITS_PER_AU;
/** Log-blend from `from` to `to`, so a shrink by ×10,000 reads as steady rather than over in the first frame. */
export const blendSize = (from: number, to: number) => from * (to / from) ** trueScale;
export const size = (b: Body | 'Sun') => blendSize(drawnSize(b), trueSize(b));

export const EARTH_SEA = '#2f74e0';
const EARTH_LAND = '#3fae5a';
export const glyph = (b: Body) => (b === 'Earth' ? '⊕' : GLYPH[b]);
export const isRetro = (b: Body, t: number) => b !== 'Earth' && !!activeAt(b as Planet, t);

// Distance: AU -> map units on a log scale that starts just outside the Sun's disc.
const MIN_AU = 0.3, MAX_AU = 30.5, R_IN = 9, R_OUT = 92;
const logScale = (d: number) => R_IN + ((R_OUT - R_IN) * Math.log(d / MIN_AU)) / Math.log(MAX_AU / MIN_AU);
export const scale = (d: number) => (1 - trueScale) * logScale(d) + trueScale * d * UNITS_PER_AU;

export const toXY = (lon: number, r: number): [number, number] => {
  const R = scale(r);
  return [R * Math.cos(lon), -R * Math.sin(lon)]; // north-up view: anticlockwise motion
};
export const at = (b: Body, t: number) => {
  const p = position(b, t);
  return toXY(p.lon, p.r);
};

/** Distance rings (1, 5, 10, 20, 30 AU), as radii. */
export const scaleRings = () => [1, 5, 10, 20, 30].map(scale);

/** One full orbit (the true, eccentric path), starting at time t. */
export function orbitPath(b: Body, t: number): string {
  const n = 240, P = periodDays(b) * DAY;
  const pts = Array.from({ length: n }, (_, i) => at(b, t + (i / n) * P));
  return `M${pts.map((p) => p.map((v) => v.toFixed(2)).join(' ')).join('L')}Z`;
}

/** Asteroid dots as path data, one per style: zero-length segments that a round cap turns into dots. */
export function asteroidPaths(t: number): { rocks: string; trojans: string } {
  const paths: Record<Kind, string> = { belt: '', hilda: '', trojan: '' };
  for (const a of asteroidPositions(t)) {
    const [x, y] = toXY(a.lon, a.r);
    paths[a.kind] += `M${x.toFixed(2)} ${y.toFixed(2)}h0`;
  }
  return { rocks: paths.belt + paths.hilda, trojans: paths.trojan };
}

// Tail: a thin line back along the orbit that fades out. Its length follows the planet's current
// angular speed, compressed (speed^0.4) so the outer planets still show one.
const REF_SPEED = 4.09; // Mercury's mean, degrees/day
const angularSpeed = (b: Body, t: number) => {
  const d = position(b, t + DAY / 2).lon - position(b, t - DAY / 2).lon;
  return ((((d * 180) / Math.PI) % 360) + 360) % 360;
};
export function tailPoints(b: Body, t: number): [number, number][] {
  const w = angularSpeed(b, t);
  const span = ((60 * (w / REF_SPEED) ** 0.4) / w) * DAY;
  const N = 32;
  return Array.from({ length: N + 1 }, (_, i) => at(b, t - (i / N) * span));
}

// Faces use the classic side-on look people recognise (like the blue-marble Earth). Unit-disc coordinates,
// drawn over the base colour and clipped to the disc. Venus, Mars and Uranus stay plain.
export const SURFACE: Partial<Record<Body, Shape[]>> = {
  Mercury: [[-0.35, -0.3, 0.2], [0.4, 0.1, 0.14], [-0.1, 0.5, 0.17], [0.25, -0.55, 0.1]].map(
    ([cx, cy, r]): Shape => ['circle', { cx, cy, r, fill: 'rgb(40 40 60 / 0.22)' }], // a few craters
  ),
  Earth: [ // the classic blue marble
    ['path', { d: 'M-0.75 -0.55Q-0.25 -1 0.15 -0.45Q0.05 0.05 -0.4 0.15Q-0.95 -0.05 -0.75 -0.55Z', fill: EARTH_LAND }],
    ['path', { d: 'M0.2 0.15Q0.7 -0.15 0.85 0.3Q0.6 0.95 0.2 0.7Q-0.05 0.4 0.2 0.15Z', fill: EARTH_LAND }],
  ],
  Jupiter: [ // belts and zones, plus the Great Red Spot
    ['circle', { r: 1, fill: 'url(#om-jupiter-bands)' }],
    ['ellipse', { cx: 0.32, cy: 0.38, rx: 0.2, ry: 0.11, fill: '#c0603a', opacity: 0.85 }],
  ],
  Saturn: [['circle', { r: 1, fill: 'url(#om-saturn-bands)' }]],
  Neptune: [ // deep blue, a dark storm and small bright clouds (as Voyager 2 saw it)
    ['circle', { r: 1, fill: '#1d36b8' }],
    ['ellipse', { cx: -0.1, cy: 0.08, rx: 0.26, ry: 0.12, fill: '#14206e', opacity: 0.55 }],
    ...[[-0.12, -0.02, 0.15, 0.03, 0.8], [0.4, -0.5, 0.22, 0.025, 0.5], [-0.5, 0.55, 0.09, 0.03, 0.6], [0.2, 0.45, 0.07, 0.02, 0.5]].map(
      ([cx, cy, rx, ry, opacity]): Shape => ['ellipse', { cx, cy, rx, ry, fill: '#e8f0ff', opacity }],
    ),
  ],
};

// Rings. Each is an ellipse: `angle` turns its long axis (SVG degrees), `ratio` is short/long, and `nearSide`
// says which half (in the turned frame) passes in front of the planet. Radii are in planet radii.
// - Saturn: the classic tilted look, slimmed to the bright B ring and the dimmer A ring, with the Cassini
//   Division between them (true radii 1.53–1.95 and 2.03–2.27, scaled down ~0.8 to keep it compact).
// - Uranus: tilted as it really sits, seen from above. Its pole (IAU, J2000 ecliptic) is at λ 257.6°, β 7.7°,
//   so the ring's long axis is perpendicular to λ 257.6° and its ratio is sin 7.7°: almost a line.
//   The pole side tilts away from the viewer, so the half on the other side (y < 0) is the near one.
interface Ring { angle: number; ratio: number; nearSide: 'up' | 'down'; bands: [number, number, string, number][] }
const RINGS: Partial<Record<Body, Ring>> = {
  Saturn: {
    angle: -18, ratio: 0.32, nearSide: 'down',
    bands: [ // [mid radius, width, colour, opacity]
      [1.43, 0.36, '#d6d1d4', 0.75],
      [1.79, 0.2, '#aaa5b0', 0.6],
    ],
  },
  Uranus: { angle: -(257.6 + 90), ratio: 0.134, nearSide: 'up', bands: [[2.0, 0.035, '#e6f2f4', 0.35]] }, // the ε ring
};
export const ringExtent = (b: Body) => Math.max(1, ...(RINGS[b]?.bands.map(([m, w]) => m + w / 2) ?? []));

/** Half of a planet's rings: the far half is drawn before the planet (hidden behind it), the near half after. */
export function ringShapes(b: Body, half: 'back' | 'front'): Shape[] {
  const ring = RINGS[b];
  if (!ring) return [];
  // From (-rx, 0) to (rx, 0), sweep 1 runs through y < 0 ('up') and sweep 0 through y > 0 ('down').
  const up = (half === 'front') === (ring.nearSide === 'up');
  return ring.bands.map(([m, w, stroke, opacity]): Shape => ['path', {
    d: `M${-m} 0A${m} ${m * ring.ratio} 0 0 ${up ? 1 : 0} ${m} 0`,
    fill: 'none', stroke, opacity, 'stroke-width': w, transform: `rotate(${ring.angle})`,
  }]);
}

/** Shade rotation (degrees) so the dark side points away from the Sun. */
export const shadeAngle = (x: number, y: number) => (Math.atan2(y, x) * 180) / Math.PI;

/** One planet's drawing values at time t: everything the template sets and the page script updates. */
export function bodyFrame(b: Body, t: number, planetScale = 1) {
  const pts = tailPoints(b, t), end = pts[pts.length - 1];
  const p = position(b, t);
  const [x, y] = toXY(p.lon, p.r);
  const r = size(b) * planetScale;
  const retro = isRetro(b, t);
  return {
    x, y, retro,
    grad: { x1: fixed(pts[0][0]), y1: fixed(pts[0][1]), x2: fixed(end[0]), y2: fixed(end[1]) },
    tail: `M${pts.map((q) => q.map(fixed).join(' ')).join('L')}`,
    disc: `translate(${fixed(x)} ${fixed(y)}) scale(${r})`,
    shade: `rotate(${shadeAngle(x, y).toFixed(1)})`,
    labelX: x + r * ringExtent(b) + 1,
    title: `${b}: ${p.r.toFixed(2)} AU from the Sun, ${speedKms(b, p.r).toFixed(1)} km/s${retro ? ', retrograde from Earth' : ''}`,
  };
}

/** The dashed line of sight from Earth to a planet while it is retrograde. */
export function sightLine(b: Body, t: number): Record<string, string> {
  if (!isRetro(b, t)) return { visibility: 'hidden' };
  const [ex, ey] = at('Earth', t), [x, y] = at(b, t);
  return { x1: fixed(ex), y1: fixed(ey), x2: fixed(x), y2: fixed(y), visibility: 'visible' };
}
