/**
 * A synthetic asteroid population, drawn to match the real one's statistics rather than any real
 * catalogue. Positions are made up; the structure is not:
 *
 * - Main belt, 2.1–3.3 AU, densest in the inner and middle belt. Kirkwood gaps are cleared at
 *   Jupiter's 3:1 (2.50 AU), 5:2 (2.82), 7:3 (2.95) and 2:1 (3.27) resonances.
 * - Eccentricities: a random "free" part (mean ~0.11) plus a small "forced" part that Jupiter imposes,
 *   aligned with Jupiter's perihelion. Mars-crossers (perihelion < 1.67 AU) are excluded, as in the
 *   real belt's definition.
 * - Hungarias (~1.9 AU) and Cybeles (3.3–3.7 AU): small groups at the belt's edges.
 * - Hildas, in 3:2 resonance with Jupiter: always at perihelion when Jupiter passes, which makes
 *   the group a triangle with its corners 60°, 180° and 300° from Jupiter.
 * - Trojans: Jupiter's orbit, librating around 60° ahead (L4) and behind (L5), with L4 ~1.6× as populous.
 *
 * Counts are scaled to a few hundred dots and so are only roughly proportional.
 */
import { inPlane, meanLongitude, perihelionLongitude, semiMajorAxis } from './orbits';

const TAU = Math.PI * 2;
const J2000 = Date.UTC(2000, 0, 1, 12);
const DAY = 86_400_000;
const K = TAU / 365.25; // mean motion at 1 AU, radians/day

export type Kind = 'belt' | 'hilda' | 'trojan';

interface Rock {
  kind: Kind;
  a: number;
  e: number;
  /** Longitude of perihelion (radians), or for Hildas its offset from the resonant value. */
  peri: number;
  /** Mean longitude at J2000 (radians); for Trojans, the libration amplitude. */
  L0: number;
  /** Mean motion (radians/day); for Trojans, the libration phase at J2000. */
  n: number;
  sign?: 1 | -1; // Trojans: +1 = L4 (ahead), -1 = L5 (behind)
}

let seed = 20261114;
const rand = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const uniform = (lo: number, hi: number) => lo + (hi - lo) * rand();
const gauss = () => Math.sqrt(-2 * Math.log(rand() + 1e-12)) * Math.cos(TAU * rand());
const rayleigh = (sigma: number) => sigma * Math.sqrt(-2 * Math.log(rand() + 1e-12));

const aJ = semiMajorAxis('Jupiter');
const eJ = 0.0484;
const periJ = perihelionLongitude('Jupiter');

// Main-belt zones between the gaps: [inner edge, outer edge, share of asteroids].
const ZONES: [number, number, number][] = [
  [2.1, 2.48, 0.36], // inner belt, up to the 3:1 gap
  [2.52, 2.805, 0.37], // middle belt, up to the 5:2 gap
  [2.835, 2.94, 0.07], // the narrow "pristine zone" between 5:2 and 7:3
  [2.965, 3.25, 0.17], // outer belt, up to the 2:1 gap
  [3.3, 3.7, 0.03], // Cybeles, beyond the 2:1
];

function beltRock(a: number): Rock {
  // Free eccentricity at a random orientation, plus Jupiter's forced eccentricity at its perihelion
  // (Laplace–Lagrange, first order in a/aJ). Redraw until the asteroid stays clear of Mars and Jupiter.
  for (;;) {
    const ef = 1.25 * eJ * (a / aJ);
    const free = rayleigh(0.09), phase = TAU * rand();
    const ex = free * Math.cos(phase) + ef * Math.cos(periJ);
    const ey = free * Math.sin(phase) + ef * Math.sin(periJ);
    const e = Math.hypot(ex, ey);
    if (a * (1 - e) < 1.67 || a * (1 + e) > 4.5) continue;
    return { kind: 'belt', a, e, peri: Math.atan2(ey, ex), L0: TAU * rand(), n: K / a ** 1.5 };
  }
}

function build(): Rock[] {
  const rocks: Rock[] = [];
  const MAIN = 1150;
  for (const [lo, hi, share] of ZONES) {
    for (let i = 0; i < Math.round(MAIN * share); i++) rocks.push(beltRock(uniform(lo, hi)));
  }
  // Hungarias: inside the belt, low eccentricity, perihelion still clear of Mars's orbit.
  for (let i = 0; i < 25; i++) {
    const a = uniform(1.8, 2.0);
    rocks.push({ kind: 'belt', a, e: uniform(0.02, Math.min(0.16, 1 - 1.67 / a)), peri: TAU * rand(), L0: TAU * rand(), n: K / a ** 1.5 });
  }
  // Hildas: 3:2 resonance. peri holds a small libration offset from the resonant perihelion.
  for (let i = 0; i < 50; i++) {
    rocks.push({ kind: 'hilda', a: 3.97 + 0.04 * gauss(), e: uniform(0.08, 0.28), peri: 0.3 * gauss(), L0: TAU * rand(), n: 0 });
  }
  // Trojans: L0 = libration amplitude (3–30°), n = libration phase.
  for (let i = 0; i < 140; i++) {
    rocks.push({
      kind: 'trojan', a: aJ + 0.04 * gauss(), e: rayleigh(0.06), peri: TAU * rand(),
      L0: uniform(0.05, 0.52), n: TAU * rand(), sign: rand() < 0.62 ? 1 : -1,
    });
  }
  return rocks;
}

const ROCKS = build();
const LIBRATION_DAYS = 150 * 365.25; // Trojan libration period, roughly

/** Heliocentric ecliptic longitude (radians) and distance (AU) of every asteroid at time t. */
export function asteroidPositions(t: number): { kind: Kind; lon: number; r: number }[] {
  const days = (t - J2000) / DAY;
  const jup = meanLongitude('Jupiter', t);
  const jup0 = meanLongitude('Jupiter', J2000);
  return ROCKS.map((k) => {
    let L: number, peri = k.peri;
    if (k.kind === 'belt') {
      L = k.L0 + k.n * days;
    } else if (k.kind === 'hilda') {
      // Mean motion exactly 3/2 of Jupiter's; resonance keeps ϖ = 3·λJ − 2·λ (fixed in time).
      L = k.L0 + 1.5 * jup.rate * days;
      peri = 3 * jup0.L - 2 * k.L0 + k.peri;
    } else {
      L = jup.L + k.sign! * (Math.PI / 3) + k.L0 * Math.sin(k.n + (TAU * days) / LIBRATION_DAYS);
    }
    const [xp, yp] = inPlane(k.a, k.e, L - peri);
    return { kind: k.kind, lon: Math.atan2(yp, xp) + peri, r: Math.hypot(xp, yp) };
  });
}
