// Compares the Keplerian approximations in src/lib/orbits.ts with astronomy-engine, 1900–2100.
// Run: bun scripts/check-orbits.ts
import * as A from 'astronomy-engine';
import { BODIES, position } from '../src/lib/orbits';

const rot = A.Rotation_EQJ_ECL();
const deg = (r: number) => (r * 180) / Math.PI;
const wrap = (d: number) => ((d + 540) % 360) - 180;

for (const [from, to] of [[1900, 2050], [2050, 2100]]) {
  console.log(`\n${from}–${to}: max error`);
  for (const b of BODIES) {
    let maxLon = 0, maxR = 0;
    for (let t = Date.UTC(from, 0, 1); t < Date.UTC(to, 0, 1); t += 7 * 86_400_000) {
      const body = b === 'Earth' ? A.Body.EMB : (b as A.Body);
      const v = A.RotateVector(rot, A.HelioVector(body, new Date(t)));
      const p = position(b, t);
      maxLon = Math.max(maxLon, Math.abs(wrap(deg(Math.atan2(v.y, v.x) - p.lon))));
      maxR = Math.max(maxR, Math.abs(Math.hypot(v.x, v.y, v.z) - p.r) / p.r);
    }
    console.log(`${b.padEnd(8)} longitude ${maxLon.toFixed(3)}°  distance ${(maxR * 100).toFixed(2)}%`);
  }
}
