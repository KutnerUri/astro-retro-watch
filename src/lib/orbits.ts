/**
 * Approximate heliocentric planet positions from Keplerian elements.
 *
 * Elements and their linear rates are JPL's "Keplerian Elements for Approximate Positions of the
 * Major Planets" (Standish), Table 1: J2000 ecliptic, valid 1800–2050. Errors are fractions of a
 * degree, which is plenty for a map. `scripts/check-orbits.ts` measures them against astronomy-engine.
 */

export const BODIES = ['Mercury', 'Venus', 'Earth', 'Mars', 'Jupiter', 'Saturn', 'Uranus', 'Neptune'] as const;
export type Body = (typeof BODIES)[number];

// [a (AU), e, I, L, ϖ (long. perihelion), Ω (long. node)] in degrees, then rates per Julian century.
type Elements = [number, number, number, number, number, number];
const ELEMENTS: Record<Body, [Elements, Elements]> = {
  Mercury: [
    [0.38709927, 0.20563593, 7.00497902, 252.2503235, 77.45779628, 48.33076593],
    [0.00000037, 0.00001906, -0.00594749, 149472.67411175, 0.16047689, -0.12534081],
  ],
  Venus: [
    [0.72333566, 0.00677672, 3.39467605, 181.9790995, 131.60246718, 76.67984255],
    [0.0000039, -0.00004107, -0.0007889, 58517.81538729, 0.00268329, -0.27769418],
  ],
  // Earth–Moon barycentre.
  Earth: [
    [1.00000261, 0.01671123, -0.00001531, 100.46457166, 102.93768193, 0],
    [0.00000562, -0.00004392, -0.01294668, 35999.37244981, 0.32327364, 0],
  ],
  Mars: [
    [1.52371034, 0.0933941, 1.84969142, -4.55343205, -23.94362959, 49.55953891],
    [0.00001847, 0.00007882, -0.00813131, 19140.30268499, 0.44441088, -0.29257343],
  ],
  Jupiter: [
    [5.202887, 0.04838624, 1.30439695, 34.39644051, 14.72847983, 100.47390909],
    [-0.00011607, -0.00013253, -0.00183714, 3034.74612775, 0.21252668, 0.20469106],
  ],
  Saturn: [
    [9.53667594, 0.05386179, 2.48599187, 49.95424423, 92.59887831, 113.66242448],
    [-0.0012506, -0.00050991, 0.00193609, 1222.49362201, -0.41897216, -0.28867794],
  ],
  Uranus: [
    [19.18916464, 0.04725744, 0.77263783, 313.23810451, 170.9542763, 74.01692503],
    [-0.00196176, -0.00004397, -0.00242939, 428.48202785, 0.40805281, 0.04240589],
  ],
  Neptune: [
    [30.06992276, 0.00859048, 1.77004347, -55.12002969, 44.96476227, 131.78422574],
    [0.00026291, 0.00005105, 0.00035372, 218.45945325, -0.32241464, -0.00508664],
  ],
};

const RAD = Math.PI / 180;
const J2000 = Date.UTC(2000, 0, 1, 12);
const CENTURY = 36525 * 86_400_000;

/** Solve Kepler's equation M = E − e·sin E (radians). */
export function eccentricAnomaly(M: number, e: number): number {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 8; i++) E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  return E;
}

/** Position in an orbit's own plane, perihelion along +x (AU). */
export function inPlane(a: number, e: number, M: number): [number, number] {
  const E = eccentricAnomaly(M, e);
  return [a * (Math.cos(E) - e), a * Math.sqrt(1 - e * e) * Math.sin(E)];
}

export interface Position {
  x: number; // AU, J2000 ecliptic, +x toward the vernal equinox
  y: number;
  z: number;
  lon: number; // heliocentric ecliptic longitude, radians
  r: number; // distance from the Sun, AU
}

export function position(body: Body, t: number): Position {
  const T = (t - J2000) / CENTURY;
  const [el, rate] = ELEMENTS[body];
  const [a, e, I, L, peri, node] = el.map((v, i) => v + rate[i] * T);
  const w = (peri - node) * RAD;
  const O = node * RAD;
  const i = I * RAD;
  const M = ((((L - peri) % 360) + 540) % 360) - 180;
  const [xp, yp] = inPlane(a, e, M * RAD);
  const cw = Math.cos(w), sw = Math.sin(w), cO = Math.cos(O), sO = Math.sin(O), ci = Math.cos(i);
  const x = (cw * cO - sw * sO * ci) * xp + (-sw * cO - cw * sO * ci) * yp;
  const y = (cw * sO + sw * cO * ci) * xp + (-sw * sO + cw * cO * ci) * yp;
  const z = sw * Math.sin(i) * xp + cw * Math.sin(i) * yp;
  return { x, y, z, lon: Math.atan2(y, x), r: Math.hypot(x, y, z) };
}

/** Orbital period in days (Kepler's third law from the J2000 semi-major axis). */
export const periodDays = (body: Body) => 365.25 * ELEMENTS[body][0][0] ** 1.5;

/** Orbital speed in km/s at distance r (vis-viva). */
export const speedKms = (body: Body, r: number) => 29.7847 * Math.sqrt(2 / r - 1 / ELEMENTS[body][0][0]);

/** Semi-major axis in AU at J2000. */
export const semiMajorAxis = (body: Body) => ELEMENTS[body][0][0];

/** Mean longitude L in radians at time t, and its rate in radians per day. */
export function meanLongitude(body: Body, t: number): { L: number; rate: number } {
  const [el, rate] = ELEMENTS[body];
  return { L: (el[3] + rate[3] * ((t - J2000) / CENTURY)) * RAD, rate: (rate[3] * RAD) / 36525 };
}

/** Longitude of perihelion ϖ in radians at J2000. */
export const perihelionLongitude = (body: Body) => ELEMENTS[body][0][4] * RAD;
