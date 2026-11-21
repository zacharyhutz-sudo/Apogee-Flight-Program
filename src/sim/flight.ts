// SI throughout. All coordinates and velocities use an Earth-centred inertial frame.
export const R = 6371000;
export const MU = 3.986004418e14;
export const G0 = 9.80665;
export const AIR = 100000;
export const STEP = 1 / 20;
export const STAGES = [
  {
    name: "Booster",
    dry: 16000,
    fuel: 238000,
    thrust: 5700000,
    isp: 318,
    area: 16,
  },
  {
    name: "Orbital stage",
    dry: 3200,
    fuel: 50500,
    thrust: 920000,
    isp: 367,
    area: 10,
  },
] as const;
const payload = 2400;
export type Mode = "manual" | "guide" | "prograde" | "retrograde";
export type Status = "pad" | "flying" | "landed" | "lost";
export interface Flight {
  x: number;
  y: number;
  vx: number;
  vy: number;
  t: number;
  cargo: number;
  stage: 0 | 1;
  fuel: [number, number];
  throttle: number;
  pitch: number;
  mode: Mode;
  status: Status;
  orbitEarned: boolean;
  maxAlt: number;
}
export function initial(): Flight {
  return {
    x: R,
    y: 0,
    vx: 0,
    vy: 0,
    t: 0,
    cargo: 0,
    stage: 0,
    fuel: [STAGES[0].fuel, STAGES[1].fuel],
    throttle: 1,
    pitch: 0,
    mode: "guide",
    status: "pad",
    orbitEarned: false,
    maxAlt: 0,
  };
}
export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const radius = (s: Flight) => Math.hypot(s.x, s.y);
export const speed = (s: Flight) => Math.hypot(s.vx, s.vy);
export function mass(s: Flight) {
  return (
    payload +
    s.cargo +
    STAGES[1].dry +
    s.fuel[1] +
    (s.stage === 0 ? STAGES[0].dry + s.fuel[0] : 0)
  );
}
export function thrustToWeight(s: Flight) {
  const thrust = s.fuel[s.stage] > 0 ? STAGES[s.stage].thrust * s.throttle : 0;
  return thrust / ((mass(s) * MU) / radius(s) ** 2);
}
export function deltaV(s: Flight) {
  const upper =
    STAGES[1].isp *
    G0 *
    Math.log(
      (payload + s.cargo + STAGES[1].dry + s.fuel[1]) /
        (payload + s.cargo + STAGES[1].dry),
    );
  return (
    upper +
    (s.stage === 0
      ? STAGES[0].isp * G0 * Math.log(mass(s) / (mass(s) - s.fuel[0]))
      : 0)
  );
}
export function orbit(s: Flight) {
  const r = radius(s),
    v = speed(s),
    dot = s.x * s.vx + s.y * s.vy;
  const h = s.x * s.vy - s.y * s.vx;
  const ex = ((v * v - MU / r) * s.x - dot * s.vx) / MU,
    ey = ((v * v - MU / r) * s.y - dot * s.vy) / MU;
  const e = Math.hypot(ex, ey),
    p = (h * h) / MU;
  const a = 1 / (2 / r - (v * v) / MU);
  return {
    e,
    a,
    p,
    h,
    arg: Math.atan2(ey, ex),
    pe: p / (1 + e) - R,
    ap: a > 0 ? a * (1 + e) - R : Infinity,
  };
}
export function stable(s: Flight) {
  const o = orbit(s);
  return o.pe >= AIR && o.ap <= 2000000;
}
export function stage(s: Flight) {
  if (s.status !== "flying" || s.stage !== 0) return false;
  s.stage = 1;
  s.fuel[0] = 0;
  return true;
}
export function density(alt: number) {
  return alt >= AIR ? 0 : 1.225 * Math.exp(-Math.max(0, alt) / 8500);
}
export function burning(s: Flight) {
  return s.status === "flying" && s.throttle > 0 && s.fuel[s.stage] > 0;
}
export function canWarp(s: Flight) {
  return s.status === "flying" && !burning(s) && radius(s) > R + AIR + 1000;
}
export function alignToVelocity(s: Flight) {
  if ((s.mode !== "prograde" && s.mode !== "retrograde") || speed(s) <= 0.1)
    return;
  const radial = s.x * s.vx + s.y * s.vy,
    tangent = s.x * s.vy - s.y * s.vx;
  const angle =
    (Math.atan2(tangent, radial) * 180) / Math.PI +
    (s.mode === "retrograde" ? 180 : 0);
  s.pitch = angle > 180 ? angle - 360 : angle;
}
export function step(s: Flight, dt = STEP) {
  if (s.status !== "flying") return;
  const r = radius(s),
    alt = r - R,
    v = speed(s),
    nx = s.x / r,
    ny = s.y / r;
  const vr = nx * s.vx + ny * s.vy,
    vt = nx * s.vy - ny * s.vx;
  const engine = STAGES[s.stage];
  if (s.mode === "guide" && s.throttle > 0 && s.fuel[s.stage] > 0) {
    const targetClimb = clamp((154000 - alt) / 55, -130, 540);
    const acc = (engine.thrust * s.throttle) / mass(s);
    const radial = (targetClimb - vr) / 14 + MU / (r * r) - (vt * vt) / r;
    const tilt = (Math.acos(clamp(radial / acc, -1, 1)) * 180) / Math.PI;
    s.pitch = clamp(tilt, 0, Math.min(115, Math.max(0, alt / 530)));
    if (stable(s)) {
      s.throttle = 0;
      s.mode = "prograde";
    }
  } else alignToVelocity(s);
  const used = Math.min(
    s.fuel[s.stage],
    (engine.thrust * s.throttle * dt) / (engine.isp * G0),
  );
  const midMass = mass(s) - used / 2;
  const thrustAcc = (used * engine.isp * G0) / (dt * midMass);
  const theta = (s.pitch * Math.PI) / 180,
    grav = MU / (r * r);
  const drag = (0.5 * density(alt) * 0.32 * engine.area * v) / midMass;
  const ax =
    (nx * Math.cos(theta) - ny * Math.sin(theta)) * thrustAcc -
    nx * grav -
    drag * s.vx;
  const ay =
    (ny * Math.cos(theta) + nx * Math.sin(theta)) * thrustAcc -
    ny * grav -
    drag * s.vy;
  s.x += s.vx * dt + (ax * dt * dt) / 2;
  s.y += s.vy * dt + (ay * dt * dt) / 2;
  s.vx += ax * dt;
  s.vy += ay * dt;
  s.t += dt;
  s.fuel[s.stage] -= used;
  const nextR = radius(s);
  s.maxAlt = Math.max(s.maxAlt, nextR - R);
  if (nextR <= R) {
    s.status =
      Math.abs(vr) < 4 && Math.abs(vt) < 2 && Math.abs(s.pitch) < 12
        ? "landed"
        : "lost";
    s.x *= R / nextR;
    s.y *= R / nextR;
    s.vx = 0;
    s.vy = 0;
    s.throttle = 0;
  }
  if (!s.orbitEarned && stable(s)) s.orbitEarned = true;
}
