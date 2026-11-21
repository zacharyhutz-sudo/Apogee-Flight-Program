import {
  AIR,
  alignToVelocity,
  MU,
  R,
  STEP,
  canWarp,
  clamp,
  orbit,
  radius,
  step,
  stepDebris,
  type Flight,
} from "./flight.ts";

const tau = 2 * Math.PI;
const positive = (angle: number) => ((angle % tau) + tau) % tau;

// Closed elliptic orbits advance in mean anomaly. Open and nearly radial paths
// retain the ordinary fixed step, including collision detection.
export function coast(s: Flight, seconds: number): boolean {
  if (!canWarp(s) || seconds <= 0) return false;
  const o = orbit(s),
    r = radius(s),
    limit = R + AIR + 500;
  if (o.e >= 0.999999 || Math.abs(o.h) < 1 || o.a <= 0) {
    let left = seconds;
    while (left > 1e-8 && canWarp(s)) {
      const dt = Math.min(STEP, left);
      step(s, dt);
      left -= dt;
    }
    return canWarp(s);
  }
  const sign = Math.sign(o.h),
    n = Math.sqrt(MU / o.a ** 3);
  const trueAnom = (Math.atan2(s.y, s.x) - o.arg) * sign;
  const E = Math.atan2(
    Math.sqrt(1 - o.e * o.e) * Math.sin(trueAnom),
    o.e + Math.cos(trueAnom),
  );
  const M = E - o.e * Math.sin(E);
  let safe = true;
  if (o.pe <= AIR + 500 && o.e > 1e-12) {
    const crossE = -Math.acos(clamp((1 - limit / o.a) / o.e, -1, 1));
    const until = positive(crossE - o.e * Math.sin(crossE) - M) / n;
    if (until <= seconds + 0.25) {
      seconds = Math.min(seconds, Math.max(0, until - 0.15));
      safe = false;
    }
  }
  const nextM = positive(M + n * seconds);
  let nextE = o.e < 0.8 ? nextM : Math.PI;
  for (let i = 0; i < 20; i++) {
    const delta =
      (nextE - o.e * Math.sin(nextE) - nextM) / (1 - o.e * Math.cos(nextE));
    nextE -= delta;
    if (Math.abs(delta) < 1e-12) break;
  }
  const c = Math.cos(nextE),
    sn = Math.sin(nextE),
    b = Math.sqrt(1 - o.e * o.e);
  const x = o.a * (c - o.e),
    y = sign * o.a * b * sn,
    rate = n / (1 - o.e * c);
  const vx = -o.a * sn * rate,
    vy = sign * o.a * b * c * rate;
  const cos = Math.cos(o.arg),
    sin = Math.sin(o.arg);
  s.x = x * cos - y * sin;
  s.y = x * sin + y * cos;
  s.vx = vx * cos - vy * sin;
  s.vy = vx * sin + vy * cos;
  const apE = positive(Math.PI - M) / n;
  s.maxAlt = Math.max(
    s.maxAlt,
    r - R,
    radius(s) - R,
    apE <= seconds ? o.ap : 0,
  );
  alignToVelocity(s);
  s.t += seconds;
  // Advance any active detached stages in small substeps during coast
  if (s.debris && s.debris.length) {
    const sub = Math.min(20, Math.max(1, Math.ceil(seconds / 0.5)));
    const dt = seconds / sub;
    for (let i = 0; i < sub; i++) stepDebris(s, dt);
  }
  return safe;
}
