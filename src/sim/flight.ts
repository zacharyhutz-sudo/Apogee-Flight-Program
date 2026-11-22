// SI throughout. All coordinates and velocities use an Earth-centred inertial frame.
// Spaceflight Simulator-inspired 1:20 scaled Earth: R = 315 km, 30 km atmosphere, 9.81 m/s^2 surface gravity.
export const R = 315000;
export const G0 = 9.80665;
export const MU = G0 * R * R;
export const AIR = 30000;
export const SCALE_HEIGHT = 3200;
export const MAX_ORBIT_AP = 600000;
export const CHUTE_MAX_SPEED = 200;
export const CHUTE_FULL_ALT = 500;
export const STEP = 1 / 20;

export interface StageSpec {
  name: string;
  dry: number;
  fuel: number;
  thrust: number;
  isp: number;
  area: number;
}

export const STAGES: readonly [StageSpec, StageSpec] = [
  {
    name: "Booster",
    dry: 3200,
    fuel: 10500,
    thrust: 360000,
    isp: 285,
    area: 8,
  },
  {
    name: "Orbital stage",
    dry: 1400,
    fuel: 3600,
    thrust: 95000,
    isp: 345,
    area: 5,
  },
] as const;

const DEFAULT_PAYLOAD = 1200;

export type Mode = "manual" | "guide" | "prograde" | "retrograde";
export type Status = "pad" | "flying" | "landed" | "lost";

export interface FlightVisualPart {
  partId: string;
  stage: number;
  symmetry: 1 | 2;
}

export interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  angle: number;
  omega: number;
  mass: number;
  area: number;
  age: number;
  parts?: FlightVisualPart[];
}

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
  hasLegs?: boolean;
  hasChute?: boolean;
  legsDeployed?: boolean;
  chuteDeployed?: boolean;
  chuteRipped?: boolean;
  /** Real simulated detached stages falling under gravity & drag. */
  debris?: Debris[];
  /** Optional custom stage specs constructed from a Rocket Workshop blueprint. */
  customStages?: [StageSpec, StageSpec];
  customPayload?: number;
  vehicleName?: string;
  blueprintParts?: FlightVisualPart[];
}

export function stagesOf(s: Flight): readonly [StageSpec, StageSpec] {
  return s.customStages ?? STAGES;
}

export function payloadOf(s: Flight): number {
  return s.customPayload !== undefined ? s.customPayload : DEFAULT_PAYLOAD;
}

export function initial(
  customStages?: [StageSpec, StageSpec],
  customPayload?: number,
  vehicleName?: string,
  blueprintParts?: FlightVisualPart[],
): Flight {
  const st = customStages ?? STAGES;
  const f: Flight = {
    x: R,
    y: 0,
    vx: 0,
    vy: 0,
    t: 0,
    cargo: 0,
    stage: 0,
    fuel: [st[0].fuel, st[1].fuel],
    throttle: 1,
    pitch: 0,
    mode: "guide",
    status: "pad",
    orbitEarned: false,
    maxAlt: 0,
    hasLegs: true,
    hasChute: true,
    legsDeployed: false,
    chuteDeployed: false,
    chuteRipped: false,
  };
  if (customStages) f.customStages = customStages;
  if (customPayload !== undefined) f.customPayload = customPayload;
  if (vehicleName) f.vehicleName = vehicleName;
  if (blueprintParts) {
    f.blueprintParts = blueprintParts.map((p) => ({ partId: p.partId, stage: p.stage, symmetry: p.symmetry }));
    f.hasLegs = blueprintParts.some((p) => p.partId === "legs_mk1");
    f.hasChute = blueprintParts.some((p) => p.partId === "chute_mk1");
  }
  return f;
}

export const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));
export const radius = (s: { x: number; y: number }) => Math.hypot(s.x, s.y);
export const speed = (s: { vx: number; vy: number }) => Math.hypot(s.vx, s.vy);

/** World-space thrust unit vector (tx, ty) in inertial frame (+x north, +y east). */
export function headingVector(s: Flight) {
  const r = radius(s) || R;
  const nx = s.x / r,
    ny = s.y / r;
  const theta = (s.pitch * Math.PI) / 180;
  const tx = nx * Math.cos(theta) - ny * Math.sin(theta);
  const ty = ny * Math.cos(theta) + nx * Math.sin(theta);
  return { tx, ty, angle: Math.atan2(ty, tx) };
}

export function mass(s: Flight) {
  const st = stagesOf(s);
  return (
    payloadOf(s) +
    s.cargo +
    st[1].dry +
    s.fuel[1] +
    (s.stage === 0 ? st[0].dry + s.fuel[0] : 0)
  );
}

export function thrustToWeight(s: Flight) {
  const st = stagesOf(s);
  const thrust = s.fuel[s.stage] > 0 ? st[s.stage].thrust * s.throttle : 0;
  return thrust / ((mass(s) * MU) / radius(s) ** 2);
}

export function deltaV(s: Flight) {
  const st = stagesOf(s);
  const pay = payloadOf(s);
  const upperDry = pay + s.cargo + st[1].dry;
  const upper =
    st[1].fuel > 0 && st[1].thrust > 0 && upperDry > 0
      ? st[1].isp * G0 * Math.log((upperDry + s.fuel[1]) / upperDry)
      : 0;
  const lower =
    s.stage === 0 && s.fuel[0] > 0 && st[0].thrust > 0
      ? st[0].isp * G0 * Math.log(mass(s) / (mass(s) - s.fuel[0]))
      : 0;
  return upper + lower;
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
  return o.pe >= AIR && o.ap <= MAX_ORBIT_AP;
}

export function stage(s: Flight) {
  if (s.status !== "flying" || s.stage !== 0) return false;
  const st = stagesOf(s);
  const { tx, ty, angle } = headingVector(s);
  const sepSpeed = 5.5;
  const boosterMass = Math.max(200, st[0].dry + s.fuel[0]);
  const piece: Debris = {
    x: s.x - tx * 14,
    y: s.y - ty * 14,
    vx: s.vx - tx * sepSpeed - ty * 0.45,
    vy: s.vy - ty * sepSpeed + tx * 0.45,
    angle,
    omega: 0.32,
    mass: boosterMass,
    area: st[0].area,
    age: 0,
    parts: s.blueprintParts?.filter((p) => p.stage === 0),
  };
  s.debris = [...(s.debris ?? []), piece].slice(-4);
  s.stage = 1;
  s.fuel[0] = 0;
  return true;
}

export function toggleLegs(s: Flight) {
  if (!s.hasLegs && s.hasLegs !== undefined) return false;
  s.legsDeployed = !s.legsDeployed;
  return true;
}

export function toggleChute(s: Flight): "deployed" | "ripped" | "cut" | "blocked" {
  if (!s.hasChute && s.hasChute !== undefined) return "blocked";
  if (s.status !== "flying" || s.chuteRipped) return "blocked";
  const alt = radius(s) - R;
  if (s.chuteDeployed) {
    s.chuteDeployed = false;
    return "cut";
  }
  if (alt >= AIR) return "blocked";
  if (speed(s) > CHUTE_MAX_SPEED) {
    s.chuteRipped = true;
    s.chuteDeployed = false;
    return "ripped";
  }
  s.chuteDeployed = true;
  s.mode = "manual";
  s.pitch = 0;
  return "deployed";
}

export function density(alt: number) {
  return alt >= AIR ? 0 : 1.225 * Math.exp(-Math.max(0, alt) / SCALE_HEIGHT);
}

export function burning(s: Flight) {
  const st = stagesOf(s);
  return (
    s.status === "flying" &&
    s.throttle > 0 &&
    s.fuel[s.stage] > 0 &&
    st[s.stage].thrust > 0
  );
}

export function canWarp(s: Flight) {
  return s.status === "flying" && !burning(s) && radius(s) > R + AIR + 500;
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

export function stepDebris(s: Flight, dt: number) {
  if (!s.debris || !s.debris.length || dt <= 0) return;
  const keep: Debris[] = [];
  for (const d of s.debris) {
    const r = radius(d);
    if (r <= R || d.age > 3600) continue;
    const alt = r - R;
    const v = speed(d);
    const nx = d.x / r,
      ny = d.y / r;
    const grav = MU / (r * r);
    const drag = (0.5 * density(alt) * 0.42 * d.area * v) / Math.max(100, d.mass);
    const ax = -nx * grav - drag * d.vx;
    const ay = -ny * grav - drag * d.vy;
    d.x += d.vx * dt + (ax * dt * dt) / 2;
    d.y += d.vy * dt + (ay * dt * dt) / 2;
    d.vx += ax * dt;
    d.vy += ay * dt;
    d.angle += d.omega * dt;
    d.age += dt;
    if (radius(d) > R) keep.push(d);
  }
  s.debris = keep.length ? keep : undefined;
}

export function step(s: Flight, dt = STEP) {
  if (s.status !== "flying") return;
  const st = stagesOf(s);
  const r = radius(s),
    alt = r - R,
    v = speed(s),
    nx = s.x / r,
    ny = s.y / r;
  const vr = nx * s.vx + ny * s.vy,
    vt = nx * s.vy - ny * s.vx;
  const engine = st[s.stage];
  if (s.chuteDeployed) {
    if (v > CHUTE_MAX_SPEED) {
      s.chuteRipped = true;
      s.chuteDeployed = false;
    } else {
      // Parachute hangs strictly opposite gravity (+radial), locking vehicle pitch to 0
      s.mode = "manual";
      s.pitch = 0;
    }
  }
  if (
    !s.chuteDeployed &&
    s.mode === "guide" &&
    s.throttle > 0 &&
    s.fuel[s.stage] > 0 &&
    engine.thrust > 0
  ) {
    // SFS-scale gravity turn: climb above 30 km atmosphere before circularizing at ~45 km
    const targetClimb = clamp((48000 - alt) / 14, -70, 420);
    const acc = (engine.thrust * s.throttle) / mass(s);
    const radial = (targetClimb - vr) / 8 + MU / (r * r) - (vt * vt) / r;
    const tilt = (Math.acos(clamp(radial / acc, -1, 1)) * 180) / Math.PI;
    s.pitch = clamp(tilt, 0, Math.min(115, Math.max(0, alt / 260)));
    if (stable(s)) {
      s.throttle = 0;
      s.mode = "prograde";
    }
  } else if (!s.chuteDeployed) alignToVelocity(s);
  const used =
    engine.thrust > 0
      ? Math.min(
          s.fuel[s.stage],
          (engine.thrust * s.throttle * dt) / (engine.isp * G0),
        )
      : 0;
  const midMass = mass(s) - used / 2;
  const thrustAcc =
    used > 0 ? (used * engine.isp * G0) / (dt * midMass) : 0;
  const theta = (s.pitch * Math.PI) / 180,
    grav = MU / (r * r);
  const chuteFull = Boolean(s.chuteDeployed && alt <= CHUTE_FULL_ALT);
  const chuteHalf = Boolean(s.chuteDeployed && alt > CHUTE_FULL_ALT && alt < AIR);
  const chuteDragFactor = chuteFull
    ? Math.max(950, midMass * 0.28)
    : chuteHalf
      ? Math.max(220, midMass * 0.055)
      : 0;
  const rawDrag =
    (0.5 * density(alt) * (0.32 * engine.area + chuteDragFactor) * v) / midMass;
  // Cap per-step drag damping so stiff full-canopy drag never oscillates numerically
  const drag = Math.min(rawDrag, 0.45 / dt);
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
    const maxVr = s.legsDeployed ? 14 : 6;
    const maxVt = s.legsDeployed ? 7 : 3;
    const maxTilt = s.legsDeployed ? 25 : 15;
    s.status =
      Math.abs(vr) < maxVr && Math.abs(vt) < maxVt && Math.abs(s.pitch) < maxTilt
        ? "landed"
        : "lost";
    s.x *= R / nextR;
    s.y *= R / nextR;
    s.vx = 0;
    s.vy = 0;
    s.throttle = 0;
    s.chuteDeployed = false;
  }
  if (!s.orbitEarned && stable(s)) s.orbitEarned = true;
  stepDebris(s, dt);
}
